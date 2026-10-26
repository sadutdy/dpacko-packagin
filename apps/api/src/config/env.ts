import { generateKeyPairSync } from 'node:crypto';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().default('http://localhost:5175'),

  MONGO_URI: z.string().default('mongodb://localhost:27017/ameen?replicaSet=rs0'),
  MONGO_DB_NAME: z.string().default('ameen'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  COOKIE_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ameen'),
  S3_ACCESS_KEY: z.string().default('ameen'),
  S3_SECRET_KEY: z.string().default('ameen-secret'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_OTP_AUTOLOGIN: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;

let jwtPrivateKey = env.JWT_PRIVATE_KEY;
let jwtPublicKey = env.JWT_PUBLIC_KEY;
let cookieSecret = env.COOKIE_SECRET;

if (env.NODE_ENV === 'production') {
  if (!jwtPrivateKey || !jwtPublicKey || !cookieSecret) {
    throw new Error('JWT_PRIVATE_KEY, JWT_PUBLIC_KEY and COOKIE_SECRET must be set in production');
  }
} else {
  if (!jwtPrivateKey || !jwtPublicKey) {
    const generated = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    jwtPrivateKey = generated.privateKey;
    jwtPublicKey = generated.publicKey;
  }
  if (!cookieSecret) cookieSecret = 'dev-only-cookie-secret';
}

export const config = {
  ...env,
  JWT_PRIVATE_KEY: jwtPrivateKey,
  JWT_PUBLIC_KEY: jwtPublicKey,
  COOKIE_SECRET: cookieSecret,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export type AppConfig = typeof config;
