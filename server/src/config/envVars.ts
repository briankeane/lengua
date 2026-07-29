export const requiredEnvVars = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET'] as const;

export const optionalEnvVars = [
  'SOME_OPTIONAL_ENV_VARIABLE',
  'BASIC_AUTH_TOKENS',
  'REDIS_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

export type RequiredEnvVar = (typeof requiredEnvVars)[number];
