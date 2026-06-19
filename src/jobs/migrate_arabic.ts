import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Arabic language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (14, 'Arabic', 'ar', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Arabic added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (220, 14, 'العالم', true),
      (221, 14, 'الشرق الأوسط', true),
      (222, 14, 'الأعمال', true),
      (223, 14, 'التكنولوجيا', true),
      (224, 14, 'العلوم', true),
      (225, 14, 'الصحة', true),
      (226, 14, 'الرياضة', true),
      (227, 14, 'كرة القدم', true),
      (228, 14, 'الترفيه', true),
      (229, 14, 'التعليم', true),
      (230, 14, 'الثقافة', true),
      (231, 14, 'السفر', true),
      (232, 14, 'السيارات', true),
      (233, 14, 'الشركات الناشئة', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Arabic categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (14, 220, 'Al Jazeera - World', 'https://www.aljazeera.net/aljazeerarss/ar/news.xml', true, 1),
      (14, 220, 'BBC Arabic - World', 'https://feeds.bbci.co.uk/arabic/rss.xml', true, 1),
      (14, 221, 'Al Jazeera - Middle East', 'https://www.aljazeera.net/aljazeerarss/ar/news.xml?cat=middleeast', true, 1),
      (14, 221, 'CNN Arabic - Middle East', 'https://arabic.cnn.com/rss', true, 1),
      (14, 222, 'Al Jazeera - Business', 'https://www.aljazeera.net/aljazeerarss/ar/ebusiness.xml', true, 1),
      (14, 222, 'Aleqt - Business', 'https://www.aleqt.com/rss.xml', true, 1),
      (14, 223, 'BBC Arabic - Technology', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=tech', true, 1),
      (14, 223, 'CNN Arabic - Technology', 'https://arabic.cnn.com/rss?cat=tech', true, 1),
      (14, 224, 'BBC Arabic - Science', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=science', true, 1),
      (14, 224, 'Al Jazeera - Science', 'https://www.aljazeera.net/aljazeerarss/ar/news.xml?cat=science', true, 1),
      (14, 225, 'BBC Arabic - Health', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=health', true, 1),
      (14, 225, 'CNN Arabic - Health', 'https://arabic.cnn.com/rss?cat=health', true, 1),
      (14, 226, 'Al Jazeera - Sports', 'https://www.aljazeera.net/aljazeerarss/ar/sport.xml', true, 1),
      (14, 226, 'BBC Arabic - Sports', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=sports', true, 1),
      (14, 227, 'Al Jazeera - Football', 'https://www.aljazeera.net/aljazeerarss/ar/sport.xml?cat=football', true, 1),
      (14, 227, 'BBC Arabic - Football', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=football', true, 1),
      (14, 228, 'CNN Arabic - Entertainment', 'https://arabic.cnn.com/rss?cat=entertainment', true, 1),
      (14, 228, 'BBC Arabic - Entertainment', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=entertainment', true, 1),
      (14, 229, 'BBC Arabic - Education', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=education', true, 1),
      (14, 229, 'Al Jazeera - Education', 'https://www.aljazeera.net/aljazeerarss/ar/news.xml?cat=education', true, 1),
      (14, 230, 'BBC Arabic - Culture', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=culture', true, 1),
      (14, 230, 'Al Jazeera - Culture', 'https://www.aljazeera.net/aljazeerarss/ar/culture.xml', true, 1),
      (14, 231, 'CNN Arabic - Travel', 'https://arabic.cnn.com/rss?cat=travel', true, 1),
      (14, 231, 'BBC Arabic - Travel', 'https://feeds.bbci.co.uk/arabic/rss.xml?cat=travel', true, 1),
      (14, 232, 'CNN Arabic - Auto', 'https://arabic.cnn.com/rss?cat=auto', true, 1),
      (14, 232, 'Al Jazeera - Auto', 'https://www.aljazeera.net/aljazeerarss/ar/news.xml?cat=auto', true, 1),
      (14, 233, 'Aleqt - Startups', 'https://www.aleqt.com/rss.xml?cat=startups', true, 1),
      (14, 233, 'CNN Arabic - Startups', 'https://arabic.cnn.com/rss?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Arabic RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Arabic migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
