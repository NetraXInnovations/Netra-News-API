const { db } = require('../dist/db/db.js');
const { RssIngestionService } = require('../dist/services/rssIngestionService.js');

async function run() {
  try {
    const res = await db.query(
      `SELECT * FROM rss_sources WHERE rss_url LIKE '%affairscloud%'`
    );
    if (res.rows.length === 0) {
      console.error('No AffairsCloud source found in the database!');
      return;
    }
    const source = res.rows[0];
    console.log('Syncing AffairsCloud source:', source);
    await RssIngestionService.syncFeed(source);
    console.log('Sync complete.');
  } catch (err) {
    console.error(err);
  }
}
run();
