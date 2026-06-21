import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit: number;
  };
  github: {
    apiBaseUrl: string;
    token: string | undefined;
  };
  cache: {
    ttlSeconds: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT) || 3306,
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'github_analyzer'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  },
  github: {
    apiBaseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com',
    // Optional but strongly recommended: raises GitHub's rate limit
    // from 60 req/hr (unauthenticated) to 5000 req/hr.
    token: process.env.GITHUB_TOKEN,
  },
  cache: {
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 300, // 5 minutes
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
};
