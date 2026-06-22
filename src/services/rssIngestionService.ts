import Parser from 'rss-parser';
import { db } from '../db/db';
import { ReadabilityService } from './readabilityService';
import { logger } from '../config/logger';
import axios from 'axios';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

export class RssIngestionService {
  /**
   * Helper to process items with a concurrent sliding window queue.
   * Keeps exactly `concurrency` workers running until the queue is empty.
   */
  private static async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>
  ): Promise<void> {
    const queue = [...items];
    const workers = Array(Math.min(concurrency, queue.length))
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            try {
              await fn(item);
            } catch (err: any) {
              logger.error({ error: err.message }, 'Error in concurrent worker task');
            }
          }
        }
      });
    await Promise.all(workers);
  }

  private static cleanAndBuildParagraphs(rawText: string): string {
    if (!rawText) return 'No content available';

    // STEP 1: Clean article text
    const skipKeywords = [
      "ALSO READ", "READ MORE", "ADVERTISEMENT", "Download App", "Disclaimer",
      "Promotional Text", "TargetReturnStopLoss", "Author Promotion", "Related Articles",
      "Sponsored Content", "Download TOI App", "Build Your Legacy",
      "Stock market recommendations"
    ];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const validLines = lines.filter(line => {
      if (skipKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) return false;
      return true;
    });

    // STEP 2: Sentence Detection
    const text = validLines.join(' ');
    // Split by . ! ? ؟ (Arabic) ۔ (Urdu) । (Devanagari) ॥ followed by space and uppercase letter, or end of string.
    const sentenceRegex = /[^.!?؟۔।॥]+[.!?؟۔।॥]+/g;
    let sentences = text.match(sentenceRegex)?.map(s => s.trim()) || [text];
    if (sentences.length === 1 && sentences[0] === text && !text.match(/[.!?؟۔।॥]$/)) {
        // Fallback if no punctuation matches
        sentences = [text];
    } else {
        sentences = sentences.filter(s => s.length > 0);
    }

    // STEP 3: Paragraph Builder
    const paragraphs: string[] = [];
    let currentSentences: string[] = [];
    let currentLen = 0;

    for (const sentence of sentences) {
      if (!sentence) continue;
      
      const potentialLen = currentLen + (currentSentences.length > 0 ? 1 : 0) + sentence.length;
      
      if (currentSentences.length >= 4 || potentialLen > 350) {
        if (currentSentences.length > 0) {
          paragraphs.push(currentSentences.join(' '));
        }
        currentSentences = [sentence];
        currentLen = sentence.length;
      } else {
        currentSentences.push(sentence);
        currentLen = potentialLen;
        if (currentLen >= 120 && currentSentences.length >= 2) {
          paragraphs.push(currentSentences.join(' '));
          currentSentences = [];
          currentLen = 0;
        }
      }
    }
    
    if (currentSentences.length > 0) {
      paragraphs.push(currentSentences.join(' '));
    }

    // STEP 4: Content Length (target roughly 1000 to 1500 characters)
    let finalContent = '';
    for (const p of paragraphs) {
      if (finalContent.length >= 1000) {
        break;
      }
      finalContent += (finalContent ? '\n\n' : '') + p;
    }
    
    return finalContent || 'No content available';
  }

  /**
   * Synchronizes all active RSS feeds in parallel batches.
   */
  static async syncAllFeeds(): Promise<void> {
    logger.info('Starting RSS synchronization job');

    try {
      // 1. Fetch enabled RSS sources
      const sourcesRes = await db.query(
        'SELECT id, language_id, category_id, source_name, rss_url FROM rss_sources WHERE enabled = true ORDER BY priority DESC'
      );

      const sources = sourcesRes.rows;
      logger.info({ count: sources.length }, 'Fetched active RSS sources');

      // Sync up to 2 feeds concurrently
      await this.runWithConcurrency(sources, 2, async (source) => {
        await this.syncFeed(source);
      });

      logger.info('RSS synchronization job completed successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to run RSS synchronization job');
    }
  }

  private static readonly CURRENT_AFFAIRS_FEEDS = new Set<string>([]);

  /**
   * Syncs a single RSS source feed.
   */
  private static async syncFeed(source: any): Promise<void> {
    const { id: sourceId, language_id: languageId, category_id: categoryId, source_name: sourceName, rss_url: rssUrl } = source;
    logger.info({ sourceName, rssUrl }, 'Syncing feed');

    let articlesFound = 0;
    let articlesImported = 0;
    let syncError: string | null = null;

    try {
      // 2. Fetch and parse the feed
      let feed: any;
      try {
        const response = await axios.get(rssUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        feed = await parser.parseString(response.data);
      } catch (axiosError: any) {
        logger.warn({ sourceName, rssUrl, error: axiosError.message }, 'Axios fetch failed, falling back to direct parser');
        feed = await parser.parseURL(rssUrl);
      }
      const items = feed.items || [];
      articlesFound = items.length;

      // Process up to 3 articles concurrently in a sliding window
      await this.runWithConcurrency(items, 3, async (item: any) => {
        const link = item.link || item.guid;
        if (!link) return;

        const isAffairsCloud = link.includes('affairscloud.com');
        const isCurrentAffairs = isAffairsCloud || RssIngestionService.CURRENT_AFFAIRS_FEEDS.has(rssUrl);

        if (isAffairsCloud) {
          // Special split logic for AffairsCloud articles
          const splitArticles = await ReadabilityService.extractAffairsCloud(link);
          if (splitArticles && splitArticles.length > 0) {
            for (const splitArt of splitArticles) {
              const duplicateRes = await db.query(
                'SELECT 1 FROM articles WHERE source_url = $1',
                [splitArt.sourceUrl]
              );

              if (duplicateRes.rowCount && duplicateRes.rowCount > 0) {
                continue; // Skip duplicate sub-article
              }

              // Map Category Name to categoryId
              let finalCategoryId = categoryId;
              const catLower = splitArt.categoryName.toLowerCase();
              if (catLower.includes('national') || catLower.includes('india')) {
                finalCategoryId = 1;
              } else if (catLower.includes('international') || catLower.includes('world')) {
                finalCategoryId = 2;
              } else if (catLower.includes('sports')) {
                finalCategoryId = 4;
              } else if (catLower.includes('science') || catLower.includes('technology') || catLower.includes('environment')) {
                finalCategoryId = 6;
              } else if (catLower.includes('banking') || catLower.includes('finance') || catLower.includes('business')) {
                finalCategoryId = 7;
              } else if (catLower.includes('economy')) {
                finalCategoryId = 12;
              } else if (catLower.includes('politics')) {
                finalCategoryId = 13;
              } else if (catLower.includes('appointment') || catLower.includes('resignation') || catLower.includes('obituar') || catLower.includes('award') || catLower.includes('people') || catLower.includes('days')) {
                finalCategoryId = 15;
              }

              const content = splitArt.content.trim();
              
              if (!content || content.length < 50) {
                 logger.warn({ sourceUrl: splitArt.sourceUrl, title: splitArt.title }, 'Skipping sub-article due to insufficient content');
                 continue; // Skip if no real content
              }

              // Extract a high-quality summary (first paragraph or first 250 characters)
              const summary = content.split('\n').filter(p => p.trim().length > 0)[0] || content;
              let readingTime = Math.max(1, Math.round(content.split(/\s+/).length / 200));
              const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

              await db.query(
                `INSERT INTO articles (language_id, category_id, title, content, summary, source_url, published_at, reading_time, is_current_affairs)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (source_url) DO NOTHING`,
                [
                  languageId,
                  finalCategoryId,
                  splitArt.title,
                  content,
                  summary,
                  splitArt.sourceUrl,
                  publishedAt,
                  readingTime,
                  isCurrentAffairs
                ]
              );
              articlesImported++;
            }
          }
          return;
        }

        // 3. Duplicate check for normal articles
        const duplicateRes = await db.query(
          'SELECT 1 FROM articles WHERE source_url = $1',
          [link]
        );

        if (duplicateRes.rowCount && duplicateRes.rowCount > 0) {
          // Skip duplicate
          return;
        }

        // 4. Extract and clean full article content
        let extracted: any = null;
        try {
          extracted = await ReadabilityService.extract(link);
        } catch (err) {
          logger.warn({ link }, 'Readability extraction failed, falling back to RSS item content');
        }
        
        let content = '';
        if (extracted && extracted.content && extracted.content.trim().length > 100) {
          content = extracted.content;
        } else {
          // Fallback to embedded RSS content fields. These often contain full HTML articles.
          let fallback = item['content:encoded'] || item.content || item.description || item.summary || item.contentSnippet || '';
          // Strip HTML tags to provide clean text to the paragraph builder
          content = fallback.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
        }
        
        content = content.trim() || '';
        content = this.cleanAndBuildParagraphs(content);
        
        // Skip if there's no real content instead of saving just the title
        if (!content || content === 'No content available' || content.length < 50) {
          logger.warn({ link, title: item.title }, 'Skipping article due to insufficient content');
          return;
        }
        
        let readingTime = extracted?.readingTime || Math.max(1, Math.round(content.split(/\s+/).length / 200));
        const title = extracted?.title || item.title || 'Untitled';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
        const summary = content.split('\n').filter(p => p.trim().length > 0)[0] || content;

        // 5. Store article
        await db.query(
          `INSERT INTO articles (language_id, category_id, title, content, summary, source_url, published_at, reading_time, is_current_affairs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (source_url) DO NOTHING`,
          [
            languageId,
            categoryId,
            title,
            content,
            summary,
            link,
            publishedAt,
            readingTime,
            isCurrentAffairs
          ]
        );

        articlesImported++;
      });

      // Update last checked time
      await db.query(
        'UPDATE rss_sources SET last_checked_at = NOW() WHERE id = $1',
        [sourceId]
      );

      logger.info(
        { sourceName, articlesFound, articlesImported },
        'Synced feed successfully'
      );

    } catch (error: any) {
      syncError = error.message;
      logger.error(
        { sourceName, rssUrl, error: error.message },
        'Failed to sync RSS source feed'
      );
    } finally {
      // 6. Log the sync result in sync_logs
      try {
        await db.query(
          `INSERT INTO sync_logs (rss_source_id, status, articles_found, articles_imported, error_message)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sourceId,
            syncError ? 'failure' : 'success',
            articlesFound,
            articlesImported,
            syncError
          ]
        );
      } catch (logError: any) {
        logger.error({ error: logError.message }, 'Failed to write sync log entry');
      }
    }
  }
}
