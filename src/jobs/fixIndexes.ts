import { connectDB } from '../db/db';
import { Article } from '../models/Article';
import { Category } from '../models/Category';
import { RssSource } from '../models/RssSource';
import { Language } from '../models/Language';
import { SavedArticle } from '../models/SavedArticle';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

async function fixIndexes() {
  try {
    await connectDB();
    logger.info('Dropping old collections to clear conflicting indexes...');
    
    // Drop collections entirely so that old indexes are destroyed
    try { await mongoose.connection.collection('articles').drop(); } catch (e) {}
    try { await mongoose.connection.collection('categories').drop(); } catch (e) {}
    try { await mongoose.connection.collection('rsssources').drop(); } catch (e) {}
    try { await mongoose.connection.collection('languages').drop(); } catch (e) {}
    try { await mongoose.connection.collection('savedarticles').drop(); } catch (e) {}
    
    logger.info('Collections dropped. Rebuilding indexes based on new schema...');
    
    // Recreate indexes
    await Article.createIndexes();
    await Category.createIndexes();
    await RssSource.createIndexes();
    await Language.createIndexes();
    await SavedArticle.createIndexes();
    
    logger.info('Indexes rebuilt successfully! Ready for clean sync.');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Failed to fix indexes');
    process.exit(1);
  }
}

fixIndexes();
