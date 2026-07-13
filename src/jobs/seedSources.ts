import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { logger } from '../config/logger';

const defaultSources = [
  {
    sourceName: "The Hindu - National",
    rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss",
    language: "english",
    category: "national",
    enabled: true,
    priority: 10
  },
  {
    sourceName: "The Hindu - International",
    rssUrl: "https://www.thehindu.com/news/international/feeder/default.rss",
    language: "english",
    category: "international",
    enabled: true,
    priority: 10
  },
  {
    sourceName: "Times of India - Top Stories",
    rssUrl: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    language: "english",
    category: "national",
    enabled: true,
    priority: 9
  },
  {
    sourceName: "NDTV - Latest",
    rssUrl: "https://feeds.feedburner.com/ndtvnews-latest",
    language: "english",
    category: "national",
    enabled: true,
    priority: 8
  },
  {
    sourceName: "AffairsCloud - Current Affairs",
    rssUrl: "https://affairscloud.com/feed/",
    language: "english",
    category: "current-affairs",
    enabled: true,
    priority: 20
  }
];

async function seed() {
  await connectDB();
  logger.info('Seeding default RSS sources to MongoDB Atlas...');
  
  try {
    for (const source of defaultSources) {
      await RssSource.updateOne(
        { rssUrl: source.rssUrl },
        { $set: source },
        { upsert: true }
      );
    }
    logger.info(`✓ Successfully seeded ${defaultSources.length} sources into MongoDB!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seed();
