import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Filipino language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (17, 'Filipino', 'tl', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Filipino added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (268, 17, 'Pilipinas', true),
      (269, 17, 'Metro Manila', true),
      (270, 17, 'Mundo', true),
      (271, 17, 'Pulitika', true),
      (272, 17, 'Negosyo', true),
      (273, 17, 'Teknolohiya', true),
      (274, 17, 'Agham', true),
      (275, 17, 'Kalusugan', true),
      (276, 17, 'Palakasan', true),
      (277, 17, 'Basketball', true),
      (278, 17, 'Aliwan', true),
      (279, 17, 'Edukasyon', true),
      (280, 17, 'Kultura', true),
      (281, 17, 'Pamumuhay', true),
      (282, 17, 'Paglalakbay', true),
      (283, 17, 'Sasakyan', true),
      (284, 17, 'Startup', true),
      (285, 17, 'Kasalukuyang Pangyayari', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Filipino categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (17, 268, 'Philstar - Pilipinas', 'https://www.philstar.com/rss/headlines', true, 1),
      (17, 268, 'GMA News - Pilipinas', 'https://www.gmanetwork.com/news/rss/news/nation/feed.xml', true, 1),
      (17, 269, 'GMA News - Metro Manila', 'https://www.gmanetwork.com/news/rss/news/metro/feed.xml', true, 1),
      (17, 269, 'Philstar - Metro Manila', 'https://www.philstar.com/rss/headlines?cat=metromanila', true, 1),
      (17, 270, 'GMA News - Mundo', 'https://www.gmanetwork.com/news/rss/news/world/feed.xml', true, 1),
      (17, 270, 'Philstar - Mundo', 'https://www.philstar.com/rss/world', true, 1),
      (17, 271, 'Philstar - Pulitika', 'https://www.philstar.com/rss/headlines?cat=politics', true, 1),
      (17, 271, 'GMA News - Pulitika', 'https://www.gmanetwork.com/news/rss/news/nation/feed.xml?cat=politics', true, 1),
      (17, 272, 'Philstar - Negosyo', 'https://www.philstar.com/rss/business', true, 1),
      (17, 272, 'GMA News - Negosyo', 'https://www.gmanetwork.com/news/rss/money/feed.xml', true, 1),
      (17, 273, 'GMA News - Teknolohiya', 'https://www.gmanetwork.com/news/rss/scitech/feed.xml', true, 1),
      (17, 273, 'Philstar - Teknolohiya', 'https://www.philstar.com/rss/technology', true, 1),
      (17, 274, 'GMA News - Agham', 'https://www.gmanetwork.com/news/rss/scitech/feed.xml?cat=science', true, 1),
      (17, 274, 'Philstar - Agham', 'https://www.philstar.com/rss/technology?cat=science', true, 1),
      (17, 275, 'GMA News - Kalusugan', 'https://www.gmanetwork.com/news/rss/lifestyle/healthandwellness/feed.xml', true, 1),
      (17, 275, 'Philstar - Kalusugan', 'https://www.philstar.com/rss/lifestyle?cat=health', true, 1),
      (17, 276, 'GMA News - Palakasan', 'https://www.gmanetwork.com/news/rss/sports/feed.xml', true, 1),
      (17, 276, 'Philstar - Palakasan', 'https://www.philstar.com/rss/sports', true, 1),
      (17, 277, 'GMA News - Basketball', 'https://www.gmanetwork.com/news/rss/sports/feed.xml?cat=basketball', true, 1),
      (17, 277, 'Philstar - Basketball', 'https://www.philstar.com/rss/sports?cat=basketball', true, 1),
      (17, 278, 'GMA News - Aliwan', 'https://www.gmanetwork.com/news/rss/showbiz/feed.xml', true, 1),
      (17, 278, 'Philstar - Aliwan', 'https://www.philstar.com/rss/entertainment', true, 1),
      (17, 279, 'Philstar - Edukasyon', 'https://www.philstar.com/rss/headlines?cat=education', true, 1),
      (17, 279, 'GMA News - Edukasyon', 'https://www.gmanetwork.com/news/rss/news/nation/feed.xml?cat=education', true, 1),
      (17, 280, 'GMA News - Kultura', 'https://www.gmanetwork.com/news/rss/lifestyle/feed.xml?cat=culture', true, 1),
      (17, 280, 'Philstar - Kultura', 'https://www.philstar.com/rss/lifestyle?cat=culture', true, 1),
      (17, 281, 'GMA News - Pamumuhay', 'https://www.gmanetwork.com/news/rss/lifestyle/feed.xml', true, 1),
      (17, 281, 'Philstar - Pamumuhay', 'https://www.philstar.com/rss/lifestyle', true, 1),
      (17, 282, 'GMA News - Paglalakbay', 'https://www.gmanetwork.com/news/rss/lifestyle/feed.xml?cat=travel', true, 1),
      (17, 282, 'Philstar - Paglalakbay', 'https://www.philstar.com/rss/lifestyle?cat=travel', true, 1),
      (17, 283, 'TopGear - Sasakyan', 'https://www.topgear.com.ph/rss', true, 1),
      (17, 283, 'Philstar - Sasakyan', 'https://www.philstar.com/rss/business?cat=auto', true, 1),
      (17, 284, 'GMA News - Startup', 'https://www.gmanetwork.com/news/rss/money/feed.xml?cat=startup', true, 1),
      (17, 284, 'Philstar - Startup', 'https://www.philstar.com/rss/business?cat=startup', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Filipino RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Filipino migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
