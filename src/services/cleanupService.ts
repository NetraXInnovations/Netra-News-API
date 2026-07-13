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
  static async runCleanup(): Promise<CleanupStats> {
    const startTime = new Date();
    logger.info('Starting scheduled article cleanup job');

    let scannedCount = 0;
    let deletedCount = 0;
    let retainedCount = 0;

    try {
      // 1. Get total active articles count before cleanup
      const totalArticlesAgg = await db.collection('articles').count().get();
      const totalBefore = totalArticlesAgg.data().count;

      // Calculate 24 hours ago threshold
      const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 2. Count articles older than 24 hours (we use aggregation if available, but doing a regular query to get actual counts based on memory constraints might be better, let's just get count)
      const scannedAgg = await db.collection('articles').where('createdAt', '<', thresholdDate).count().get();
      scannedCount = scannedAgg.data().count;

      // 4. Count eligible for deletion (createdAt < 24 hours AND isSaved == false)
      const eligibleToDeleteAgg = await db.collection('articles')
        .where('createdAt', '<', thresholdDate)
        .where('isSaved', '==', false)
        .count().get();
      const eligibleToDeleteCount = eligibleToDeleteAgg.data().count;
      retainedCount = totalBefore - eligibleToDeleteCount;

      // 5. Run delete in batches to prevent locking and OOM issues
      const batchSize = 500; // Firestore maximum operations per batch
      let totalDeleted = 0;
      let done = false;

      while (!done) {
        const snapshot = await db.collection('articles')
          .where('createdAt', '<', thresholdDate)
          .where('isSaved', '==', false)
          .limit(batchSize)
          .get();

        if (snapshot.empty) {
          done = true;
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.docs.length;

        if (snapshot.docs.length < batchSize) {
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
      await db.collection('system_logs').add({
        level: 'info',
        action: 'cleanup_summary',
        message: `Completed scheduled article cleanup. Deleted ${totalDeleted} articles.`,
        metadata: stats,
        createdAt: new Date().toISOString()
      });

      logger.info(stats, '✓ Cleanup Completed');
      return stats;

    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Failed to run scheduled article cleanup (continue)');
      
      // Log failure
      await db.collection('system_logs').add({
        level: 'error',
        action: 'cleanup_failure',
        message: `Failed to run scheduled cleanup job: ${error.message}`,
        metadata: { error: error.message, stack: error.stack },
        createdAt: new Date().toISOString()
      });
      
      throw error;
    }
  }

  static async getLatestStats(): Promise<any> {
    try {
      const statsSnapshot = await db.collection('system_logs')
        .where('action', '==', 'cleanup_summary')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const latestStats = statsSnapshot.empty ? null : statsSnapshot.docs[0].data();

      const totalArticlesAgg = await db.collection('articles').count().get();
      const savedArticlesAgg = await db.collection('articles').where('isSaved', '==', true).count().get();
      const activeSourcesAgg = await db.collection('rss_sources').count().get();
      const enabledLanguagesAgg = await db.collection('languages').where('enabled', '==', true).count().get();

      const dbCounts = {
        total_articles: totalArticlesAgg.data().count,
        saved_articles: savedArticlesAgg.data().count,
        active_sources: activeSourcesAgg.data().count,
        enabled_languages: enabledLanguagesAgg.data().count
      };

      return {
        database_metrics: dbCounts,
        last_cleanup: latestStats ? {
          executed_at: latestStats.createdAt,
          ...latestStats.metadata
        } : null
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch cleanup statistics');
      return null;
    }
  }
}
