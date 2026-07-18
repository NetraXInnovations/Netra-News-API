import { connectDB } from './src/db/db';
import { RssIngestionService } from './src/services/rssIngestionService';
import { logger } from './src/config/logger';

async function run() {
  await connectDB();
  logger.level = 'debug';
  await RssIngestionService.syncAllFeeds();
  process.exit(0);
}
run();
