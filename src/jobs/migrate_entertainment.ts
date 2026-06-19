import { db } from '../db/db';
import { logger } from '../config/logger';

const ENTERTAINMENT_FEEDS = [
  // English
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms', lang: 'English', source: 'Times of India Entertainment' },
  { url: 'https://www.indiatoday.in/rss/1206577', lang: 'English', source: 'India Today Entertainment' },
  { url: 'https://www.news18.com/commonfeeds/v1/eng/rss/entertainment.xml', lang: 'English', source: 'News18 Entertainment' },
  // Telugu
  { url: 'https://telugu.oneindia.com/rss/feeds/telugu-entertainment-fb.xml', lang: 'Telugu', source: 'OneIndia Telugu Entertainment' },
  { url: 'https://telugu.news18.com/commonfeeds/v1/tel/rss/entertainment.xml', lang: 'Telugu', source: 'News18 Telugu Entertainment' },
  // Hindi
  { url: 'https://hindi.news18.com/commonfeeds/v1/hin/rss/entertainment.xml', lang: 'Hindi', source: 'News18 Hindi Entertainment' },
  { url: 'https://hindi.oneindia.com/rss/entertainment-fb.xml', lang: 'Hindi', source: 'OneIndia Hindi Entertainment' },
  // Tamil
  { url: 'https://www.vikatan.com/stories.rss?section-id=8956&time-period=last-24-hours', lang: 'Tamil', source: 'Vikatan Tamil Entertainment' },
  { url: 'https://tamil.news18.com/commonfeeds/v1/tam/rss/entertainment.xml', lang: 'Tamil', source: 'News18 Tamil Entertainment' }
];

const CATEGORY_NAMES: Record<string, string> = {
  English: 'Entertainment',
  Telugu: 'వినోదం',
  Tamil: 'பொழுதுபோக்கு',
  Hindi: 'मनोरंजन'
};

async function run() {
  try {
    for (const feed of ENTERTAINMENT_FEEDS) {
      // Get language ID
      const langRes = await db.query('SELECT id FROM languages WHERE LOWER(name) = LOWER($1)', [feed.lang]);
      if (langRes.rowCount === 0) {
        logger.error(`Language not found: ${feed.lang}`);
        continue;
      }
      const langId = langRes.rows[0].id;

      // Get category ID (Create if not exists)
      const catName = CATEGORY_NAMES[feed.lang] || 'Entertainment';
      let catRes = await db.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND language_id = $2', [catName, langId]);
      let catId;
      if (catRes.rowCount === 0) {
        const catInsert = await db.query('INSERT INTO categories (name, language_id, enabled) VALUES ($1, $2, true) RETURNING id', [catName, langId]);
        catId = catInsert.rows[0].id;
        logger.info(`Created ${catName} category for ${feed.lang}`);
      } else {
        catId = catRes.rows[0].id;
      }

      // Check if source exists
      const sourceRes = await db.query('SELECT id FROM rss_sources WHERE rss_url = $1', [feed.url]);
      if (sourceRes.rowCount === 0) {
        await db.query(
          'INSERT INTO rss_sources (source_name, rss_url, language_id, category_id, enabled) VALUES ($1, $2, $3, $4, true)',
          [feed.source, feed.url, langId, catId]
        );
        logger.info(`Inserted feed: ${feed.source}`);
      } else {
        logger.info(`Feed already exists: ${feed.source}`);
      }
    }
    logger.info('Successfully imported all entertainment feeds!');
  } catch (error) {
    logger.error({ error }, 'Failed to insert feeds');
  } finally {
    process.exit(0);
  }
}

run();
