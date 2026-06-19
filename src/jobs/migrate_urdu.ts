import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Urdu language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (12, 'Urdu', 'ur', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Urdu added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (183, 12, 'پاکستان', true),
      (184, 12, 'ہندوستان', true),
      (185, 12, 'دنیا', true),
      (186, 12, 'سیاست', true),
      (187, 12, 'کاروبار', true),
      (188, 12, 'ٹیکنالوجی', true),
      (189, 12, 'سائنس', true),
      (190, 12, 'صحت', true),
      (191, 12, 'کھیل', true),
      (192, 12, 'کرکٹ', true),
      (193, 12, 'تفریح', true),
      (194, 12, 'تعلیم', true),
      (195, 12, 'طرزِ زندگی', true),
      (196, 12, 'زراعت', true),
      (197, 12, 'آٹو', true),
      (198, 12, 'ثقافت', true),
      (199, 12, 'سفر', true),
      (200, 12, 'اسٹارٹ اپس', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Urdu categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (12, 183, 'UrduPoint - Pakistan', 'https://urdupoint.com/rss/pakistan.xml', true, 1),
      (12, 183, 'BBC Urdu - Pakistan', 'https://www.bbc.com/urdu/index.xml', true, 1),
      (12, 184, 'Inquilab - India', 'https://www.inquilab.com/rss/news.xml', true, 1),
      (12, 184, 'UrduPoint - World (India)', 'https://urdupoint.com/rss/world.xml', true, 1),
      (12, 185, 'UrduPoint - World', 'https://urdupoint.com/rss/world.xml', true, 1),
      (12, 185, 'BBC Urdu - World', 'https://www.bbc.com/urdu/index.xml', true, 1),
      (12, 186, 'Inquilab - Politics', 'https://www.inquilab.com/rss/news.xml', true, 1),
      (12, 186, 'UrduPoint - Politics (Pakistan)', 'https://urdupoint.com/rss/pakistan.xml', true, 1),
      (12, 187, 'UrduPoint - Business', 'https://urdupoint.com/rss/business.xml', true, 1),
      (12, 187, 'Inquilab - Business', 'https://www.inquilab.com/rss/business.xml', true, 1),
      (12, 188, 'UrduPoint - Technology', 'https://urdupoint.com/rss/technology.xml', true, 1),
      (12, 188, 'BBC Urdu - Technology', 'https://www.bbc.com/urdu/index.xml', true, 1),
      (12, 189, 'UrduPoint - Science', 'https://urdupoint.com/rss/science.xml', true, 1),
      (12, 189, 'UrduPoint - Tech (Science)', 'https://urdupoint.com/rss/technology.xml', true, 1),
      (12, 190, 'UrduPoint - Health', 'https://urdupoint.com/rss/health.xml', true, 1),
      (12, 190, 'UrduPoint - Lifestyle (Health)', 'https://urdupoint.com/rss/lifestyle.xml', true, 1),
      (12, 191, 'UrduPoint - Sports', 'https://urdupoint.com/rss/sports.xml', true, 1),
      (12, 191, 'Inquilab - Sports', 'https://www.inquilab.com/rss/sports.xml', true, 1),
      (12, 192, 'UrduPoint - Cricket', 'https://urdupoint.com/rss/cricket.xml', true, 1),
      (12, 192, 'UrduPoint - Sports (Cricket)', 'https://urdupoint.com/rss/sports.xml', true, 1),
      (12, 193, 'UrduPoint - Showbiz', 'https://urdupoint.com/rss/showbiz.xml', true, 1),
      (12, 193, 'Inquilab - Entertainment', 'https://www.inquilab.com/rss/entertainment.xml', true, 1),
      (12, 194, 'UrduPoint - Education', 'https://urdupoint.com/rss/education.xml', true, 1),
      (12, 194, 'BBC Urdu - Education', 'https://www.bbc.com/urdu/index.xml', true, 1),
      (12, 195, 'UrduPoint - Lifestyle', 'https://urdupoint.com/rss/lifestyle.xml', true, 1),
      (12, 195, 'UrduPoint - Health (Lifestyle)', 'https://urdupoint.com/rss/health.xml', true, 1),
      (12, 196, 'UrduPoint - Agriculture', 'https://urdupoint.com/rss/agriculture.xml', true, 1),
      (12, 196, 'UrduPoint - Business (Agriculture)', 'https://urdupoint.com/rss/business.xml', true, 1),
      (12, 197, 'UrduPoint - Auto', 'https://urdupoint.com/rss/auto.xml', true, 1),
      (12, 197, 'UrduPoint - Tech (Auto)', 'https://urdupoint.com/rss/technology.xml', true, 1),
      (12, 198, 'BBC Urdu - Culture', 'https://www.bbc.com/urdu/index.xml', true, 1),
      (12, 198, 'UrduPoint - Lifestyle (Culture)', 'https://urdupoint.com/rss/lifestyle.xml', true, 1),
      (12, 199, 'UrduPoint - Travel', 'https://urdupoint.com/rss/travel.xml', true, 1),
      (12, 199, 'UrduPoint - Lifestyle (Travel)', 'https://urdupoint.com/rss/lifestyle.xml', true, 1),
      (12, 200, 'UrduPoint - Business (Startups)', 'https://urdupoint.com/rss/business.xml', true, 1),
      (12, 200, 'UrduPoint - Tech (Startups)', 'https://urdupoint.com/rss/technology.xml', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Urdu RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Urdu migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
