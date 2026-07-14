import mongoose from 'mongoose';
import { connectDB } from '../db/db';
import { logger } from '../config/logger';

async function migrate() {
  await connectDB();
  logger.info('Migrating summary to description in MongoDB...');
  
  // Directly use the raw collection to rename the field across all documents
  const collection = mongoose.connection.collection('articles');
  
  try {
    const result = await collection.updateMany(
      { summary: { $exists: true } },
      { $rename: { 'summary': 'description' } }
    );
    logger.info(`Migration complete! Modified ${result.modifiedCount} articles.`);
  } catch (error) {
    logger.error(`Migration failed: ${error}`);
  }
  
  process.exit(0);
}

migrate();
