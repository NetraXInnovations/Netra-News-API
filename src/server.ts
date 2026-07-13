import app from './app';
import { logger } from './config/logger';
import { RssIngestionService } from './services/rssIngestionService';
import { CleanupService } from './services/cleanupService';
import { connectDB } from './db/db';

// --- GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err: Error) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught Exception detected. Preventing server crash.');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection detected. Preventing server crash.');
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Start Express First so Railway Healthcheck Passes
    const server = app.listen(PORT as number, '0.0.0.0', async () => {
      logger.info('✓ Express Started');
      
      // 2. Initialize MongoDB Atlas
      logger.info('Initializing MongoDB Atlas...');
      await connectDB();
      
      // 3. Start RSS Sync
      logger.info('✓ RSS Engine Started');
      RssIngestionService.syncAllFeeds().catch((err: any) => logger.error({ error: err.message }, '⚠ Initial startup RSS sync failed (continue)'));

      // 4. Start Cleanup Scheduler
      logger.info('✓ Cleanup Scheduler Started');
      CleanupService.runCleanup().catch((err: any) => logger.error({ error: err.message }, '⚠ Initial startup database cleanup failed (continue)'));

      // Set Intervals for schedulers
      const syncInterval = setInterval(() => {
        logger.info('Running scheduled background RSS sync...');
        RssIngestionService.syncAllFeeds().catch((err: any) => logger.error({ error: err.message }, '⚠ Background RSS sync failed (continue)'));
      }, 15 * 60 * 1000); // Back to 15 minutes because MongoDB has no strict quota!

      const cleanupInterval = setInterval(() => {
        logger.info('Running scheduled background database cleanup...');
        CleanupService.runCleanup().catch((err: any) => logger.error({ error: err.message }, '⚠ Background database cleanup failed (continue)'));
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
  } catch (error: any) {
    logger.error('Startup aborted due to initialization failure.');
    process.exit(1);
  }
}

startServer();
