import { db } from '../src/db/db';
async function run() {
  try {
    const res = await db.query('SELECT count(*) FROM articles WHERE is_current_affairs = true');
    console.log('Current Affairs count:', res.rows);
    const articles = await db.query('SELECT title, is_current_affairs, published_at FROM articles WHERE is_current_affairs = true LIMIT 5');
    console.log('Sample Current Affairs:', articles.rows);
  } catch (err) {
    console.error(err);
  }
}
run();
