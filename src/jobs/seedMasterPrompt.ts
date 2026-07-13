import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { Category } from '../models/Category';
import { Language } from '../models/Language';
import { logger } from '../config/logger';

const allSources = [
  // --- ENGLISH ---
  { sourceName: "The Hindu - National", rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss", language: "English", category: "India", englishName: "India", languageCode: "en" },
  { sourceName: "The Hindu - International", rssUrl: "https://www.thehindu.com/news/international/feeder/default.rss", language: "English", category: "World", englishName: "World", languageCode: "en" },
  { sourceName: "The Hindu - States", rssUrl: "https://www.thehindu.com/news/states/feeder/default.rss", language: "English", category: "States", englishName: "States", languageCode: "en" },
  { sourceName: "The Hindu - Sports", rssUrl: "https://www.thehindu.com/sport/feeder/default.rss", language: "English", category: "Sports", englishName: "Sports", languageCode: "en" },
  { sourceName: "The Hindu - Cricket", rssUrl: "https://www.thehindu.com/sport/cricket/feeder/default.rss", language: "English", category: "Cricket", englishName: "Cricket", languageCode: "en" },
  { sourceName: "The Hindu - Science", rssUrl: "https://www.thehindu.com/sci-tech/science/feeder/default.rss", language: "English", category: "Science", englishName: "Science", languageCode: "en" },
  { sourceName: "Times of India - Technology", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms", language: "English", category: "Technology", englishName: "Technology", languageCode: "en" },
  { sourceName: "Times of India - Business", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms", language: "English", category: "Business", englishName: "Business", languageCode: "en" },

  // --- HINDI ---
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/news/india/feed", language: "Hindi", category: "भारत", englishName: "India", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/news/world/feed", language: "Hindi", category: "विश्व", englishName: "World", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/states/feed", language: "Hindi", category: "राज्य", englishName: "States", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/sports/feed", language: "Hindi", category: "खेल", englishName: "Sports", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/business/feed", language: "Hindi", category: "व्यापार", englishName: "Business", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/technology/feed", language: "Hindi", category: "प्रौद्योगिकी", englishName: "Technology", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/education/feed", language: "Hindi", category: "शिक्षा", englishName: "Education", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/lifestyle/feed", language: "Hindi", category: "जीवनशैली", englishName: "Lifestyle", languageCode: "hi" },
  { sourceName: "ABP Live Hindi", rssUrl: "https://www.abplive.com/lifestyle/health/feed", language: "Hindi", category: "स्वास्थ्य", englishName: "Health", languageCode: "hi" },

  // --- TELUGU ---
  { sourceName: "News18 Telugu - Andhra Pradesh", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/andhra-pradesh.xml", language: "Telugu", category: "ఆంధ్రప్రదేశ్", englishName: "Andhra Pradesh", languageCode: "te" },
  { sourceName: "News18 Telugu - Telangana", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/telangana.xml", language: "Telugu", category: "తెలంగాణ", englishName: "Telangana", languageCode: "te" },
  { sourceName: "News18 Telugu - India", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/national.xml", language: "Telugu", category: "భారత్", englishName: "India", languageCode: "te" },
  { sourceName: "News18 Telugu - World", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/international.xml", language: "Telugu", category: "ప్రపంచం", englishName: "World", languageCode: "te" },
  { sourceName: "News18 Telugu - Technology", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/technology.xml", language: "Telugu", category: "సాంకేతికం", englishName: "Technology", languageCode: "te" },
  { sourceName: "News18 Telugu - Sports", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/sports.xml", language: "Telugu", category: "క్రీడలు", englishName: "Sports", languageCode: "te" },
  { sourceName: "News18 Telugu - Business", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/business.xml", language: "Telugu", category: "వ్యాపారం", englishName: "Business", languageCode: "te" },
  { sourceName: "News18 Telugu - Politics", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/national/politics-national.xml", language: "Telugu", category: "రాజకీయాలు", englishName: "Politics", languageCode: "te" },
  { sourceName: "News18 Telugu - Health", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/life-style/health.xml", language: "Telugu", category: "ఆరోగ్యం", englishName: "Health", languageCode: "te" },
  { sourceName: "News18 Telugu - Cricket", rssUrl: "https://telugu.news18.com/commonfeeds/v1/tel/rss/cricket.xml", language: "Telugu", category: "క్రికెట్", englishName: "Cricket", languageCode: "te" }
];

async function seedMasterPrompt() {
  await connectDB();
  logger.info('Seeding All Master Sources (English & Hindi) to MongoDB Atlas...');
  
  try {
    for (const source of allSources) {
      // 1. Ensure Language exists
      await Language.updateOne(
        { name: source.language },
        { $setOnInsert: { name: source.language, code: source.languageCode, enabled: true } },
        { upsert: true }
      );

      // 2. Ensure Category exists with English mapping
      await Category.updateOne(
        { language: source.language, name: source.category },
        { 
          $set: { englishName: source.englishName, enabled: true },
          $setOnInsert: { language: source.language, name: source.category }
        },
        { upsert: true }
      );

      // 3. Add RSS Source
      await RssSource.updateOne(
        { rssUrl: source.rssUrl },
        { 
          $set: { 
            sourceName: source.sourceName,
            language: source.language,
            category: source.category,
            priority: 10,
            enabled: true
          }
        },
        { upsert: true }
      );
    }
    
    logger.info(`✓ Successfully seeded exactly ${allSources.length} sources (English + Hindi) into MongoDB!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seedMasterPrompt();
