import logger from '../logger';
import { requiredEnvVars } from '../config/envVars';

function findMissingEnvVars(): string[] {
  return requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar];
    return value == null || value === '';
  });
}

export function ensureRequiredEnvVars(): void {
  const missingEnvVars = findMissingEnvVars();

  if (missingEnvVars.length > 0) {
    logger.always.error('Missing required environment variables:');
    logger.always.error('');
    for (const envVar of missingEnvVars) {
      logger.always.error(`- ${envVar}`);
    }
    process.exit(1);
  }

  logger.always.log('All required environment variables are set.');
}

if (require.main === module) {
  ensureRequiredEnvVars();
}
