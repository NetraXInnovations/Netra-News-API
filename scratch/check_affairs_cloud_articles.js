const { db } = require('../dist/db/db.js');
async function run() {
  try {
    const affairsCloudCount = await db.query(
      "SELECT count(*) FROM articles WHERE is_current_affairs = true AND source_url LIKE '%affairscloud.com%'"
    );
    const nonAffairsCloudCount = await db.query(
      "SELECT count(*) FROM articles WHERE is_current_affairs = true AND source_url NOT LIKE '%affairscloud.com%'"
    );
    console.log('AffairsCloud current affairs count:', affairsCloudCount.rows);
    console.log('Non-AffairsCloud current affairs count:', nonAffairsCloudCount.rows);
    
    // Sample non-AffairsCloud current affairs
    const sampleNon = await db.query(
      "SELECT title, source_url FROM articles WHERE is_current_affairs = true AND source_url NOT LIKE '%affairscloud.com%' LIMIT 5"
    );
    console.log('Sample non-AffairsCloud:', sampleNon.rows);
  } catch (err) {
    console.error(err);
  }
}
run();
