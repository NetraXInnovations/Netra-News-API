import { connectDB } from '../db/db';
import { RssSource } from '../models/RssSource';
import { logger } from '../config/logger';

const massiveSourcesList = [
  // TELUGU
  { sourceName: "Eenadu - Main", rssUrl: "https://www.eenadu.net/rss", language: "telugu", category: "national", enabled: true, priority: 10 },
  { sourceName: "Sakshi - National", rssUrl: "https://www.sakshi.com/rss/national", language: "telugu", category: "national", enabled: true, priority: 9 },
  { sourceName: "Sakshi - Sports", rssUrl: "https://www.sakshi.com/rss/sports", language: "telugu", category: "sports", enabled: true, priority: 8 },
  { sourceName: "Andhra Jyothy", rssUrl: "https://www.andhrajyothy.com/rss/national", language: "telugu", category: "national", enabled: true, priority: 8 },
  { sourceName: "TV9 Telugu", rssUrl: "https://tv9telugu.com/feed", language: "telugu", category: "national", enabled: true, priority: 9 },
  { sourceName: "Namasthe Telangana", rssUrl: "https://www.ntnews.com/feed", language: "telugu", category: "national", enabled: true, priority: 8 },
  { sourceName: "Telugu 360", rssUrl: "https://www.telugu360.com/feed/", language: "telugu", category: "politics", enabled: true, priority: 7 },
  
  // HINDI
  { sourceName: "Dainik Jagran - National", rssUrl: "https://rss.jagran.com/rss/news/national.xml", language: "hindi", category: "national", enabled: true, priority: 10 },
  { sourceName: "Dainik Jagran - World", rssUrl: "https://rss.jagran.com/rss/news/world.xml", language: "hindi", category: "international", enabled: true, priority: 9 },
  { sourceName: "Dainik Jagran - Sports", rssUrl: "https://rss.jagran.com/rss/sports/cricket.xml", language: "hindi", category: "sports", enabled: true, priority: 9 },
  { sourceName: "Dainik Jagran - Business", rssUrl: "https://rss.jagran.com/rss/business/biz.xml", language: "hindi", category: "business", enabled: true, priority: 8 },
  { sourceName: "Zee News Hindi", rssUrl: "https://zeenews.india.com/hindi/india/rss", language: "hindi", category: "national", enabled: true, priority: 8 },
  { sourceName: "Aaj Tak", rssUrl: "https://www.aajtak.in/rssfeeds/?id=home", language: "hindi", category: "national", enabled: true, priority: 10 },

  // ENGLISH
  { sourceName: "The Hindu - National", rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss", language: "english", category: "national", enabled: true, priority: 10 },
  { sourceName: "The Hindu - International", rssUrl: "https://www.thehindu.com/news/international/feeder/default.rss", language: "english", category: "international", enabled: true, priority: 10 },
  { sourceName: "The Hindu - Sports", rssUrl: "https://www.thehindu.com/sport/feeder/default.rss", language: "english", category: "sports", enabled: true, priority: 9 },
  { sourceName: "The Hindu - Business", rssUrl: "https://www.thehindu.com/business/feeder/default.rss", language: "english", category: "business", enabled: true, priority: 9 },
  { sourceName: "Times of India - National", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms", language: "english", category: "national", enabled: true, priority: 10 },
  { sourceName: "Times of India - World", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", language: "english", category: "international", enabled: true, priority: 9 },
  { sourceName: "Times of India - Sports", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms", language: "english", category: "sports", enabled: true, priority: 10 },
  { sourceName: "Times of India - Business", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms", language: "english", category: "business", enabled: true, priority: 10 },
  { sourceName: "NDTV - National", rssUrl: "https://feeds.feedburner.com/ndtvnews-india-news", language: "english", category: "national", enabled: true, priority: 9 },
  { sourceName: "NDTV - World", rssUrl: "https://feeds.feedburner.com/ndtvnews-world-news", language: "english", category: "international", enabled: true, priority: 8 },
  { sourceName: "NDTV - Business", rssUrl: "https://feeds.feedburner.com/ndtvprofit-latest", language: "english", category: "business", enabled: true, priority: 8 },
  { sourceName: "AffairsCloud - Current Affairs", rssUrl: "https://affairscloud.com/feed/", language: "english", category: "current-affairs", enabled: true, priority: 20 },
  
  // TAMIL
  { sourceName: "Dinamalar - National", rssUrl: "https://www.dinamalar.com/rss/national.xml", language: "tamil", category: "national", enabled: true, priority: 8 },
  { sourceName: "Dinamalar - Sports", rssUrl: "https://www.dinamalar.com/rss/sports.xml", language: "tamil", category: "sports", enabled: true, priority: 8 },
  { sourceName: "Dinamani", rssUrl: "https://www.dinamani.com/india/rssfeed/?id=141", language: "tamil", category: "national", enabled: true, priority: 7 },
  { sourceName: "Hindu Tamil", rssUrl: "https://www.hindutamil.in/rss/india", language: "tamil", category: "national", enabled: true, priority: 9 },
  
  // MALAYALAM
  { sourceName: "Mathrubhumi", rssUrl: "https://www.mathrubhumi.com/rss", language: "malayalam", category: "national", enabled: true, priority: 8 },
  { sourceName: "Manorama", rssUrl: "https://www.onmanorama.com/news/india.feed.xml", language: "malayalam", category: "national", enabled: true, priority: 9 },

  // KANNADA
  { sourceName: "Prajavani", rssUrl: "https://www.prajavani.net/rss", language: "kannada", category: "national", enabled: true, priority: 8 },
  { sourceName: "Vijayavani", rssUrl: "https://www.vijayavani.net/feed", language: "kannada", category: "national", enabled: true, priority: 7 },
  
  // MARATHI
  { sourceName: "Loksatta", rssUrl: "https://www.loksatta.com/feed/", language: "marathi", category: "national", enabled: true, priority: 8 },
  { sourceName: "Sakal", rssUrl: "https://www.esakal.com/feed", language: "marathi", category: "national", enabled: true, priority: 7 },

  // GUJARATI
  { sourceName: "Divya Bhaskar", rssUrl: "https://www.divyabhaskar.co.in/rss", language: "gujarati", category: "national", enabled: true, priority: 8 },
  
  // BENGALI
  { sourceName: "Anandabazar", rssUrl: "https://www.anandabazar.com/rss", language: "bengali", category: "national", enabled: true, priority: 9 },
  
  // CATEGORIES - ENTERTAINMENT / LIFESTYLE
  { sourceName: "TOI - Entertainment", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms", language: "english", category: "entertainment", enabled: true, priority: 7 },
  { sourceName: "TOI - Lifestyle", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/2886704.cms", language: "english", category: "lifestyle", enabled: true, priority: 6 },
  
  // CATEGORIES - TECHNOLOGY / SCIENCE
  { sourceName: "NDTV Gadgets", rssUrl: "https://feeds.feedburner.com/gadgets360-latest", language: "english", category: "technology", enabled: true, priority: 8 },
  { sourceName: "The Hindu - Science", rssUrl: "https://www.thehindu.com/sci-tech/science/feeder/default.rss", language: "english", category: "science", enabled: true, priority: 8 }
];

async function seedMassiveList() {
  await connectDB();
  logger.info('Seeding MASSIVE list of multi-language RSS sources to MongoDB Atlas...');
  
  try {
    for (const source of massiveSourcesList) {
      await RssSource.updateOne(
        { rssUrl: source.rssUrl },
        { $set: source },
        { upsert: true }
      );
    }
    logger.info(`✓ Successfully seeded ${massiveSourcesList.length} sources into MongoDB!`);
    process.exit(0);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed sources');
    process.exit(1);
  }
}

seedMassiveList();
