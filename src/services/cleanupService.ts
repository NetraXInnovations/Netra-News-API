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
    logger.info('Starting scheduled article cleanup job');

    let scannedCount = 0;
    let deletedCount = 0;
    let retainedCount = 0;

    try {
      // 1. Get total active articles count before cleanup
      const totalArticlesRes = await db.query('SELECT COUNT(*)::int as count FROM articles');
      const totalBefore = totalArticlesRes.rows[0].count;

      // 2. Count articles older than 24 hours
      const scannedRes = await db.query(
        `SELECT COUNT(*)::int as count FROM articles 
         WHERE created_at < NOW() - INTERVAL '24 hours'`
      );
      scannedCount = scannedRes.rows[0].count;

      // 3. Find articles that are older than 24 hours but SAVED (to keep count of retained)
      const savedOldRes = await db.query(
        `SELECT COUNT(*)::int as count FROM articles a
         JOIN saved_articles s ON a.id = s.article_id
         WHERE a.created_at < NOW() - INTERVAL '24 hours'`
      );
      const savedOldCount = savedOldRes.rows[0].count;

      // 4. Count articles that are actually eligible for deletion
      const toDeleteCountRes = await db.query(
        `SELECT COUNT(*)::int as count FROM articles
         WHERE created_at < NOW() - INTERVAL '24 hours'
           AND id NOT IN (SELECT article_id FROM saved_articles)`
      );
      const eligibleToDeleteCount = toDeleteCountRes.rows[0].count;
      retainedCount = totalBefore - eligibleToDeleteCount;

      // 5. Run delete in batches to prevent locking and OOM issues
      const batchSize = 1000;
      let totalDeleted = 0;
      let done = false;

      while (!done) {
        const res = await db.query(
          `DELETE FROM articles
           WHERE id IN (
             SELECT id FROM articles
             WHERE created_at < NOW() - INTERVAL '24 hours'
               AND id NOT IN (SELECT article_id FROM saved_articles)
             LIMIT $1
           )
           RETURNING id`,
          [batchSize]
        );
        const rowsDeleted = res.rowCount || 0;
        totalDeleted += rowsDeleted;
        if (rowsDeleted < batchSize) {
          done = true;
        }
      }

      deletedCount = totalDeleted;
      const endTime = new Date();
      const stats: CleanupStats = {
        startTime,
        endTime,
        scannedCount,
        deletedCount,
        retainedCount: totalBefore - totalDeleted
      };

      // 6. Log cleanup summary in system_logs
      await db.query(
        `INSERT INTO system_logs (log_level, action, message, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          'info',
          'cleanup_summary',
          `Completed scheduled article cleanup. Deleted ${totalDeleted} articles.`,
          JSON.stringify(stats)
        ]
      );

      logger.info(stats, 'Scheduled article cleanup completed successfully');
      return stats;

    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to run scheduled article cleanup');
      
      // Log failure
      await db.query(
        `INSERT INTO system_logs (log_level, action, message, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          'error',
          'cleanup_failure',
          `Failed to run scheduled cleanup job: ${error.message}`,
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
