import app from './app';
import { logger } from './config/logger';
import { RssIngestionService } from './services/rssIngestionService';
import { CleanupService } from './services/cleanupService';
import { db } from './db/db';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Netra News Hub API server started on port ${PORT}`);
  
  // 0. Run schema migration to guarantee is_current_affairs and summary exist and add required performance indexes
  db.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_current_affairs BOOLEAN NOT NULL DEFAULT false')
    .then(() => db.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary TEXT'))
    .then(() => db.query('CREATE INDEX IF NOT EXISTS idx_articles_current_affairs ON articles(is_current_affairs) WHERE is_current_affairs = true'))
    .then(() => db.query('CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language_id)'))
    .then(() => db.query('CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id)'))
    .then(() => db.query('CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(published_at DESC)'))
    .then(() => logger.info('Database schema migration and index creation succeeded.'))
    .catch(err => logger.error(err, 'Failed to run migration query for database schema'));

  // 1. Run initial RSS sync immediately on startup
  logger.info('Triggering initial RSS sync on startup...');
  RssIngestionService.syncAllFeeds()
    .then(() => logger.info('Initial startup RSS sync completed.'))
    .catch(err => logger.error(err, 'Initial startup RSS sync failed'));

  // 2. Set interval to auto-sync RSS feeds every 15 minutes
  const syncInterval = setInterval(() => {
    logger.info('Running scheduled background RSS sync...');
    RssIngestionService.syncAllFeeds().catch(err => logger.error(err, 'Background RSS sync failed'));
  }, 15 * 60 * 1000);

  // 3. Run database cleanup immediately on startup
  logger.info('Triggering database cleanup on startup...');
  CleanupService.runCleanup()
    .then(stats => logger.info(stats, 'Initial startup database cleanup completed.'))
    .catch(err => logger.error(err, 'Initial startup database cleanup failed'));

  // 4. Set interval to auto-cleanup expired articles every 1 hour (1 * 60 * 60 * 1000 ms)
  const cleanupInterval = setInterval(() => {
    logger.info('Running scheduled background database cleanup...');
    CleanupService.runCleanup().catch(err => logger.error(err, 'Background database cleanup failed'));
  }, 1 * 60 * 60 * 1000);

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(syncInterval);
    clearInterval(cleanupInterval);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    
    // Force shutdown after 5 seconds if server.close hangs
    setTimeout(() => {
      logger.warn('Forcefully shutting down...');
      process.exit(1);
    }, 5000);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGUSR2', () => {
    logger.info('Nodemon restart signal received. Closing port...');
    clearInterval(syncInterval);
    clearInterval(cleanupInterval);
    server.close(() => {
      logger.info('HTTP server closed for restart.');
      process.kill(process.pid, 'SIGUSR2');
    });
  });
});


