import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Bengali language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (5, 'Bengali', 'bn', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Bengali added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (55, 5, 'পশ্চিমবঙ্গ', true),
      (56, 5, 'ভারত', true),
      (57, 5, 'বিশ্ব', true),
      (58, 5, 'রাজনীতি', true),
      (59, 5, 'ব্যবসা', true),
      (60, 5, 'প্রযুক্তি', true),
      (61, 5, 'স্বাস্থ্য', true),
      (62, 5, 'খেলা', true),
      (63, 5, 'ক্রিকেট', true),
      (64, 5, 'বিনোদন', true),
      (65, 5, 'শিক্ষা', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Bengali categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (5, 55, 'OneIndia Bengali - West Bengal', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml', true, 1),
      (5, 55, 'Anandabazar - State', 'https://www.anandabazar.com/rss/state.xml', true, 1),
      (5, 56, 'OneIndia Bengali - India', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=india', true, 1),
      (5, 56, 'Anandabazar - India', 'https://www.anandabazar.com/rss/india.xml', true, 1),
      (5, 57, 'OneIndia Bengali - World', 'https://bengali.oneindia.com/rss/feeds/bengali-news-world-fb.xml', true, 1),
      (5, 57, 'Anandabazar - International', 'https://www.anandabazar.com/rss/international.xml', true, 1),
      (5, 58, 'Anandabazar - Politics', 'https://www.anandabazar.com/rss/politics.xml', true, 1),
      (5, 58, 'OneIndia Bengali - Politics', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=politics', true, 1),
      (5, 59, 'Anandabazar - Business', 'https://www.anandabazar.com/rss/business.xml', true, 1),
      (5, 59, 'OneIndia Bengali - Business', 'https://bengali.oneindia.com/rss/feeds/bengali-news-fb.xml?cat=business', true, 1),
      (5, 60, 'OneIndia Bengali - Technology', 'https://bengali.oneindia.com/rss/feeds/bengali-gadgets-fb.xml', true, 1),
      (5, 60, 'Anandabazar - Science & Tech', 'https://www.anandabazar.com/rss/science.xml', true, 1),
      (5, 61, 'OneIndia Bengali - Health', 'https://bengali.oneindia.com/rss/feeds/bengali-lifestyle-fb.xml', true, 1),
      (5, 61, 'Anandabazar - Lifestyle', 'https://www.anandabazar.com/rss/lifestyle.xml', true, 1),
      (5, 62, 'OneIndia Bengali - Sports', 'https://bengali.oneindia.com/rss/feeds/bengali-sports-fb.xml', true, 1),
      (5, 62, 'Anandabazar - Sports', 'https://www.anandabazar.com/rss/sports.xml', true, 1),
      (5, 63, 'OneIndia Bengali - Cricket', 'https://bengali.oneindia.com/rss/feeds/bengali-sports-cricket-fb.xml', true, 1),
      (5, 63, 'Anandabazar - Cricket', 'https://www.anandabazar.com/rss/cricket.xml', true, 1),
      (5, 64, 'OneIndia Bengali - Entertainment', 'https://bengali.oneindia.com/rss/feeds/bengali-entertainment-fb.xml', true, 1),
      (5, 64, 'Anandabazar - Entertainment', 'https://www.anandabazar.com/rss/entertainment.xml', true, 1),
      (5, 65, 'OneIndia Bengali - Education', 'https://bengali.oneindia.com/rss/feeds/bengali-education-fb.xml', true, 1),
      (5, 65, 'Anandabazar - Education', 'https://www.anandabazar.com/rss/career-and-education.xml', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Bengali RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Bengali migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
