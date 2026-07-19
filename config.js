import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROGRAM = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'program-config.json'), 'utf8'));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function integerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  rootDir: ROOT_DIR,
  assetsDir: path.join(ROOT_DIR, 'assets'),
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, 'data'),
  port: integerFromEnv('PORT', 3000),
  isProduction: IS_PRODUCTION,
  trustProxy: integerFromEnv('TRUST_PROXY', IS_PRODUCTION ? 1 : 0),
  publicOrigin: (process.env.PUBLIC_ORIGIN || 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  adminToken: process.env.ADMIN_TOKEN || '',
  cronSecret: process.env.CRON_SECRET || '',
  ipHashSecret: process.env.IP_HASH_SECRET || '',
  admissionsEmails: (process.env.ADMISSIONS_EMAILS || PROGRAM.organization.contactEmails.join(','))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: integerFromEnv('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.FROM_EMAIL || 'Compute Forward <no-reply@localhost>'
  },
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  program: PROGRAM,
  globalRateLimit: integerFromEnv('GLOBAL_RATE_LIMIT', 200),
  applicationRateLimit: integerFromEnv('APPLICATION_RATE_LIMIT', 5),
  adminRateLimit: integerFromEnv('ADMIN_RATE_LIMIT', 60),
  deletionRateLimit: integerFromEnv('DELETION_RATE_LIMIT', 3),
  retention: {
    unsuccessfulApplicationMonths: 12,
    enrolledApplicationMonths: 24,
    securityLogDays: 30
  }
});

export function validateRuntimeConfig(runtimeConfig = config) {
  const problems = [];
  if (!runtimeConfig.isProduction) return problems;

  if (!runtimeConfig.databaseUrl) problems.push('DATABASE_URL is required in production.');
  if (!runtimeConfig.adminToken || runtimeConfig.adminToken.length < 32) {
    problems.push('ADMIN_TOKEN must contain at least 32 characters in production.');
  }
  if (!runtimeConfig.ipHashSecret || runtimeConfig.ipHashSecret.length < 32) {
    problems.push('IP_HASH_SECRET must contain at least 32 characters in production.');
  }
  if (!runtimeConfig.cronSecret || runtimeConfig.cronSecret.length < 32) {
    problems.push('CRON_SECRET must contain at least 32 characters in production.');
  }
  if (!runtimeConfig.publicOrigin.startsWith('https://')) {
    problems.push('PUBLIC_ORIGIN must use HTTPS in production.');
  }
  if (!runtimeConfig.smtp.host || !runtimeConfig.smtp.user || !runtimeConfig.smtp.pass) {
    problems.push('SMTP_HOST, SMTP_USER, and SMTP_PASS are required in production.');
  }
  return problems;
}
