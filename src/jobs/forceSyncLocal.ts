import { RssIngestionService } from '../services/rssIngestionService';
import { connectDB } from '../db/db';
import { logger } from '../config/logger';

async function runLocalSync() {
  try {
    await connectDB();
    logger.info('Starting full local RSS sync...');
    await RssIngestionService.syncAllFeeds();
    logger.info('Full local RSS sync completed successfully!');
  } catch (err) {
    logger.error({ err }, 'Failed to run local sync');
  } finally {
    process.exit(0);
  }
}

runLocalSync();
