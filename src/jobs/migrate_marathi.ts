import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Marathi language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (9, 'Marathi', 'mr', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Marathi added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (119, 9, 'मुंबई', true),
      (120, 9, 'महाराष्ट्र', true),
      (121, 9, 'भारत', true),
      (122, 9, 'जग', true),
      (123, 9, 'राजकारण', true),
      (124, 9, 'व्यवसाय', true),
      (125, 9, 'तंत्रज्ञान', true),
      (126, 9, 'विज्ञान', true),
      (127, 9, 'आरोग्य', true),
      (128, 9, 'महिला', true),
      (129, 9, 'क्रीडा', true),
      (130, 9, 'क्रिकेट', true),
      (131, 9, 'मनोरंजन', true),
      (132, 9, 'चित्रपट', true),
      (133, 9, 'जीवनशैली', true),
      (134, 9, 'शिक्षण', true),
      (135, 9, 'नोकरी', true),
      (136, 9, 'कृषी', true),
      (137, 9, 'ऑटोमोबाईल', true),
      (138, 9, 'प्रवास', true),
      (139, 9, 'संस्कृती', true),
      (140, 9, 'स्टार्टअप्स', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Marathi categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (9, 119, 'OneIndia Marathi - Mumbai', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=mumbai', true, 1),
      (9, 119, 'Lokmat - Mumbai', 'https://www.lokmat.com/rss/mumbai.xml', true, 1),
      (9, 120, 'OneIndia Marathi - Maharashtra', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=maharashtra', true, 1),
      (9, 120, 'Lokmat - Maharashtra', 'https://www.lokmat.com/rss/maharashtra.xml', true, 1),
      (9, 121, 'OneIndia Marathi - India', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=india', true, 1),
      (9, 121, 'Lokmat - National', 'https://www.lokmat.com/rss/national.xml', true, 1),
      (9, 122, 'OneIndia Marathi - World', 'https://marathi.oneindia.com/rss/feeds/marathi-news-world-fb.xml', true, 1),
      (9, 122, 'Lokmat - International', 'https://www.lokmat.com/rss/international.xml', true, 1),
      (9, 123, 'Lokmat - Politics', 'https://www.lokmat.com/rss/politics.xml', true, 1),
      (9, 123, 'OneIndia Marathi - Politics', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=politics', true, 1),
      (9, 124, 'Lokmat - Business', 'https://www.lokmat.com/rss/business.xml', true, 1),
      (9, 124, 'OneIndia Marathi - Business', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=business', true, 1),
      (9, 125, 'OneIndia Marathi - Tech AI', 'https://marathi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (9, 125, 'OneIndia Marathi - Gadgets', 'https://marathi.oneindia.com/rss/feeds/marathi-gadgets-fb.xml', true, 1),
      (9, 126, 'OneIndia Marathi - Science AI', 'https://marathi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science', true, 1),
      (9, 126, 'OneIndia Marathi - Science Gadgets', 'https://marathi.oneindia.com/rss/feeds/marathi-gadgets-fb.xml?cat=science', true, 1),
      (9, 127, 'OneIndia Marathi - Health Life', 'https://marathi.oneindia.com/rss/feeds/marathi-lifestyle-fb.xml?cat=health', true, 1),
      (9, 127, 'Lokmat - Health', 'https://www.lokmat.com/rss/health.xml', true, 1),
      (9, 128, 'OneIndia Marathi - Women Life', 'https://marathi.oneindia.com/rss/feeds/marathi-lifestyle-fb.xml?cat=women', true, 1),
      (9, 128, 'Lokmat - Women', 'https://www.lokmat.com/rss/women.xml', true, 1),
      (9, 129, 'OneIndia Marathi - Sports', 'https://marathi.oneindia.com/rss/feeds/marathi-sports-fb.xml', true, 1),
      (9, 129, 'Lokmat - Sports', 'https://www.lokmat.com/rss/sports.xml', true, 1),
      (9, 130, 'OneIndia Marathi - Cricket', 'https://marathi.oneindia.com/rss/feeds/marathi-sports-cricket-fb.xml', true, 1),
      (9, 130, 'Lokmat - Cricket', 'https://www.lokmat.com/rss/cricket.xml', true, 1),
      (9, 131, 'OneIndia Marathi - Entertainment', 'https://marathi.oneindia.com/rss/feeds/marathi-entertainment-fb.xml', true, 1),
      (9, 131, 'Lokmat - Entertainment', 'https://www.lokmat.com/rss/entertainment.xml', true, 1),
      (9, 132, 'OneIndia Marathi - Movies', 'https://marathi.oneindia.com/rss/feeds/marathi-movies-fb.xml', true, 1),
      (9, 132, 'OneIndia Marathi - Cinema', 'https://marathi.oneindia.com/rss/feeds/marathi-entertainment-fb.xml?cat=movies', true, 1),
      (9, 133, 'OneIndia Marathi - Lifestyle', 'https://marathi.oneindia.com/rss/feeds/marathi-lifestyle-fb.xml', true, 1),
      (9, 133, 'Lokmat - Lifestyle', 'https://www.lokmat.com/rss/lifestyle.xml', true, 1),
      (9, 134, 'OneIndia Marathi - Education', 'https://marathi.oneindia.com/rss/feeds/marathi-education-fb.xml', true, 1),
      (9, 134, 'OneIndia Marathi - Edu Jobs', 'https://marathi.oneindia.com/rss/feeds/marathi-jobs-fb.xml?cat=education', true, 1),
      (9, 135, 'OneIndia Marathi - Jobs', 'https://marathi.oneindia.com/rss/feeds/marathi-jobs-fb.xml', true, 1),
      (9, 135, 'OneIndia Marathi - Career Edu', 'https://marathi.oneindia.com/rss/feeds/marathi-education-fb.xml?cat=jobs', true, 1),
      (9, 136, 'Lokmat - Agriculture', 'https://www.lokmat.com/rss/agriculture.xml', true, 1),
      (9, 136, 'OneIndia Marathi - Agri News', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=agri', true, 1),
      (9, 137, 'OneIndia Marathi - Auto', 'https://marathi.oneindia.com/rss/feeds/marathi-auto-fb.xml', true, 1),
      (9, 137, 'OneIndia Marathi - Auto Gadgets', 'https://marathi.oneindia.com/rss/feeds/marathi-gadgets-fb.xml?cat=auto', true, 1),
      (9, 138, 'OneIndia Marathi - Travel', 'https://marathi.oneindia.com/rss/feeds/marathi-travel-fb.xml', true, 1),
      (9, 138, 'OneIndia Marathi - Travel Life', 'https://marathi.oneindia.com/rss/feeds/marathi-lifestyle-fb.xml?cat=travel', true, 1),
      (9, 139, 'OneIndia Marathi - Culture', 'https://marathi.oneindia.com/rss/feeds/marathi-news-fb.xml?cat=culture', true, 1),
      (9, 139, 'Lokmat - Culture Life', 'https://www.lokmat.com/rss/lifestyle.xml?cat=culture', true, 1),
      (9, 140, 'OneIndia Marathi - Startups AI', 'https://marathi.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=startups', true, 1),
      (9, 140, 'Lokmat - Startups Biz', 'https://www.lokmat.com/rss/business.xml?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Marathi RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Marathi migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
