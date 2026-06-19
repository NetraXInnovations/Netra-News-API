import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Kannada language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (7, 'Kannada', 'kn', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Kannada added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (81, 7, 'ಕರ್ನಾಟಕ', true),
      (82, 7, 'ಭಾರತ', true),
      (83, 7, 'ವಿಶ್ವ', true),
      (84, 7, 'ರಾಜಕೀಯ', true),
      (85, 7, 'ವಾಣಿಜ್ಯ', true),
      (86, 7, 'ತಂತ್ರಜ್ಞಾನ', true),
      (87, 7, 'ವಿಜ್ಞಾನ', true),
      (88, 7, 'ಆರೋಗ್ಯ', true),
      (89, 7, 'ಕ್ರೀಡೆ', true),
      (90, 7, 'ಕ್ರಿಕೆಟ್', true),
      (91, 7, 'ಮನರಂಜನೆ', true),
      (92, 7, 'ಸಿನಿಮಾ', true),
      (93, 7, 'ಜೀವನಶೈಲಿ', true),
      (94, 7, 'ಶಿಕ್ಷಣ', true),
      (95, 7, 'ಉದ್ಯೋಗಗಳು', true),
      (96, 7, 'ಕೃಷಿ', true),
      (97, 7, 'ಆಟೋಮೊಬೈಲ್', true),
      (98, 7, 'ಸಂಸ್ಕೃತಿ', true),
      (99, 7, 'ಪ್ರವಾಸೋದ್ಯಮ', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Kannada categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (7, 81, 'OneIndia Kannada - Karnataka', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml', true, 1),
      (7, 81, 'OneIndia Kannada - Bengaluru', 'https://kannada.oneindia.com/rss/feeds/kannada-bengaluru-fb.xml', true, 1),
      (7, 82, 'OneIndia Kannada - India', 'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml', true, 1),
      (7, 82, 'OneIndia Kannada - National', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=india', true, 1),
      (7, 83, 'OneIndia Kannada - World', 'https://kannada.oneindia.com/rss/feeds/kannada-news-world-fb.xml', true, 1),
      (7, 83, 'OneIndia Kannada - Int', 'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=world', true, 1),
      (7, 84, 'OneIndia Kannada - Politics', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=politics', true, 1),
      (7, 85, 'OneIndia Kannada - Business', 'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=business', true, 1),
      (7, 86, 'OneIndia Kannada - AI', 'https://kannada.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (7, 86, 'OneIndia Kannada - Gadgets', 'https://kannada.oneindia.com/rss/feeds/kannada-gadgets-fb.xml', true, 1),
      (7, 87, 'OneIndia Kannada - Science AI', 'https://kannada.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science', true, 1),
      (7, 87, 'OneIndia Kannada - Science Gadgets', 'https://kannada.oneindia.com/rss/feeds/kannada-gadgets-fb.xml?cat=science', true, 1),
      (7, 88, 'OneIndia Kannada - Lifestyle', 'https://kannada.oneindia.com/rss/feeds/kannada-lifestyle-fb.xml', true, 1),
      (7, 88, 'OneIndia Kannada - Health', 'https://kannada.oneindia.com/rss/feeds/kannada-health-fb.xml', true, 1),
      (7, 89, 'OneIndia Kannada - Sports', 'https://kannada.oneindia.com/rss/feeds/kannada-sports-fb.xml', true, 1),
      (7, 89, 'OneIndia Kannada - Sports News', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=sports', true, 1),
      (7, 90, 'OneIndia Kannada - Cricket', 'https://kannada.oneindia.com/rss/feeds/kannada-sports-cricket-fb.xml', true, 1),
      (7, 90, 'OneIndia Kannada - Cricket Sports', 'https://kannada.oneindia.com/rss/feeds/kannada-sports-fb.xml?cat=cricket', true, 1),
      (7, 91, 'OneIndia Kannada - Entertainment', 'https://kannada.oneindia.com/rss/feeds/kannada-entertainment-fb.xml', true, 1),
      (7, 91, 'OneIndia Kannada - Movie News', 'https://kannada.oneindia.com/rss/feeds/kannada-movie-news-fb.xml', true, 1),
      (7, 92, 'OneIndia Kannada - Movies', 'https://kannada.oneindia.com/rss/feeds/kannada-movie-news-fb.xml?cat=movies', true, 1),
      (7, 92, 'OneIndia Kannada - Cinema', 'https://kannada.oneindia.com/rss/feeds/kannada-entertainment-fb.xml?cat=cinema', true, 1),
      (7, 93, 'OneIndia Kannada - General Lifestyle', 'https://kannada.oneindia.com/rss/feeds/kannada-lifestyle-fb.xml?cat=lifestyle', true, 1),
      (7, 94, 'OneIndia Kannada - Education', 'https://kannada.oneindia.com/rss/feeds/kannada-education-fb.xml', true, 1),
      (7, 94, 'OneIndia Kannada - Edu Jobs', 'https://kannada.oneindia.com/rss/feeds/kannada-jobs-fb.xml?cat=education', true, 1),
      (7, 95, 'OneIndia Kannada - Jobs', 'https://kannada.oneindia.com/rss/feeds/kannada-jobs-fb.xml', true, 1),
      (7, 95, 'OneIndia Kannada - Career Edu', 'https://kannada.oneindia.com/rss/feeds/kannada-education-fb.xml?cat=jobs', true, 1),
      (7, 96, 'OneIndia Kannada - Agri', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=agri', true, 1),
      (7, 96, 'OneIndia Kannada - Agri Gen', 'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=agri', true, 1),
      (7, 97, 'OneIndia Kannada - Auto', 'https://kannada.oneindia.com/rss/feeds/kannada-auto-fb.xml', true, 1),
      (7, 97, 'OneIndia Kannada - Auto Tech', 'https://kannada.oneindia.com/rss/feeds/kannada-gadgets-fb.xml?cat=auto', true, 1),
      (7, 98, 'OneIndia Kannada - Culture', 'https://kannada.oneindia.com/rss/feeds/kannada-news-fb.xml?cat=culture', true, 1),
      (7, 98, 'OneIndia Kannada - Culture Gen', 'https://kannada.oneindia.com/rss/feeds/oneindia-kannada-fb.xml?cat=culture', true, 1),
      (7, 99, 'OneIndia Kannada - Travel', 'https://kannada.oneindia.com/rss/feeds/kannada-travel-fb.xml', true, 1),
      (7, 99, 'OneIndia Kannada - Travel Life', 'https://kannada.oneindia.com/rss/feeds/kannada-lifestyle-fb.xml?cat=travel', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Kannada RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Kannada migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
