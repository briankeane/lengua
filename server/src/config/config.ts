import { optionalEnvVars, requiredEnvVars } from './envVars';

export enum Environments {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  TEST = 'test',
}

type EnvVars = {
  NODE_ENV: string;
  PORT: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ONLY_ADMIN_CAN_EDIT_STATIONS?: string;
};

export class Config implements Partial<EnvVars> {
  env: string;
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  SOME_OPTIONAL_ENV_VARIABLE?: string;
  _SOME_OPTIONAL_ENV_VARIABLE?: string;
  BASIC_AUTH_TOKENS?: string;
  _BASIC_AUTH_TOKENS?: string;
  REDIS_URL?: string;
  _REDIS_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  _GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  _GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  _GOOGLE_IOS_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  _APPLE_CLIENT_ID?: string;
  ELEVENLABS_API_KEY?: string;
  _ELEVENLABS_API_KEY?: string;
  ELEVENLABS_CONVAI_AGENT_ID?: string;
  _ELEVENLABS_CONVAI_AGENT_ID?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  _ELEVENLABS_WEBHOOK_SECRET?: string;
  VOICE_PROVIDER?: string;
  _VOICE_PROVIDER?: string;
  VOICE_MAX_SESSION_SECONDS?: string;
  _VOICE_MAX_SESSION_SECONDS?: string;
  ANTHROPIC_API_KEY?: string;
  _ANTHROPIC_API_KEY?: string;
  EVALUATOR_MODEL?: string;
  _EVALUATOR_MODEL?: string;
  VOICE_MAX_EVALUATIONS_PER_DAY?: string;
  _VOICE_MAX_EVALUATIONS_PER_DAY?: string;

  constructor(env: string = process.env.NODE_ENV ?? Environments.DEVELOPMENT) {
    this.env = env;
    this.loadEnvVars();
  }

  get BASE_URL(): string {
    switch (this.env) {
      case Environments.PRODUCTION:
        return 'https://api.lengua-app.com';
      case Environments.DEVELOPMENT:
        return 'http://localhost:10020';
      case Environments.TEST:
        return 'http://localhost:10021';
      default:
        throw new Error(`Unknown environment: ${this.env}`);
    }
  }

  get CLIENT_BASE_URL(): string {
    switch (this.env) {
      case Environments.PRODUCTION:
        return 'https://www.lengua-app.com';
      case Environments.DEVELOPMENT:
        return 'http://localhost:3000';
      case Environments.TEST:
        return 'http://localhost:3001';
      default:
        throw new Error(`Unknown environment: ${this.env}`);
    }
  }

  get GOOGLE_SIGNIN_REDIRECT_URI(): string {
    switch (this.env) {
      case Environments.DEVELOPMENT:
      case Environments.TEST:
        return 'http://localhost:10020/v1/auth/google/web/authorize';
      case Environments.PRODUCTION: // google does not allow testing from localhost!
        return 'https://api.lengua-app.com/v1/auth/google/web/authorize';
      default:
        throw new Error(`Unknown environment: ${this.env}`);
    }
  }

  loadEnvVars(): void {
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value == null) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
      // Type-safe assignment using type assertion
      this[envVar] = value;
    }

    for (const envVar of optionalEnvVars) {
      const value = process.env[envVar];
      if (value) {
        // Type-safe assignment for optional vars
        this[envVar] = value;
        this[`_${envVar}`] = value;
      }
    }
  }
}

// Export an instance of Config with the current NODE_ENV.
export default new Config(process.env.NODE_ENV);
