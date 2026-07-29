import { Queue, Worker, Job } from 'bullmq';
import logger from '../logger';

const REDIS_URL = process.env.REDIS_URL;

// Example queue/job names — add your own as needed
export const QUEUE_NAMES = {
  // EXAMPLE: "example",
} as const;

export const JOB_NAMES = {
  // EXAMPLE: "example_job",
} as const;

const defaultJobOptions = {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};

function getRedisConnection() {
  if (!REDIS_URL) return null;

  const redisUrl = new URL(REDIS_URL);
  const isTLS = redisUrl.protocol === 'rediss:';

  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: redisUrl.password || undefined,
    db: process.env.NODE_ENV === 'test' ? 1 : 0,
    ...(isTLS ? { tls: {} } : {}),
  };
}

const connection = getRedisConnection();

export function createQueue(name: string): Queue | null {
  if (!connection) return null;

  return new Queue(name, {
    connection,
    defaultJobOptions,
  });
}

export function createWorker(
  name: string,
  processor: (job: Job) => Promise<unknown>,
): Worker | null {
  if (!connection) return null;

  return new Worker(name, processor, {
    connection,
  });
}

export const readyPromise: Promise<void> = (() => {
  if (!connection) {
    logger.log('Skipping Redis setup... REDIS_URL not found');
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const testQueue = new Queue('_redis_health_check', { connection });

    testQueue
      .waitUntilReady()
      .then(() => {
        logger.log('Redis connection established');
        resolve();
      })
      .catch(reject)
      .finally(() => {
        testQueue.close();
      });
  });
})();

export const isRedisEnabled = !!connection;
