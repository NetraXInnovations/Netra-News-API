const { db } = require('../dist/db/db.js');
async function run() {
  try {
    // 1. Delete all current affairs articles that are not from affairscloud.com
    const deleteRes = await db.query(
      "DELETE FROM articles WHERE is_current_affairs = true AND source_url NOT LIKE '%affairscloud.com%'"
    );
    console.log('Deleted old non-AffairsCloud current affairs:', deleteRes.rowCount);
    
    // 2. We can also delete all current affairs and let the ingestion refetch them fresh if desired
    // Let's print the count of remaining affairscloud articles
    const remaining = await db.query(
      "SELECT count(*) FROM articles WHERE is_current_affairs = true"
    );
    console.log('Remaining current affairs (AffairsCloud):', remaining.rows);
  } catch (err) {
    console.error(err);
  }
}
run();
