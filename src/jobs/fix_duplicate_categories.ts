import { db, pool } from '../db/db';
import { logger } from '../config/logger';

const CATEGORY_NAMES: Record<string, string> = {
  English: 'Entertainment',
  Telugu: 'వినోదం',
  Tamil: 'பொழுதுபோக்கு',
  Hindi: 'मनोरंजन'
};

async function run() {
  try {
    logger.info('Starting duplicate category cleanup...');

    // Get all languages
    const langRes = await db.query('SELECT id, name FROM languages');
    const languages = langRes.rows;

    for (const lang of languages) {
      if (lang.name === 'English') continue; // English 'Entertainment' is correct

      const correctName = CATEGORY_NAMES[lang.name];
      if (!correctName) continue;

      // Find the bad 'Entertainment' category for this language
      const badCatRes = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND language_id = $2',
        ['Entertainment', lang.id]
      );

      if (badCatRes.rowCount === 0) {
        logger.info(`No duplicate Entertainment category found for ${lang.name}.`);
        continue;
      }

      const badCatId = badCatRes.rows[0].id;

      // Find the correct localized category
      const correctCatRes = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND language_id = $2',
        [correctName, lang.id]
      );

      if (correctCatRes.rowCount === 0) {
        logger.error(`Correct category '${correctName}' not found for ${lang.name}!`);
        continue;
      }

      const correctCatId = correctCatRes.rows[0].id;

      // Update RSS sources
      const updateRssRes = await db.query(
        'UPDATE rss_sources SET category_id = $1 WHERE category_id = $2',
        [correctCatId, badCatId]
      );
      logger.info(`Updated ${updateRssRes.rowCount} RSS sources for ${lang.name}.`);

      // Update articles
      const updateArticlesRes = await db.query(
        'UPDATE articles SET category_id = $1 WHERE category_id = $2',
        [correctCatId, badCatId]
      );
      logger.info(`Updated ${updateArticlesRes.rowCount} articles for ${lang.name}.`);

      // Delete the bad category
      await db.query('DELETE FROM categories WHERE id = $1', [badCatId]);
      logger.info(`Deleted duplicate Entertainment category (ID: ${badCatId}) for ${lang.name}.`);
    }

    logger.info('Cleanup completed successfully!');
  } catch (error) {
    logger.error({ error }, 'Failed to clean up duplicate categories');
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
