const { db } = require('../dist/db/db.js');
async function run() {
  try {
    const res = await db.query(
      `SELECT * FROM rss_sources WHERE rss_url LIKE '%affairscloud%'`
    );
    console.log('AffairsCloud RSS sources:', res.rows);
  } catch (err) {
    console.error(err);
  }
}
run();
