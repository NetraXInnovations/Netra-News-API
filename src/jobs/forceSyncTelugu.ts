import { RssIngestionService } from '../services/rssIngestionService';
import { connectDB } from '../db/db';
import { logger } from '../config/logger';
import { RssSource } from '../models/RssSource';

async function runTeluguSync() {
  try {
    await connectDB();
    logger.info('Starting Telugu-only RSS sync...');
    
    // Find all Telugu feeds
    const teluguSources = await RssSource.find({ language: 'Telugu', enabled: true });
    
    logger.info(`Found ${teluguSources.length} Telugu sources. Starting sync...`);
    
    for (const source of teluguSources) {
      await RssIngestionService.processFeed(source);
    }
    
    logger.info('Telugu RSS sync completed successfully!');
  } catch (err) {
    logger.error({ err }, 'Failed to run Telugu sync');
  } finally {
    process.exit(0);
  }
}

runTeluguSync();
