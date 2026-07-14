import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CurrentAffair, IArticle, ISection } from '../models/CurrentAffair';
import { logger } from '../config/logger';

const rssParser = new Parser();

// ── Known section headings ───────────────────────────────────────────────────
const SECTION_NAMES = new Set([
  'NATIONAL AFFAIRS',
  'INTERNATIONAL AFFAIRS',
  'STATE NEWS',
  'STATES',
  'STATE AFFAIRS',
  'SCIENCE & TECHNOLOGY',
  'SCIENCE AND TECHNOLOGY',
  'TECHNOLOGY',
  'SPORTS',
  'SPORTS NEWS',
  'ECONOMY',
  'ECONOMY & BUSINESS',
  'BANKING',
  'BANKING & FINANCE',
  'BANKING AND FINANCE',
  'BANKING & ECONOMY',
  'DEFENCE',
  'DEFENCE & SECURITY',
  'APPOINTMENTS',
  'APPOINTMENTS & RESIGNATIONS',
  'AWARDS',
  'AWARDS & RECOGNITIONS',
  'AWARDS AND RECOGNITIONS',
  'HONOURS',
  'REPORTS',
  'REPORTS & INDICES',
  'RANKINGS',
  'RANKINGS & REPORTS',
  'SUMMITS',
  'SUMMITS & CONFERENCES',
  'MEETINGS',
  'AGREEMENTS',
  'AGREEMENTS & MOU',
  'BOOKS',
  'BOOKS & AUTHORS',
  'BOOKS AND AUTHORS',
  'IMPORTANT DAYS',
  'IMPORTANT DAYS & EVENTS',
  'OBITUARY',
  'OBITUARIES',
  'ENVIRONMENT',
  'ENVIRONMENT & BIODIVERSITY',
  'HEALTH',
  'HEALTHCARE',
  'SCHEMES',
  'GOVERNMENT SCHEMES',
  'MISCELLANEOUS',
  'COMMITTEES',
  'CULTURE',
  'EDUCATION',
]);

/**
 * Returns true if the given text is a section-level heading.
 * Strategy: match against known list OR detect short ALL-CAPS text.
 */
function isSectionHeading(text: string): boolean {
  const norm = text.trim().toUpperCase().replace(/\s+/g, ' ');
  if (SECTION_NAMES.has(norm)) return true;
  // All-caps, short, no numbers — treat as section divider
  return /^[A-Z][A-Z\s&,'/]+$/.test(norm) && norm.length >= 4 && norm.length <= 60;
}

// ── Junk filters ─────────────────────────────────────────────────────────────
const JUNK_PATTERNS = [
  /click here/i, /join our/i, /subscribe/i, /download pdf/i,
  /dear aspirants/i, /we are here for you/i,
  /telegram/i, /whatsapp/i, /facebook/i, /instagram/i,
  /twitter/i, /youtube/i,
  /previous article/i, /next article/i,
  /related articles?/i, /read more/i,
  /current affairs today/i,
  /\*{3,}/,
  /newsletter/i,
  /share this/i,
];

function isJunk(text: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(text));
}

// ── Extract featured image from a set of elements ────────────────────────────
function extractImage($: cheerio.CheerioAPI, elements: any[]): string {
  for (const el of elements) {
    const $el = $(el);
    // Check <img> inside the element
    const img = $el.find('img[src]').first();
    if (img.length) {
      const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '';
      if (src && !src.includes('data:image') && src.startsWith('http')) return src;
    }
    // Element itself might be an img
    if (el.tagName === 'img') {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && src.startsWith('http')) return src;
    }
  }
  return '';
}

