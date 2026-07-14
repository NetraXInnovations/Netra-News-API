import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { Article } from '../models/Article';
import { logger } from '../config/logger';

async function fixCricket() {
  await connectDB();
  logger.info('Deleting old bad cricket feed and articles...');
  
  await RssSource.deleteOne({ rssUrl: 'https://kannada.news18.com/commonfeeds/v1/kan/rss/cricket-2.xml' });
  await Article.deleteMany({ language: 'Kannada', category: 'ಕ್ರಿಕೆಟ್' });
  
  logger.info('Done cleanup.');
  process.exit(0);
}

fixCricket();
