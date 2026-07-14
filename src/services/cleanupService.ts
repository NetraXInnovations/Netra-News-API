import { Article } from '../models/Article';
import { CurrentAffair } from '../models/CurrentAffair';
import { logger } from '../config/logger';

export class CleanupService {
  /**
   * Deletes articles older than 24 hours that are NOT saved by any user.
   */
  public static async runCleanup(): Promise<void> {
    try {
      logger.info('Starting scheduled database cleanup...');
      
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const result = await Article.deleteMany({
        createdAt: { $lt: oneDayAgo },
        isSaved: false
      });

      const caResult = await CurrentAffair.deleteMany({
        createdAt: { $lt: oneDayAgo },
        isSaved: false
      });

      logger.info(`✓ Database Cleanup completed. Deleted ${result.deletedCount} old articles and ${caResult.deletedCount} old current affairs.`);
    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Database cleanup failed');
    }
  }
}
