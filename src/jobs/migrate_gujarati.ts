import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Gujarati language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (6, 'Gujarati', 'gu', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Gujarati added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (66, 6, 'ગુજરાત', true),
      (67, 6, 'ભારત', true),
      (68, 6, 'વિશ્વ', true),
      (69, 6, 'રાજકારણ', true),
      (70, 6, 'બિઝનેસ', true),
      (71, 6, 'ટેક્નોલોજી', true),
      (72, 6, 'વિજ્ઞાન', true),
      (73, 6, 'આરોગ્ય', true),
      (74, 6, 'રમતગમત', true),
      (75, 6, 'ક્રિકેટ', true),
      (76, 6, 'મનોરંજન', true),
      (77, 6, 'શિક્ષણ', true),
      (78, 6, 'નોકરીઓ', true),
      (79, 6, 'ઓટો', true),
      (80, 6, 'કૃષિ', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Gujarati categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (6, 66, 'OneIndia Gujarati - Gujarat', 'https://gujarati.oneindia.com/rss/feeds/gujarati-news-fb.xml?cat=gujarat', true, 1),
      (6, 66, 'TV9 Gujarati - State', 'https://tv9gujarati.com/rss/state-news.xml', true, 1),
      (6, 67, 'OneIndia Gujarati - India', 'https://gujarati.oneindia.com/rss/feeds/oneindia-gujarati-fb.xml?cat=india', true, 1),
      (6, 67, 'TV9 Gujarati - National', 'https://tv9gujarati.com/rss/national-news.xml', true, 1),
      (6, 68, 'OneIndia Gujarati - World', 'https://gujarati.oneindia.com/rss/feeds/gujarati-news-world-fb.xml', true, 1),
      (6, 68, 'TV9 Gujarati - World', 'https://tv9gujarati.com/rss/world-news.xml', true, 1),
      (6, 69, 'TV9 Gujarati - Politics', 'https://tv9gujarati.com/rss/politics-news.xml', true, 1),
      (6, 69, 'OneIndia Gujarati - Politics', 'https://gujarati.oneindia.com/rss/feeds/oneindia-gujarati-fb.xml?cat=politics', true, 1),
      (6, 70, 'TV9 Gujarati - Business', 'https://tv9gujarati.com/rss/business-news.xml', true, 1),
      (6, 70, 'OneIndia Gujarati - Business', 'https://gujarati.oneindia.com/rss/feeds/gujarati-news-fb.xml?cat=business', true, 1),
      (6, 71, 'OneIndia Gujarati - Technology', 'https://gujarati.oneindia.com/rss/feeds/gujarati-gadgets-fb.xml?cat=tech', true, 1),
      (6, 71, 'TV9 Gujarati - Technology', 'https://tv9gujarati.com/rss/technology-news.xml', true, 1),
      (6, 72, 'OneIndia Gujarati - Science', 'https://gujarati.oneindia.com/rss/feeds/gujarati-gadgets-fb.xml?cat=science', true, 1),
      (6, 72, 'TV9 Gujarati - Science', 'https://tv9gujarati.com/rss/technology-news.xml?cat=science', true, 1),
      (6, 73, 'OneIndia Gujarati - Health', 'https://gujarati.oneindia.com/rss/feeds/gujarati-lifestyle-fb.xml?cat=health', true, 1),
      (6, 73, 'TV9 Gujarati - Health', 'https://tv9gujarati.com/rss/health-news.xml', true, 1),
      (6, 74, 'OneIndia Gujarati - Sports', 'https://gujarati.oneindia.com/rss/feeds/gujarati-sports-fb.xml', true, 1),
      (6, 74, 'TV9 Gujarati - Sports', 'https://tv9gujarati.com/rss/sports-news.xml', true, 1),
      (6, 75, 'OneIndia Gujarati - Cricket', 'https://gujarati.oneindia.com/rss/feeds/gujarati-sports-cricket-fb.xml', true, 1),
      (6, 75, 'TV9 Gujarati - Cricket', 'https://tv9gujarati.com/rss/cricket-news.xml', true, 1),
      (6, 76, 'OneIndia Gujarati - Entertainment', 'https://gujarati.oneindia.com/rss/feeds/gujarati-entertainment-fb.xml', true, 1),
      (6, 76, 'TV9 Gujarati - Entertainment', 'https://tv9gujarati.com/rss/entertainment-news.xml', true, 1),
      (6, 77, 'OneIndia Gujarati - Education', 'https://gujarati.oneindia.com/rss/feeds/gujarati-education-fb.xml', true, 1),
      (6, 77, 'TV9 Gujarati - Education', 'https://tv9gujarati.com/rss/education-news.xml', true, 1),
      (6, 78, 'OneIndia Gujarati - Jobs', 'https://gujarati.oneindia.com/rss/feeds/gujarati-jobs-fb.xml', true, 1),
      (6, 78, 'TV9 Gujarati - Jobs', 'https://tv9gujarati.com/rss/career-news.xml', true, 1),
      (6, 79, 'OneIndia Gujarati - Auto', 'https://gujarati.oneindia.com/rss/feeds/gujarati-auto-fb.xml', true, 1),
      (6, 79, 'TV9 Gujarati - Auto', 'https://tv9gujarati.com/rss/auto-news.xml', true, 1),
      (6, 80, 'TV9 Gujarati - Agriculture', 'https://tv9gujarati.com/rss/agriculture-news.xml', true, 1),
      (6, 80, 'OneIndia Gujarati - Agriculture', 'https://gujarati.oneindia.com/rss/feeds/gujarati-news-fb.xml?cat=agri', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Gujarati RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Gujarati migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
