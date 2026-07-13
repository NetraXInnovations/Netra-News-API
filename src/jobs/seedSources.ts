import { db, initFirebase } from '../db/db';
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
  await initFirebase();
  logger.info('Seeding default RSS sources to Firestore...');
  const batch = db.batch();
  const sourcesRef = db.collection('rss_sources');

  for (const source of defaultSources) {
    const docRef = sourcesRef.doc();
    batch.set(docRef, {
      ...source,
      createdAt: new Date().toISOString(),
      lastCheckedAt: null
    });
  }

  try {
    await batch.commit();
    logger.info(`✓ Successfully seeded ${defaultSources.length} sources into Firestore!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seed();
