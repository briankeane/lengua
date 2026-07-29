// import cron from "node-cron";
import logger from '../logger';
import { readyPromise as queueReadyPromise, isRedisEnabled } from '../queue';
import { ensureRequiredEnvVars } from './checkEnv';

export async function startWorker(): Promise<void> {
  ensureRequiredEnvVars();

  // --- Cron Jobs ---
  // import cron at the top of this file, then:
  // cron.schedule("*/15 * * * *", async () => {
  //   try {
  //     logger.log("Running scheduled task...");
  //   } catch (error) {
  //     logger.error("Scheduled task failed:", error);
  //   }
  // });

  // --- Queue Workers ---
  if (isRedisEnabled) {
    await queueReadyPromise;

    // Example: process jobs from a queue
    // createWorker(QUEUE_NAMES.EXAMPLE, async (job) => {
    //   logger.log(`Processing job ${job.id}:`, job.data);
    //   return { success: true };
    // });

    logger.log('Queue workers initialized');
  }

  logger.log('Worker setup complete.');

  // --- Graceful Shutdown ---
  const shutdown = () => {
    logger.log('Worker shutting down...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  startWorker().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}
