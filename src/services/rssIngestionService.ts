import Parser from 'rss-parser';
import { db } from '../db/db';
import { ReadabilityService } from './readabilityService';
import { logger } from '../config/logger';

const parser = new Parser();

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
      const feed = await parser.parseURL(rssUrl);
      const items = feed.items || [];
      articlesFound = items.length;

      // Process up to 3 articles concurrently in a sliding window
      await this.runWithConcurrency(items, 3, async (item) => {
        const link = item.link || item.guid;
        if (!link) return;

        // 3. Duplicate check
        const duplicateRes = await db.query(
          'SELECT 1 FROM articles WHERE source_url = $1',
          [link]
        );

        if (duplicateRes.rowCount && duplicateRes.rowCount > 0) {
          // Skip duplicate
          return;
        }

        // 4. Extract and clean full article content
        const extracted = await ReadabilityService.extract(link);
        if (!extracted || !extracted.content) {
          logger.warn({ link }, 'Skipping article due to empty or failed content extraction');
          return;
        }

        const title = extracted.title || item.title || 'Untitled';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

        // 5. Store article
        await db.query(
          `INSERT INTO articles (language_id, category_id, title, content, source_url, published_at, reading_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            languageId,
            categoryId,
            title,
            extracted.content,
            link,
            publishedAt,
            extracted.readingTime
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
