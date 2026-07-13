import 'dotenv/config';
import mongoose from 'mongoose';
import { logger } from '../config/logger';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    logger.error('ERROR: MONGO_URI is not set in environment variables!');
    // We don't want to exit the process immediately on Vercel/Railway if it's just a cold start issue,
    // but without DB, the app can't function. We will log the error.
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    logger.info(`🔥 MongoDB Atlas Connected Successfully! Host: ${conn.connection.host}`);
  } catch (error: any) {
    logger.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};
