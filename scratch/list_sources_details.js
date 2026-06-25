const { db } = require('../dist/db/db.js');
async function run() {
  try {
    const res = await db.query('SELECT count(*) FROM rss_sources');
    console.log('Total RSS sources:', res.rows);
    const enabled = await db.query('SELECT id, source_name, rss_url FROM rss_sources WHERE enabled = true');
    console.log('Enabled RSS sources:', enabled.rows.map(r => ({ id: r.id, name: r.source_name, url: r.rss_url })));
  } catch (err) {
    console.error(err);
  }
}
run();
