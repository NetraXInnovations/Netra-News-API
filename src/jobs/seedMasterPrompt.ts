import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { logger } from '../config/logger';

const masterPromptSources = [
  { sourceName: "The Hindu - National", rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss", language: "English", category: "India" },
  { sourceName: "The Hindu - International", rssUrl: "https://www.thehindu.com/news/international/feeder/default.rss", language: "English", category: "World" },
  { sourceName: "The Hindu - States", rssUrl: "https://www.thehindu.com/news/states/feeder/default.rss", language: "English", category: "States" },
  { sourceName: "The Hindu - Sports", rssUrl: "https://www.thehindu.com/sport/feeder/default.rss", language: "English", category: "Sports" },
  { sourceName: "The Hindu - Cricket", rssUrl: "https://www.thehindu.com/sport/cricket/feeder/default.rss", language: "English", category: "Cricket" },
  { sourceName: "The Hindu - Science", rssUrl: "https://www.thehindu.com/sci-tech/science/feeder/default.rss", language: "English", category: "Science" },
  { sourceName: "Times of India - Technology", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms", language: "English", category: "Technology" },
  { sourceName: "Times of India - Business", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms", language: "English", category: "Business" }
];

async function seedMasterPrompt() {
  await connectDB();
  logger.info('Seeding Master Prompt English sources to MongoDB Atlas...');
  
  try {
    // Clear old sources to ensure strict adherence to master prompt
    await RssSource.deleteMany({});
    
    for (const source of masterPromptSources) {
      await RssSource.create({
        ...source,
        enabled: true,
        priority: 10
      });
    }
    logger.info(`✓ Successfully seeded exactly ${masterPromptSources.length} English sources into MongoDB!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seedMasterPrompt();
