import { Article } from '../models/Article';
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
      const totalBefore = await Article.countDocuments();

      // Calculate 24 hours ago threshold
      const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Count articles older than 24 hours
      scannedCount = await Article.countDocuments({ createdAt: { $lt: thresholdDate } });

      // Run bulk delete (MongoDB is highly optimized for this, no need for manual batching)
      const deleteResult = await Article.deleteMany({
        createdAt: { $lt: thresholdDate },
        isSaved: false
      });

      deletedCount = deleteResult.deletedCount;
      retainedCount = totalBefore - deletedCount;

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      logger.info({
        durationMs,
        scannedCount,
        deletedCount,
        retainedCount,
      }, '✓ Database cleanup completed successfully');

      return {
        startTime,
        endTime,
        scannedCount,
        deletedCount,
        retainedCount
      };
    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Failed to run database cleanup job');
      return {
        startTime,
        endTime: new Date(),
        scannedCount,
        deletedCount,
        retainedCount
      };
    }
  }
}
