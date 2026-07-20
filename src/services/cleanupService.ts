import { Article } from '../models/Article';
import { CurrentAffair } from '../models/CurrentAffair';
import { logger } from '../config/logger';

export class CleanupService {
  /**
   * Deletes articles older than 48 hours that are NOT saved by any user.
   *
   * IMPORTANT: Only runs when syncSucceeded = true.
   * This prevents the DB from being emptied during a temporary RSS failure —
   * stale articles are better than no articles at all.
   */
  public static async runCleanup(syncSucceeded: boolean = false): Promise<void> {
    if (!syncSucceeded) {
      logger.warn('⚠ Cleanup skipped — last sync did not succeed. Keeping existing articles to avoid empty DB.');
      return;
    }

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

      logger.info(
        `✓ Database Cleanup completed. Deleted ${result.deletedCount} old articles and ${caResult.deletedCount} old current affairs.`
      );
    } catch (error: any) {
      logger.error({ error: error.message }, '⚠ Database cleanup failed');
    }
  }
}
