import { CleanupService } from '../services/cleanupService';
import { logger } from '../config/logger';
import { pool } from '../db/db';

async function run() {
  try {
    logger.info('Running database news cleanup job script...');
    await CleanupService.runCleanup();
    logger.info('Database news cleanup job script finished.');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed inside database cleanup job script');
  } finally {
    await pool.end();
  }
}

run();
