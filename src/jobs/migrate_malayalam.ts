import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Malayalam language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (8, 'Malayalam', 'ml', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Malayalam added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (100, 8, 'കേരളം', true),
      (101, 8, 'ഇന്ത്യ', true),
      (102, 8, 'ലോകം', true),
      (103, 8, 'രാഷ്ട്രീയം', true),
      (104, 8, 'ബിസിനസ്', true),
      (105, 8, 'സാങ്കേതികവിദ്യ', true),
      (106, 8, 'ശാസ്ത്രം', true),
      (107, 8, 'ആരോഗ്യം', true),
      (108, 8, 'കായികം', true),
      (109, 8, 'ക്രിക്കറ്റ്', true),
      (110, 8, 'വിനോദം', true),
      (111, 8, 'സിനിമ', true),
      (112, 8, 'ജീവിതശൈലി', true),
      (113, 8, 'വിദ്യാഭ്യാസം', true),
      (114, 8, 'തൊഴിൽ വാർത്തകൾ', true),
      (115, 8, 'കൃഷി', true),
      (116, 8, 'ഓട്ടോമൊബൈൽ', true),
      (117, 8, 'സംസ്കാരം', true),
      (118, 8, 'യാത്ര', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Malayalam categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (8, 100, 'OneIndia Malayalam - Kerala', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml', true, 1),
      (8, 100, 'Onmanorama - Kerala', 'https://www.onmanorama.com/news/kerala.rss', true, 1),
      (8, 101, 'OneIndia Malayalam - India', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=india', true, 1),
      (8, 101, 'Onmanorama - India', 'https://www.onmanorama.com/news/india.rss', true, 1),
      (8, 102, 'OneIndia Malayalam - World', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-world-fb.xml', true, 1),
      (8, 102, 'Onmanorama - World', 'https://www.onmanorama.com/news/world.rss', true, 1),
      (8, 103, 'Onmanorama - Politics (India)', 'https://www.onmanorama.com/news/india.rss?cat=politics', true, 1),
      (8, 103, 'OneIndia Malayalam - Politics', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=politics', true, 1),
      (8, 104, 'Onmanorama - Business', 'https://www.onmanorama.com/business.rss', true, 1),
      (8, 104, 'OneIndia Malayalam - Business', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=business', true, 1),
      (8, 105, 'OneIndia Malayalam - Tech AI', 'https://malayalam.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (8, 105, 'OneIndia Malayalam - Tech Gen', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=tech', true, 1),
      (8, 106, 'OneIndia Malayalam - Science AI', 'https://malayalam.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science', true, 1),
      (8, 106, 'Onmanorama - Science World', 'https://www.onmanorama.com/news/world.rss?cat=science', true, 1),
      (8, 107, 'OneIndia Malayalam - Health Life', 'https://malayalam.oneindia.com/rss/feeds/malayalam-lifestyle-fb.xml?cat=health', true, 1),
      (8, 107, 'Onmanorama - Health', 'https://www.onmanorama.com/lifestyle/health.rss', true, 1),
      (8, 108, 'OneIndia Malayalam - Sports', 'https://malayalam.oneindia.com/rss/feeds/malayalam-sports-fb.xml', true, 1),
      (8, 108, 'Onmanorama - Sports', 'https://www.onmanorama.com/sports.rss', true, 1),
      (8, 109, 'OneIndia Malayalam - Cricket', 'https://malayalam.oneindia.com/rss/feeds/malayalam-sports-cricket-fb.xml', true, 1),
      (8, 109, 'Onmanorama - Cricket', 'https://www.onmanorama.com/sports/cricket.rss', true, 1),
      (8, 110, 'OneIndia Malayalam - Entertainment', 'https://malayalam.oneindia.com/rss/feeds/malayalam-entertainment-fb.xml', true, 1),
      (8, 110, 'Onmanorama - Entertainment', 'https://www.onmanorama.com/entertainment.rss', true, 1),
      (8, 111, 'OneIndia Malayalam - Movies', 'https://malayalam.oneindia.com/rss/feeds/malayalam-movies-fb.xml', true, 1),
      (8, 111, 'Onmanorama - Movie News', 'https://www.onmanorama.com/entertainment/movie-news.rss', true, 1),
      (8, 112, 'OneIndia Malayalam - Lifestyle', 'https://malayalam.oneindia.com/rss/feeds/malayalam-lifestyle-fb.xml', true, 1),
      (8, 112, 'Onmanorama - Lifestyle', 'https://www.onmanorama.com/lifestyle.rss', true, 1),
      (8, 113, 'OneIndia Malayalam - Education', 'https://malayalam.oneindia.com/rss/feeds/malayalam-education-fb.xml', true, 1),
      (8, 113, 'OneIndia Malayalam - Edu Jobs', 'https://malayalam.oneindia.com/rss/feeds/malayalam-jobs-fb.xml?cat=education', true, 1),
      (8, 114, 'OneIndia Malayalam - Jobs', 'https://malayalam.oneindia.com/rss/feeds/malayalam-jobs-fb.xml', true, 1),
      (8, 114, 'OneIndia Malayalam - Career Edu', 'https://malayalam.oneindia.com/rss/feeds/malayalam-education-fb.xml?cat=jobs', true, 1),
      (8, 115, 'OneIndia Malayalam - Agri', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=agri', true, 1),
      (8, 115, 'Onmanorama - Agri Kerala', 'https://www.onmanorama.com/news/kerala.rss?cat=agri', true, 1),
      (8, 116, 'OneIndia Malayalam - Auto', 'https://malayalam.oneindia.com/rss/feeds/malayalam-auto-fb.xml', true, 1),
      (8, 116, 'OneIndia Malayalam - Auto News', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=auto', true, 1),
      (8, 117, 'Onmanorama - Culture Life', 'https://www.onmanorama.com/lifestyle.rss?cat=culture', true, 1),
      (8, 117, 'OneIndia Malayalam - Culture', 'https://malayalam.oneindia.com/rss/feeds/malayalam-news-fb.xml?cat=culture', true, 1),
      (8, 118, 'OneIndia Malayalam - Travel', 'https://malayalam.oneindia.com/rss/feeds/malayalam-travel-fb.xml', true, 1),
      (8, 118, 'Onmanorama - Travel', 'https://www.onmanorama.com/lifestyle/travel.rss', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Malayalam RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Malayalam migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
