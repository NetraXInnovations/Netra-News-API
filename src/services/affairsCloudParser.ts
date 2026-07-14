import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CurrentAffair } from '../models/CurrentAffair';
import { logger } from '../config/logger';

const parser = new Parser();

// --- Junk / noise patterns to strip from all text ---
const JUNK_PATTERNS = [
  /click here/i,
  /join our/i,
  /subscribe/i,
  /download pdf/i,
  /dear aspirants/i,
  /we are here for you/i,
  /telegram/i,
  /whatsapp/i,
  /facebook/i,
  /instagram/i,
  /twitter/i,
  /youtube/i,
  /previous article/i,
  /next article/i,
  /related articles?/i,
  /read more/i,
  /current affairs today/i,
  /\*{3,}/,
  /newsletter/i,
  /comments?/i,
  /share this/i,
];

function isJunk(text: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(text));
}

/**
 * Cleans the HTML elements of a single topic into plain text.
 * Preserves paragraphs, bullet lists, and tables.
 */
function cleanContent($: cheerio.CheerioAPI, elements: any[]): string {
  let content = '';

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    const $el = $(el);

    // Strip embedded junk nodes
    $el
      .find(
        'script, style, iframe, img, .adsbygoogle, .sharedaddy, ' +
          '.wp-subscribe-wrap, .yarpp-related, .nc_socialPanel, ' +
          '#comments, .comments-area'
      )
      .remove();

    const text = $el.text().trim();
    if (!text || isJunk(text)) continue;

    if (tag === 'p') {
      content += text + '\n\n';
    } else if (tag === 'ul' || tag === 'ol') {
      $el.find('li').each((_, li) => {
        const liText = $(li).text().trim();
        if (liText) content += '• ' + liText + '\n';
      });
      content += '\n';
    } else if (tag === 'table') {
      $el.find('tr').each((_, tr) => {
        const rowText = $(tr)
          .find('td, th')
          .map((_, cell) => $(cell).text().trim())
          .get()
          .join(' | ');
        if (rowText.trim()) content += rowText + '\n';
      });
      content += '\n';
    } else if (/^h[2-6]$/.test(tag)) {
      content += text + '\n\n';
    }
  }

  return content.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Derives structured fields from the raw content string.
 *
 * Strategy:
 *  - First paragraph (≥ 30 chars) → summary
 *  - Bullet lines that start with key-value patterns → keyFacts
 *  - Remaining non-trivial sentences / bullets → importantPoints (up to 5)
 */
function extractStructured(content: string): {
  summary: string;
  keyFacts: string[];
  importantPoints: string[];
} {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  let summary = '';
  const keyFacts: string[] = [];
  const importantPoints: string[] = [];

  // Key-fact patterns:  "Key : Value" or "Launched by : MoEFCC"
  const keyFactRegex = /^•?\s*([A-Za-z][^:]{1,35})\s*[:–-]\s*(.+)$/;

  for (const line of lines) {
    const isBullet = line.startsWith('•');
    const stripped = line.replace(/^•\s*/, '');

    if (!summary && !isBullet && stripped.length >= 30) {
      summary = stripped;
      continue;
    }

    if (isBullet) {
      const match = stripped.match(keyFactRegex);
      if (match && keyFacts.length < 8) {
        keyFacts.push(`${match[1].trim()}: ${match[2].trim()}`);
      } else if (importantPoints.length < 5) {
        importantPoints.push(stripped);
      }
    } else if (!isBullet && stripped.length > 20 && importantPoints.length < 5) {
      importantPoints.push(stripped);
    }
  }

  return { summary, keyFacts, importantPoints };
}

/**
 * Calculates estimated reading time in minutes.
 * ~200 words per minute for factual content.
 */
function calcReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export class AffairsCloudParser {
  private static RSS_URL = 'https://affairscloud.com/feed/';

  /**
   * Processes the AffairsCloud RSS feed.
   * Downloads only pages that have never been partially-or-fully processed.
   * Splits each daily digest into individual topic documents.
   */
  public static async syncAffairsCloud(): Promise<void> {
    try {
      logger.info('Starting AffairsCloud Current Affairs sync...');
      const feed = await parser.parseURL(this.RSS_URL);

      let newTopicsCount = 0;

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // Only process "current affairs" daily digest pages
        if (!item.title.toLowerCase().includes('current affairs')) continue;

        const pageUrl = item.link;

        // Skip if ANY topic from this page URL already exists in the DB
        const alreadyProcessed = await CurrentAffair.exists({ sourceUrl: pageUrl });
        if (alreadyProcessed) {
          logger.info(`Already processed: ${item.title} — skipping.`);
          continue;
        }

        logger.info(`Processing: ${item.title}`);

        // Download the page
        let html: string;
        try {
          const res = await axios.get(pageUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NetraNewsBot/1.0)' },
          });
          html = res.data as string;
        } catch (e: any) {
          logger.error(`Failed to fetch: ${pageUrl} — ${e.message}`);
          continue;
        }

        const $ = cheerio.load(html);
        const articleBody = $('.td-post-content, .post-content, .entry-content').first();
        if (!articleBody.length) {
          logger.warn(`Could not find article body for: ${item.title}`);
          continue;
        }

        // Parse publication date
        const pubDate = item.isoDate ? new Date(item.isoDate) : new Date();
        const dateStr = pubDate.toISOString().split('T')[0];
        const timeStr = pubDate.toISOString().split('T')[1].substring(0, 5);

        // ── Topic splitting ──────────────────────────────────────────────
        const topics: Array<{ title: string; elements: any[] }> = [];
        let currentTitle = '';
        let currentElements: any[] = [];

        const flushTopic = () => {
          if (currentTitle && currentElements.length > 0) {
            topics.push({ title: currentTitle, elements: [...currentElements] });
          }
          currentTitle = '';
          currentElements = [];
        };

        const children = articleBody.children().toArray();

        for (const child of children) {
          const tag = child.tagName.toLowerCase();
          const $child = $(child);
          const text = $child.text().trim();

          if (!text || isJunk(text)) continue;

          let isHeading = false;
          let headingText = '';

          if (tag === 'h2' || tag === 'h3') {
            // Skip ALL-CAPS category dividers like "NATIONAL AFFAIRS"
            if (!text.match(/^[A-Z\s&]+$/)) {
              isHeading = true;
              headingText = text;
            }
          } else if (tag === 'p') {
            const firstStrong = $child.find('strong, b').first();
            if (firstStrong.length > 0) {
              const strongText = firstStrong.text().trim();
              const isCategory = strongText.match(/^[A-Z\s&]+$/) && strongText.length > 3;

              if (
                !isCategory &&
                text.startsWith(strongText) &&
                strongText.length > 10 &&
                strongText !== text
              ) {
                isHeading = true;
                headingText = strongText;
                // Remove the bold title from the node so it's not duplicated in content
                firstStrong.parent().html(
                  ($child.html() || '').replace(firstStrong.toString(), '').trim()
                );
              } else if (strongText.match(/^(\d+\.|Q\.)\s.+/i)) {
                isHeading = true;
                headingText = strongText;
                firstStrong.remove();
              }
            }
          }

          if (isHeading && headingText) {
            flushTopic();
            // Remove leading numbering like "1. " or "Q. "
            currentTitle = headingText.replace(/^(\d+\.|Q\.)\s*/, '').trim();
            // Remaining text in the paragraph (after the bold) is part of content
            const remaining = $child.text().trim();
            if (remaining) currentElements.push(child);
          } else if (currentTitle) {
            // Skip ALL-CAPS sub-section dividers inside the topic
            if (tag === 'p' && text === $child.find('strong, b').text() && text.match(/^[A-Z\s&]+$/)) {
              continue;
            }
            currentElements.push(child);
          }
        }
        flushTopic(); // Save last topic

        if (topics.length === 0) {
          logger.warn(`No topics extracted from: ${item.title}`);
          continue;
        }

        logger.info(`Extracted ${topics.length} topics from: ${item.title}`);

        // ── Process topics in parallel (concurrency = 5) ─────────────────
        const CONCURRENCY = 5;
        const docsToInsert: any[] = [];

        for (let i = 0; i < topics.length; i += CONCURRENCY) {
          const batch = topics.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            batch.map(async ({ title, elements }) => {
              const content = cleanContent($, elements);
              if (content.length < 50) return null; // Skip trivially short topics

              const { summary, keyFacts, importantPoints } = extractStructured(content);
              const readingTime = calcReadingTime(content);

              return {
                title,
                summary,
                keyFacts,
                importantPoints,
                content,
                publishedDate: dateStr,
                publishedTime: timeStr,
                sourceName: 'AffairsCloud',
                sourceUrl: pageUrl,
                readingTime,
                isActive: true,
                isSaved: false,
              };
            })
          );
          for (const doc of results) {
            if (doc) docsToInsert.push(doc);
          }
        }

        // ── Bulk insert (ordered: false so duplicates don't abort the batch) ──
        if (docsToInsert.length > 0) {
          try {
            const inserted = await CurrentAffair.insertMany(docsToInsert, {
              ordered: false,
            });
            newTopicsCount += inserted.length;
          } catch (err: any) {
            // BulkWriteError with code 11000 = duplicate key; count partial successes
            if (err.code === 11000 || err.name === 'BulkWriteError') {
              const partial = err.result?.nInserted ?? 0;
              newTopicsCount += partial;
              logger.warn(`Partial insert for ${item.title}: ${partial}/${docsToInsert.length} saved (duplicates skipped)`);
            } else {
              logger.error(`Insert failed for ${item.title}: ${err.message}`);
            }
          }
        }
      }

      logger.info(`✓ AffairsCloud Sync Complete — ${newTopicsCount} new topics saved.`);
    } catch (error: any) {
      logger.error(`⚠ AffairsCloud Sync Failed: ${error.message}`);
    }
  }
}
