import app from './app';
import cron from 'node-cron';
import { logger } from './config/logger';
import { RssIngestionService } from './services/rssIngestionService';
import { CleanupService } from './services/cleanupService';
import { connectDB } from './db/db';
import { AffairsCloudParser } from './services/affairsCloudParser';

// --- GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err: Error) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught Exception detected. Preventing server crash.');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection detected. Preventing server crash.');
});

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Combined sync + conditional cleanup
// CleanupService only deletes old articles if the RSS sync succeeded.
// ─────────────────────────────────────────────────────────────────────────────
async function syncThenCleanup(): Promise<void> {
  const result = await RssIngestionService.syncAllFeeds();
  await CleanupService.runCleanup(result.syncSucceeded);
}

async function startServer() {
  try {
    // 1. Start Express first so Railway health check passes immediately
    const server = app.listen(PORT as number, '0.0.0.0', async () => {
      logger.info('✓ Express Started');

      // 2. Connect to MongoDB Atlas
      logger.info('Initializing MongoDB Atlas...');
      await connectDB();

      // 3. Initial RSS sync + cleanup on startup
      logger.info('✓ RSS Engine Started');
      syncThenCleanup().catch((err: any) =>
        logger.error({ error: err.message }, '⚠ Initial startup RSS sync failed (continue)')
      );

      // 4. Initial AffairsCloud sync
      logger.info('✓ AffairsCloud Engine Started');
      AffairsCloudParser.syncAffairsCloud().catch((err: any) =>
        logger.error({ error: err.message }, '⚠ Initial startup AffairsCloud sync failed (continue)')
      );

      // ── Recurring schedulers ─────────────────────────────────────────────

      // RSS sync every 5 min → then conditional cleanup
      const syncTask = cron.schedule('*/5 * * * *', () => {
        logger.info('Running scheduled background RSS sync...');
        syncThenCleanup().catch((err: any) =>
          logger.error({ error: err.message }, '⚠ Background RSS sync+cleanup failed (continue)')
        );
      });

      // AffairsCloud sync every 5 min
      const affairsCloudTask = cron.schedule('*/5 * * * *', () => {
        logger.info('Running scheduled background AffairsCloud sync...');
        AffairsCloudParser.syncAffairsCloud().catch((err: any) =>
          logger.error({ error: err.message }, '⚠ Background AffairsCloud sync failed (continue)')
        );
      });

      // Graceful shutdown
      const shutdown = (signal: string) => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        syncTask.stop();
        affairsCloudTask.stop();
        server.close(() => {
          logger.info('HTTP server closed.');
          process.exit(0);
        });
        setTimeout(() => {
          logger.warn('Forcefully shutting down...');
          process.exit(1);
        }, 5000);
      };

      process.once('SIGINT',  () => shutdown('SIGINT'));
      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGUSR2', () => {
        logger.info('Nodemon restart signal received. Closing port...');
        syncTask.stop();
        affairsCloudTask.stop();
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