// ── Clean a set of elements into readable plain text ─────────────────────────
function cleanContent($: cheerio.CheerioAPI, elements: any[]): string {
  let content = '';

  for (const el of elements) {
    const tag = el.tagName?.toLowerCase() || '';
    const $el = $(el);

    // Remove embedded junk nodes (keep img for image extraction done separately)
    $el.find('script, style, iframe, .adsbygoogle, .sharedaddy, .wp-subscribe-wrap, .yarpp-related, .nc_socialPanel, #comments, .comments-area').remove();

    const text = $el.text().trim();
    if (!text || isJunk(text)) continue;

    if (tag === 'p') {
      content += text + '\n\n';
    } else if (tag === 'ul' || tag === 'ol') {
      $el.find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t) content += '• ' + t + '\n';
      });
      content += '\n';
    } else if (tag === 'table') {
      $el.find('tr').each((_, tr) => {
        const row = $(tr).find('td, th').map((_, cell) => $(cell).text().trim()).get().join(' | ');
        if (row.trim()) content += row + '\n';
      });
      content += '\n';
    } else if (/^h[2-6]$/.test(tag)) {
      content += text + '\n\n';
    } else if (tag === 'figure' || tag === 'figcaption') {
      const cap = $el.find('figcaption').text().trim();
      if (cap) content += '_' + cap + '_\n\n';
    }
  }

  return content.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Derive summary + keyFacts from content text ───────────────────────────────
function extractStructured(content: string): { summary: string; keyFacts: string[] } {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  let summary = '';
  const keyFacts: string[] = [];
  const keyFactRegex = /^•?\s*([A-Za-z][^:]{1,40})\s*[:–-]\s*(.+)$/;

  for (const line of lines) {
    const isBullet = line.startsWith('•');
    const stripped = line.replace(/^•\s*/, '');

    if (!summary && !isBullet && stripped.length >= 30) {
      summary = stripped;
      continue;
    }
    if (isBullet) {
      const match = stripped.match(keyFactRegex);
      if (match && keyFacts.length < 10) {
        keyFacts.push(`${match[1].trim()}: ${match[2].trim()}`);
      }
    }
  }
  return { summary, keyFacts };
}

// ── Words → reading time (200 wpm) ───────────────────────────────────────────
function wordsToMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

// ────────────────────────────────────────────────────────────────────────────
export class AffairsCloudParser {
  private static RSS_URL = 'https://affairscloud.com/feed/';

