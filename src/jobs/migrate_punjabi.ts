import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Punjabi language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (11, 'Punjabi', 'pa', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Punjabi added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (162, 11, 'ਪੰਜਾਬ', true),
      (163, 11, 'ਚੰਡੀਗੜ੍ਹ', true),
      (164, 11, 'ਭਾਰਤ', true),
      (165, 11, 'ਦੁਨੀਆ', true),
      (166, 11, 'ਰਾਜਨੀਤੀ', true),
      (167, 11, 'ਕਾਰੋਬਾਰ', true),
      (168, 11, 'ਟੈਕਨੋਲੋਜੀ', true),
      (169, 11, 'ਵਿਗਿਆਨ', true),
      (170, 11, 'ਸਿਹਤ', true),
      (171, 11, 'ਖੇਡਾਂ', true),
      (172, 11, 'ਕ੍ਰਿਕਟ', true),
      (173, 11, 'ਮਨੋਰੰਜਨ', true),
      (174, 11, 'ਫ਼ਿਲਮਾਂ', true),
      (175, 11, 'ਸਿੱਖਿਆ', true),
      (176, 11, 'ਨੌਕਰੀਆਂ', true),
      (177, 11, 'ਜੀਵਨ ਸ਼ੈਲੀ', true),
      (178, 11, 'ਖੇਤੀਬਾੜੀ', true),
      (179, 11, 'ਆਟੋ', true),
      (180, 11, 'ਸੱਭਿਆਚਾਰ', true),
      (181, 11, 'ਯਾਤਰਾ', true),
      (182, 11, 'ਸਟਾਰਟਅਪ', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Punjabi categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (11, 162, 'OneIndia Punjabi - Punjab', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 162, 'Punjabi Tribune - Punjab', 'https://www.punjabitribuneonline.com/feed/', true, 1),
      (11, 163, 'Punjabi Tribune - Chandigarh', 'https://www.punjabitribuneonline.com/feed/', true, 1),
      (11, 163, 'OneIndia Punjabi - Chandigarh', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 164, 'OneIndia Punjabi - India', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 164, 'Jagbani - National', 'https://www.jagbani.com/rss/news/national.xml', true, 1),
      (11, 165, 'OneIndia Punjabi - World', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-world-fb.xml', true, 1),
      (11, 165, 'Jagbani - International', 'https://www.jagbani.com/rss/news/international.xml', true, 1),
      (11, 166, 'Jagbani - Politics', 'https://www.jagbani.com/rss/news/politics.xml', true, 1),
      (11, 166, 'OneIndia Punjabi - Politics', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 167, 'Jagbani - Business', 'https://www.jagbani.com/rss/business.xml', true, 1),
      (11, 167, 'OneIndia Punjabi - Business', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 168, 'OneIndia Punjabi - Tech AI', 'https://punjabi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (11, 168, 'Jagbani - Technology', 'https://www.jagbani.com/rss/technology.xml', true, 1),
      (11, 169, 'OneIndia Punjabi - Science AI', 'https://punjabi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (11, 169, 'Jagbani - Science', 'https://www.jagbani.com/rss/technology.xml', true, 1),
      (11, 170, 'OneIndia Punjabi - Health', 'https://punjabi.oneindia.com/rss/feeds/punjabi-lifestyle-fb.xml', true, 1),
      (11, 170, 'Jagbani - Health', 'https://www.jagbani.com/rss/health.xml', true, 1),
      (11, 171, 'OneIndia Punjabi - Sports', 'https://punjabi.oneindia.com/rss/feeds/punjabi-sports-fb.xml', true, 1),
      (11, 171, 'Jagbani - Sports', 'https://www.jagbani.com/rss/sports.xml', true, 1),
      (11, 172, 'OneIndia Punjabi - Cricket', 'https://punjabi.oneindia.com/rss/feeds/punjabi-sports-cricket-fb.xml', true, 1),
      (11, 172, 'Jagbani - Cricket', 'https://www.jagbani.com/rss/cricket.xml', true, 1),
      (11, 173, 'OneIndia Punjabi - Entertainment', 'https://punjabi.oneindia.com/rss/feeds/punjabi-entertainment-fb.xml', true, 1),
      (11, 173, 'Jagbani - Entertainment', 'https://www.jagbani.com/rss/entertainment.xml', true, 1),
      (11, 174, 'OneIndia Punjabi - Movies', 'https://punjabi.oneindia.com/rss/feeds/punjabi-entertainment-fb.xml', true, 1),
      (11, 174, 'Jagbani - Movies', 'https://www.jagbani.com/rss/entertainment.xml', true, 1),
      (11, 175, 'OneIndia Punjabi - Education', 'https://punjabi.oneindia.com/rss/feeds/punjabi-education-fb.xml', true, 1),
      (11, 175, 'Jagbani - Career', 'https://www.jagbani.com/rss/career.xml', true, 1),
      (11, 176, 'OneIndia Punjabi - Jobs', 'https://punjabi.oneindia.com/rss/feeds/punjabi-jobs-fb.xml', true, 1),
      (11, 176, 'Jagbani - Jobs', 'https://www.jagbani.com/rss/career.xml', true, 1),
      (11, 177, 'OneIndia Punjabi - Lifestyle', 'https://punjabi.oneindia.com/rss/feeds/punjabi-lifestyle-fb.xml', true, 1),
      (11, 177, 'Jagbani - Lifestyle', 'https://www.jagbani.com/rss/lifestyle.xml', true, 1),
      (11, 178, 'Jagbani - Agriculture', 'https://www.jagbani.com/rss/agriculture.xml', true, 1),
      (11, 178, 'OneIndia Punjabi - Agriculture', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 179, 'OneIndia Punjabi - Auto', 'https://punjabi.oneindia.com/rss/feeds/punjabi-auto-fb.xml', true, 1),
      (11, 179, 'Jagbani - Auto', 'https://www.jagbani.com/rss/auto.xml', true, 1),
      (11, 180, 'Punjabi Tribune - Culture', 'https://www.punjabitribuneonline.com/feed/', true, 1),
      (11, 180, 'OneIndia Punjabi - Culture', 'https://punjabi.oneindia.com/rss/feeds/punjabi-news-fb.xml', true, 1),
      (11, 181, 'OneIndia Punjabi - Travel', 'https://punjabi.oneindia.com/rss/feeds/punjabi-travel-fb.xml', true, 1),
      (11, 181, 'OneIndia Punjabi - Travel Life', 'https://punjabi.oneindia.com/rss/feeds/punjabi-lifestyle-fb.xml', true, 1),
      (11, 182, 'Jagbani - Startups', 'https://www.jagbani.com/rss/business.xml', true, 1),
      (11, 182, 'OneIndia Punjabi - Startups AI', 'https://punjabi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Punjabi RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Punjabi migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
