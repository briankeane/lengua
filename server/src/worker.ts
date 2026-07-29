import logger from './logger';
import { startWorker } from './scripts/startWorker';

startWorker().catch((err) => {
  logger.error(err);
  process.exit(1);
});
