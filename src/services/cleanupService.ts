import { db } from '../db/db';
import { logger } from '../config/logger';

export interface CleanupStats {
  startTime: Date;
  endTime: Date;
  scannedCount: number;
  deletedCount: number;
  retainedCount: number;
}

export class CleanupService {
  /**
   * Runs the automated news cleanup:
   * 1. Scans articles older than 7 days.
   * 2. Excludes saved articles.
   * 3. Deletes expired articles.
   * 4. Logs details to system_logs.
   */
  static async runCleanup(): Promise<CleanupStats> {
    const startTime = new Date();
    logger.info('Starting daily article cleanup job');

    let scannedCount = 0;
    let deletedCount = 0;
    let retainedCount = 0;

    try {
      // 1. Get total active articles count before cleanup
      const totalArticlesRes = await db.query('SELECT COUNT(*)::int as count FROM articles');
      const totalBefore = totalArticlesRes.rows[0].count;

      // 2. Count articles older than 7 days
      const scannedRes = await db.query(
        `SELECT COUNT(*)::int as count FROM articles 
         WHERE created_at < NOW() - INTERVAL '7 days'`
      );
      scannedCount = scannedRes.rows[0].count;

      // 3. Find articles that are older than 7 days but SAVED (to keep count of retained)
      const savedOldRes = await db.query(
        `SELECT COUNT(*)::int as count FROM articles a
         JOIN saved_articles s ON a.id = s.article_id
         WHERE a.created_at < NOW() - INTERVAL '7 days'`
      );
      const savedOldCount = savedOldRes.rows[0].count;

      // 4. Retrieve list of articles that will be deleted for logging
      const toDeleteRes = await db.query(
        `SELECT id, title, source_url FROM articles
         WHERE created_at < NOW() - INTERVAL '7 days'
           AND id NOT IN (SELECT article_id FROM saved_articles)`
      );
      const articlesToDelete = toDeleteRes.rows;
      deletedCount = articlesToDelete.length;
      retainedCount = totalBefore - deletedCount;

      // Log each deleted article in system_logs
      for (const article of articlesToDelete) {
        await db.query(
          `INSERT INTO system_logs (log_level, action, message, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            'info',
            'article_deletion',
            `Deleted expired article: ${article.title}`,
            JSON.stringify({ articleId: article.id, sourceUrl: article.source_url })
          ]
        );
      }

      // 5. Run delete query
      if (deletedCount > 0) {
        await db.query(
          `DELETE FROM articles
           WHERE created_at < NOW() - INTERVAL '7 days'
             AND id NOT IN (SELECT article_id FROM saved_articles)`
        );
      }

      const endTime = new Date();
      const stats: CleanupStats = {
        startTime,
        endTime,
        scannedCount,
        deletedCount,
        retainedCount
      };

      // 6. Log cleanup summary in system_logs
      await db.query(
        `INSERT INTO system_logs (log_level, action, message, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          'info',
          'cleanup_summary',
          `Completed daily article cleanup. Deleted ${deletedCount} articles.`,
          JSON.stringify(stats)
        ]
      );

      logger.info(stats, 'Daily article cleanup completed successfully');
      return stats;

    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to run daily article cleanup');
      
      // Log failure
      await db.query(
        `INSERT INTO system_logs (log_level, action, message, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          'error',
          'cleanup_failure',
          `Failed to run daily cleanup job: ${error.message}`,
          JSON.stringify({ error: error.message, stack: error.stack })
        ]
      );
      
      throw error;
    }
  }

  /**
   * Fetches latest cleanup statistics from system logs.
   */
  static async getLatestStats(): Promise<any> {
    try {
      const statsRes = await db.query(
        `SELECT metadata, created_at FROM system_logs 
         WHERE action = 'cleanup_summary' 
         ORDER BY created_at DESC LIMIT 1`
      );

      const latestStats = statsRes.rows[0];

      const countsRes = await db.query(
        `SELECT 
           (SELECT COUNT(*)::int FROM articles) as total_articles,
           (SELECT COUNT(*)::int FROM saved_articles) as saved_articles,
           (SELECT COUNT(*)::int FROM rss_sources) as active_sources,
           (SELECT COUNT(*)::int FROM languages WHERE enabled = true) as enabled_languages`
      );

      const dbCounts = countsRes.rows[0];

      return {
        database_metrics: dbCounts,
        last_cleanup: latestStats ? {
          executed_at: latestStats.created_at,
          ...latestStats.metadata
        } : null
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch cleanup statistics');
      return null;
    }
  }
}
