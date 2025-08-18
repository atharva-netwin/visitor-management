import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // This will load .env as fallback

interface Config {
  nodeEnv: string;
  port: number;
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  cors: {
    origins: string[];
  };
  bcrypt: {
    saltRounds: number;
  };
  rateLimit: {
    auth: {
      windowMs: number;
      max: number;
    };
    api: {
      windowMs: number;
      max: number;
    };
    sync: {
      windowMs: number;
      max: number;
    };
  };
}

export const config: Config = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    database: process.env['DB_NAME'] || 'visitor_management',
    username: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'password',
    ssl: process.env['DB_SSL'] === 'true',
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
  },
  jwt: {
    accessSecret: process.env['JWT_ACCESS_SECRET'] || 'your-access-secret-key',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret-key',
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
  },
  cors: {
    origins: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000'],
  },
  bcrypt: {
    saltRounds: parseInt(process.env['BCRYPT_SALT_ROUNDS'] || '12', 10),
  },
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per 15 minutes
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per 15 minutes
    },
    sync: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10, // 10 syncs per 5 minutes
    },
  },
};