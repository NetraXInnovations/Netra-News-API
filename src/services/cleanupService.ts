import { Article } from '../models/Article';
import { CurrentAffair } from '../models/CurrentAffair';
import { logger } from '../config/logger';

export class CleanupService {
  /**
   * Deletes articles older than 48 hours that are NOT saved by any user.
   * 48 hours instead of 24 to ensure categories always have enough articles,
   * even if some RSS feeds have slow refresh cycles.
   */
  public static async runCleanup(): Promise<void> {
    try {
      logger.info('Starting scheduled database cleanup...');
      
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

      const result = await Article.deleteMany({
        createdAt: { $lt: twoDaysAgo },
        isSaved: false
      });

      const caResult = await CurrentAffair.deleteMany({
        createdAt: { $lt: twoDaysAgo },
        isSaved: false
      });

      logger.info(`✓ Database Cleanup completed. Deleted ${result.deletedCount} old articles and ${caResult.deletedCount} old current affairs.`);
    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Database cleanup failed');
    }
  }
}
