import fs from 'fs';
import path from 'path';
import { db, pool } from '../db/db';
import { logger } from '../config/logger';

async function run() {
  try {
    logger.info('Starting database migration and seeding...');
    
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const seedPath = path.join(__dirname, '../db/seed.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed file not found at ${seedPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    logger.info('Applying schema...');
    await db.query(schemaSql);
    logger.info('Schema applied successfully.');

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    logger.info('Applying seed data...');
    await db.query(seedSql);
    logger.info('Seed data applied successfully.');
    
    logger.info('Database migration and seeding completed successfully!');
  } catch (error: any) {
    logger.error(error, 'Migration and seeding failed');
  } finally {
    await pool.end();
  }
}

run();
