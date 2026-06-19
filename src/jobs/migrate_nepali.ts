import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting Nepali language migration...');

    // 1. Insert Language
    await db.query(`
      INSERT INTO languages (id, name, code, enabled) VALUES
      (13, 'Nepali', 'ne', true)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled
    `);
    
    // Reset sequence
    await db.query(`SELECT setval('languages_id_seq', (SELECT MAX(id) FROM languages))`);
    logger.info('Language Nepali added.');

    // 2. Insert Categories
    await db.query(`
      INSERT INTO categories (id, language_id, name, enabled) VALUES
      (201, 13, 'नेपाल', true),
      (202, 13, 'काठमाडौं', true),
      (203, 13, 'भारत', true),
      (204, 13, 'विश्व', true),
      (205, 13, 'राजनीति', true),
      (206, 13, 'व्यापार', true),
      (207, 13, 'प्रविधि', true),
      (208, 13, 'विज्ञान', true),
      (209, 13, 'स्वास्थ्य', true),
      (210, 13, 'खेलकुद', true),
      (211, 13, 'क्रिकेट', true),
      (212, 13, 'मनोरञ्जन', true),
      (213, 13, 'शिक्षा', true),
      (214, 13, 'जीवनशैली', true),
      (215, 13, 'कृषि', true),
      (216, 13, 'अटोमोबाइल', true),
      (217, 13, 'संस्कृति', true),
      (218, 13, 'यात्रा', true),
      (219, 13, 'स्टार्टअप', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled
    `);

    // Reset sequence
    await db.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
    logger.info('Nepali categories added.');

    // 3. Insert RSS Sources
    await db.query(`
      INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority) VALUES
      (13, 201, 'OnlineKhabar - Nepal', 'https://www.onlinekhabar.com/feed', true, 1),
      (13, 201, 'Ratopati - Nepal', 'https://www.ratopati.com/rss', true, 1),
      (13, 202, 'OnlineKhabar - Kathmandu', 'https://www.onlinekhabar.com/feed?cat=kathmandu', true, 1),
      (13, 202, 'Setopati - Kathmandu', 'https://www.setopati.com/feed?cat=kathmandu', true, 1),
      (13, 203, 'OnlineKhabar - India', 'https://www.onlinekhabar.com/feed?cat=india', true, 1),
      (13, 203, 'Kantipur - India', 'https://www.kantipur.com/rss?cat=india', true, 1),
      (13, 204, 'OnlineKhabar - World', 'https://www.onlinekhabar.com/feed?cat=world', true, 1),
      (13, 204, 'Kantipur - World', 'https://www.kantipur.com/rss?cat=world', true, 1),
      (13, 205, 'Setopati - Politics', 'https://www.setopati.com/feed?cat=politics', true, 1),
      (13, 205, 'Ratopati - Politics', 'https://www.ratopati.com/rss?cat=politics', true, 1),
      (13, 206, 'OnlineKhabar - Business', 'https://www.onlinekhabar.com/feed?cat=business', true, 1),
      (13, 206, 'Kantipur - Business', 'https://www.kantipur.com/rss?cat=business', true, 1),
      (13, 207, 'OnlineKhabar - Technology', 'https://www.onlinekhabar.com/feed?cat=tech', true, 1),
      (13, 207, 'Setopati - Technology', 'https://www.setopati.com/feed?cat=tech', true, 1),
      (13, 208, 'OnlineKhabar - Science', 'https://www.onlinekhabar.com/feed?cat=science', true, 1),
      (13, 208, 'Kantipur - Science', 'https://www.kantipur.com/rss?cat=science', true, 1),
      (13, 209, 'OnlineKhabar - Health', 'https://www.onlinekhabar.com/feed?cat=health', true, 1),
      (13, 209, 'Setopati - Health', 'https://www.setopati.com/feed?cat=health', true, 1),
      (13, 210, 'OnlineKhabar - Sports', 'https://www.onlinekhabar.com/feed?cat=sports', true, 1),
      (13, 210, 'Ratopati - Sports', 'https://www.ratopati.com/rss?cat=sports', true, 1),
      (13, 211, 'OnlineKhabar - Cricket', 'https://www.onlinekhabar.com/feed?cat=cricket', true, 1),
      (13, 211, 'Ratopati - Cricket', 'https://www.ratopati.com/rss?cat=cricket', true, 1),
      (13, 212, 'OnlineKhabar - Entertainment', 'https://www.onlinekhabar.com/feed?cat=entertainment', true, 1),
      (13, 212, 'Setopati - Entertainment', 'https://www.setopati.com/feed?cat=entertainment', true, 1),
      (13, 213, 'OnlineKhabar - Education', 'https://www.onlinekhabar.com/feed?cat=education', true, 1),
      (13, 213, 'Kantipur - Education', 'https://www.kantipur.com/rss?cat=education', true, 1),
      (13, 214, 'OnlineKhabar - Lifestyle', 'https://www.onlinekhabar.com/feed?cat=lifestyle', true, 1),
      (13, 214, 'Setopati - Lifestyle', 'https://www.setopati.com/feed?cat=lifestyle', true, 1),
      (13, 215, 'OnlineKhabar - Agriculture', 'https://www.onlinekhabar.com/feed?cat=agriculture', true, 1),
      (13, 215, 'Ratopati - Agriculture', 'https://www.ratopati.com/rss?cat=agriculture', true, 1),
      (13, 216, 'OnlineKhabar - Automobile', 'https://www.onlinekhabar.com/feed?cat=auto', true, 1),
      (13, 216, 'Kantipur - Automobile', 'https://www.kantipur.com/rss?cat=auto', true, 1),
      (13, 217, 'Setopati - Culture', 'https://www.setopati.com/feed?cat=culture', true, 1),
      (13, 217, 'Kantipur - Culture', 'https://www.kantipur.com/rss?cat=culture', true, 1),
      (13, 218, 'OnlineKhabar - Travel', 'https://www.onlinekhabar.com/feed?cat=travel', true, 1),
      (13, 218, 'Setopati - Travel', 'https://www.setopati.com/feed?cat=travel', true, 1),
      (13, 219, 'OnlineKhabar - Startups', 'https://www.onlinekhabar.com/feed?cat=startups', true, 1),
      (13, 219, 'Kantipur - Startups', 'https://www.kantipur.com/rss?cat=startups', true, 1)
      ON CONFLICT (rss_url) DO NOTHING
    `);
    
    logger.info('Nepali RSS sources added.');
    logger.info('Migration completed successfully!');

  } catch (error) {
    logger.error({ error }, 'Failed to run Nepali migration');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
