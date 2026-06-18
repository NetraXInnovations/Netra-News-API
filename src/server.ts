import app from './app';
import { logger } from './config/logger';
import { RssIngestionService } from './services/rssIngestionService';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Netra News Hub API server started on port ${PORT}`);
  
  // 1. Run initial sync immediately in the background on startup
  logger.info('Triggering initial RSS sync on startup...');
  RssIngestionService.syncAllFeeds()
    .then(() => logger.info('Initial startup RSS sync completed.'))
    .catch(err => logger.error(err, 'Initial startup RSS sync failed'));

  // 2. Set interval to auto-sync every 15 minutes (15 * 60 * 1000 ms)
  const syncInterval = setInterval(() => {
    logger.info('Running scheduled background RSS sync...');
    RssIngestionService.syncAllFeeds().catch(err => logger.error(err, 'Background RSS sync failed'));
  }, 15 * 60 * 1000);

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(syncInterval);
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
    server.close(() => {
      logger.info('HTTP server closed for restart.');
      process.kill(process.pid, 'SIGUSR2');
    });
  });
});

