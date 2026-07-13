import { connectDB } from '../db/db';
import { Article } from '../models/Article';
import { Category } from '../models/Category';
import { RssSource } from '../models/RssSource';
import { logger } from '../config/logger';

async function clearAllData() {
  try {
    await connectDB();
    logger.info('Connected to MongoDB. Wiping all data...');

    // Delete everything from the collections
    await Article.deleteMany({});
    logger.info('✓ All Articles deleted');

    await Category.deleteMany({});
    logger.info('✓ All Categories deleted');

    await RssSource.deleteMany({});
    logger.info('✓ All RSS Sources deleted');

    logger.info('Database is now completely empty!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to clear database', error);
    process.exit(1);
  }
}

clearAllData();
