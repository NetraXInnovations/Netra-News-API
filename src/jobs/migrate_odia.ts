import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Odia language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (10, 'Odia', 'or', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Odia added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (141, 10, 'ଓଡ଼ିଶା', true),
      (142, 10, 'ଭୁବନେଶ୍ୱର', true),
      (143, 10, 'ଭାରତ', true),
      (144, 10, 'ବିଶ୍ୱ', true),
      (145, 10, 'ରାଜନୀତି', true),
      (146, 10, 'ବ୍ୟବସାୟ', true),
      (147, 10, 'ପ୍ରଯୁକ୍ତି', true),
      (148, 10, 'ବିଜ୍ଞାନ', true),
      (149, 10, 'ସ୍ୱାସ୍ଥ୍ୟ', true),
      (150, 10, 'କ୍ରୀଡା', true),
      (151, 10, 'କ୍ରିକେଟ', true),
      (152, 10, 'ମନୋରଞ୍ଜନ', true),
      (153, 10, 'ସିନେମା', true),
      (154, 10, 'ଶିକ୍ଷା', true),
      (155, 10, 'ଚାକିରି', true),
      (156, 10, 'ଜୀବନଶୈଳୀ', true),
      (157, 10, 'କୃଷି', true),
      (158, 10, 'ଅଟୋ', true),
      (159, 10, 'ସଂସ୍କୃତି', true),
      (160, 10, 'ଭ୍ରମଣ', true),
      (161, 10, 'ଷ୍ଟାର୍ଟଅପ୍', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Odia categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (10, 141, 'OneIndia Odia - Odisha', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml', true, 1),
      (10, 141, 'Sambad - Odisha', 'https://sambad.in/feed', true, 1),
      (10, 142, 'Sambad - Bhubaneswar', 'https://sambad.in/metro/feed', true, 1),
      (10, 142, 'OneIndia Odia - Bhubaneswar', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=bhubaneswar', true, 1),
      (10, 143, 'OneIndia Odia - India', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=india', true, 1),
      (10, 143, 'Sambad - India', 'https://sambad.in/india-and-beyond/feed', true, 1),
      (10, 144, 'OneIndia Odia - World', 'https://odia.oneindia.com/rss/feeds/odia-news-world-fb.xml', true, 1),
      (10, 144, 'Sambad - World', 'https://sambad.in/international/feed', true, 1),
      (10, 145, 'Sambad - Politics', 'https://sambad.in/politics/feed', true, 1),
      (10, 145, 'OneIndia Odia - Politics', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=politics', true, 1),
      (10, 146, 'Sambad - Business', 'https://sambad.in/business/feed', true, 1),
      (10, 146, 'OneIndia Odia - Business', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=business', true, 1),
      (10, 147, 'OneIndia Odia - Tech AI', 'https://odia.oneindia.com/rss/feeds/artificial-intelligence-fb.xml', true, 1),
      (10, 147, 'Sambad - Tech', 'https://sambad.in/technology/feed', true, 1),
      (10, 148, 'Sambad - Science', 'https://sambad.in/science/feed', true, 1),
      (10, 148, 'OneIndia Odia - Science AI', 'https://odia.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=science', true, 1),
      (10, 149, 'Sambad - Health', 'https://sambad.in/lifestyle/health/feed', true, 1),
      (10, 149, 'OneIndia Odia - Health', 'https://odia.oneindia.com/rss/feeds/odia-lifestyle-fb.xml?cat=health', true, 1),
      (10, 150, 'Sambad - Sports', 'https://sambad.in/sports/feed', true, 1),
      (10, 150, 'OneIndia Odia - Sports', 'https://odia.oneindia.com/rss/feeds/odia-sports-fb.xml', true, 1),
      (10, 151, 'OneIndia Odia - Cricket', 'https://odia.oneindia.com/rss/feeds/odia-sports-cricket-fb.xml', true, 1),
      (10, 151, 'Sambad - Cricket', 'https://sambad.in/sports/feed?cat=cricket', true, 1),
      (10, 152, 'OneIndia Odia - Entertainment', 'https://odia.oneindia.com/rss/feeds/odia-entertainment-fb.xml', true, 1),
      (10, 152, 'Sambad - Entertainment', 'https://sambad.in/entertainment/feed', true, 1),
      (10, 153, 'OneIndia Odia - Movies', 'https://odia.oneindia.com/rss/feeds/odia-entertainment-fb.xml?cat=movies', true, 1),
      (10, 153, 'Sambad - Movies', 'https://sambad.in/entertainment/feed?cat=movies', true, 1),
      (10, 154, 'OneIndia Odia - Education', 'https://odia.oneindia.com/rss/feeds/odia-education-fb.xml', true, 1),
      (10, 154, 'Sambad - Education', 'https://sambad.in/career-and-campus/feed', true, 1),
      (10, 155, 'OneIndia Odia - Jobs', 'https://odia.oneindia.com/rss/feeds/odia-jobs-fb.xml', true, 1),
      (10, 155, 'Sambad - Jobs', 'https://sambad.in/career-and-campus/feed?cat=jobs', true, 1),
      (10, 156, 'OneIndia Odia - Lifestyle', 'https://odia.oneindia.com/rss/feeds/odia-lifestyle-fb.xml', true, 1),
      (10, 156, 'Sambad - Lifestyle', 'https://sambad.in/lifestyle/feed', true, 1),
      (10, 157, 'Sambad - Agriculture', 'https://sambad.in/agriculture/feed', true, 1),
      (10, 157, 'OneIndia Odia - Agriculture', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=agri', true, 1),
      (10, 158, 'OneIndia Odia - Auto', 'https://odia.oneindia.com/rss/feeds/odia-auto-fb.xml', true, 1),
      (10, 158, 'Sambad - Auto', 'https://sambad.in/auto/feed', true, 1),
      (10, 159, 'Sambad - Culture', 'https://sambad.in/culture/feed', true, 1),
      (10, 159, 'OneIndia Odia - Culture', 'https://odia.oneindia.com/rss/feeds/odia-news-fb.xml?cat=culture', true, 1),
      (10, 160, 'OneIndia Odia - Travel', 'https://odia.oneindia.com/rss/feeds/odia-travel-fb.xml', true, 1),
      (10, 160, 'Sambad - Travel', 'https://sambad.in/travel/feed', true, 1),
      (10, 161, 'Sambad - Startups', 'https://sambad.in/business/feed?cat=startups', true, 1),
      (10, 161, 'OneIndia Odia - Startups', 'https://odia.oneindia.com/rss/feeds/artificial-intelligence-fb.xml?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Odia RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Odia migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