  public static async syncAffairsCloud(): Promise<void> {
    try {
      logger.info('Starting AffairsCloud sync...');
      const feed = await rssParser.parseURL(this.RSS_URL);

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;
        if (!item.title.toLowerCase().includes('current affairs')) continue;

        const pageUrl = item.link;
        const pubDate = item.isoDate ? new Date(item.isoDate) : new Date();
        const issueDate = pubDate.toISOString().split('T')[0]; // "2026-07-14"
        const publishedTime = pubDate.toISOString().split('T')[1].substring(0, 5);

        // ── Skip if today's issue already exists ─────────────────────────────
        const alreadyExists = await CurrentAffair.exists({ issueDate });
        if (alreadyExists) {
          logger.info(`Already processed issue: ${issueDate} — skipping.`);
          continue;
        }

        logger.info(`Processing issue: ${item.title}`);

        // ── Download the page ─────────────────────────────────────────────────
        let html: string;
        try {
          const res = await axios.get(pageUrl, {
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NetraNewsBot/1.0)' },
          });
          html = res.data as string;
        } catch (e: any) {
          logger.error(`Failed to fetch ${pageUrl}: ${e.message}`);
          continue;
        }

        const $ = cheerio.load(html);
        const articleBody = $('.td-post-content, .post-content, .entry-content').first();
        if (!articleBody.length) {
          logger.warn(`No article body found for: ${item.title}`);
          continue;
        }

        // ── Walk article body children ────────────────────────────────────────
        const sections: ISection[] = [];
        let currentSection: ISection = { title: 'GENERAL', articles: [] };
        let currentTitle = '';
        let currentElements: any[] = [];

        const flushArticle = () => {
          if (!currentTitle || currentElements.length === 0) return;
          const imageUrl = extractImage($, currentElements);
          const rawContent = cleanContent($, currentElements);
          if (rawContent.length < 30) return; // too short, skip

          const { summary, keyFacts } = extractStructured(rawContent);
          const article: IArticle = {
            title: currentTitle,
            imageUrl,
            summary,
            keyFacts,
            content: rawContent,
          };
          currentSection.articles.push(article);
          currentTitle = '';
          currentElements = [];
        };

        const flushSection = () => {
          flushArticle();
          if (currentSection.articles.length > 0) {
            sections.push({ ...currentSection, articles: [...currentSection.articles] });
          }
          currentSection = { title: 'GENERAL', articles: [] };
        };

        for (const child of articleBody.children().toArray()) {
          const tag = child.tagName?.toLowerCase() || '';
          const $child = $(child);
          const text = $child.text().trim();

          if (!text) continue;
          if (isJunk(text)) continue;

          // ── Check if this is a section heading ──────────────────────────────
          let detectedSection = false;
          let sectionTitle = '';

          if (tag === 'h2' || tag === 'h3') {
            if (isSectionHeading(text)) {
              detectedSection = true;
              sectionTitle = text.trim().toUpperCase().replace(/\s+/g, ' ');
            }
          } else if (tag === 'p') {
            // Section headings often appear as <p><strong style="color:red">NATIONAL AFFAIRS</strong></p>
            const strongText = $child.find('strong, b').text().trim();
            if (strongText && text === strongText && isSectionHeading(strongText)) {
              detectedSection = true;
              sectionTitle = strongText.trim().toUpperCase().replace(/\s+/g, ' ');
            }
            // Also check span-wrapped headings
            const spanText = $child.find('span').text().trim();
            if (!detectedSection && spanText && text === spanText && isSectionHeading(spanText)) {
              detectedSection = true;
              sectionTitle = spanText.trim().toUpperCase().replace(/\s+/g, ' ');
            }
          }

          if (detectedSection) {
            // Save current section and start a new one
            flushSection();
            currentSection = { title: sectionTitle, articles: [] };
            continue;
          }

          // ── Check if this is a topic/article heading ────────────────────────
          let isTopicHeading = false;
          let topicTitle = '';

          if (tag === 'h2' || tag === 'h3') {
            // Non-section h2/h3 → article heading
            isTopicHeading = true;
            topicTitle = text;
          } else if (tag === 'p') {
            const firstStrong = $child.find('strong, b').first();
            if (firstStrong.length > 0) {
              const strongText = firstStrong.text().trim();
              const isAllCapsSection = isSectionHeading(strongText);

              if (
                !isAllCapsSection &&
                text.startsWith(strongText) &&
                strongText.length > 10 &&
                strongText !== text
              ) {
                isTopicHeading = true;
                topicTitle = strongText;
                // Remove bold title from node so it doesn't repeat in content
                firstStrong.remove();
              } else if (strongText.match(/^(\d+\.|Q\.)\s.+/i)) {
                isTopicHeading = true;
                topicTitle = strongText.replace(/^(\d+\.|Q\.)\s*/, '').trim();
                firstStrong.remove();
              }
            }
          }

          if (isTopicHeading && topicTitle) {
            flushArticle(); // save previous article
            currentTitle = topicTitle;
            currentElements = [];
            // Keep remaining text of this paragraph as content
            const remaining = $child.text().trim();
            if (remaining) currentElements.push(child);
          } else if (currentTitle) {
            // Accumulate content for current topic
            currentElements.push(child);
          }
        }

        // Flush last article + section
        flushSection();

        if (sections.length === 0) {
          logger.warn(`No sections extracted for: ${issueDate}`);
          continue;
        }

        // ── Compute totals ────────────────────────────────────────────────────
        const totalTopics = sections.reduce((sum, s) => sum + s.articles.length, 0);
        const allContent = sections
          .flatMap((s) => s.articles.map((a) => a.content))
          .join(' ');
        const estimatedReadingTime = wordsToMinutes(allContent);

        // ── Save to DB ────────────────────────────────────────────────────────
        try {
          await CurrentAffair.create({
            issueDate,
            publishedTime,
            sourceUrl: pageUrl,
            totalTopics,
            estimatedReadingTime,
            sections,
            isSaved: false,
          });
          logger.info(
            `✓ Saved issue ${issueDate}: ${sections.length} sections, ${totalTopics} topics, ~${estimatedReadingTime} min read`
          );
        } catch (err: any) {
          if (err.code === 11000) {
            logger.warn(`Duplicate key — issue ${issueDate} already saved.`);
          } else {
            logger.error(`Failed to save issue ${issueDate}: ${err.message}`);
          }
        }
      }

      logger.info('✓ AffairsCloud sync complete.');
    } catch (error: any) {
      logger.error(`⚠ AffairsCloud sync failed: ${error.message}`);
    }
  }
}
