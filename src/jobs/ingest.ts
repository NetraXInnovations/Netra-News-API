import { RssIngestionService } from '../services/rssIngestionService';
import { logger } from '../config/logger';
import { pool } from '../db/db';

async function run() {
  try {
    logger.info('Running RSS ingestion job script...');
    await RssIngestionService.syncAllFeeds();
    logger.info('RSS ingestion job script finished.');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed inside ingestion job script');
  } finally {
    await pool.end();
  }
}

run();
