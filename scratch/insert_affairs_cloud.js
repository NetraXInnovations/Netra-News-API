const { db } = require('../dist/db/db.js');
async function run() {
  try {
    const insertRes = await db.query(
      `INSERT INTO rss_sources (language_id, category_id, source_name, rss_url, enabled, priority)
       VALUES (1, 1, 'AffairsCloud - Current Affairs', 'https://affairscloud.com/feed/', true, 1)
       ON CONFLICT (rss_url) DO UPDATE SET enabled = true
       RETURNING *`
    );
    console.log('Inserted AffairsCloud source:', insertRes.rows);
  } catch (err) {
    console.error(err);
  }
}
run();
