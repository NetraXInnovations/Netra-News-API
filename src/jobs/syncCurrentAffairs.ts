import { connectDB } from '../db/db';
import { AffairsCloudParser } from '../services/affairsCloudParser';
import { logger } from '../config/logger';

const run = async () => {
  try {
    await connectDB();
    await AffairsCloudParser.syncAffairsCloud();
    logger.info('Manual sync completed successfully.');
    process.exit(0);
  } catch (err: any) {
    logger.error(`Sync failed: ${err.message}`);
    process.exit(1);
  }
};

run();
