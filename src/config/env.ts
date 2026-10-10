import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  BOT_TOKEN: string;
  MONGODB_URI: string;
  ADMIN_TELEGRAM_IDS: number[];
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set. Check your .env file.`);
  }
  return value;
}

function parseAdminIds(raw: string): number[] {
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        throw new Error(`Invalid ADMIN_TELEGRAM_IDS value: "${s}" is not a valid Telegram ID.`);
      }
      return n;
    });

  if (ids.length === 0) {
    throw new Error('ADMIN_TELEGRAM_IDS must contain at least one valid Telegram ID.');
  }

  return ids;
}

export const env: EnvConfig = {
  BOT_TOKEN: getEnvVar('BOT_TOKEN'),
  MONGODB_URI: getEnvVar('MONGODB_URI'),
  ADMIN_TELEGRAM_IDS: parseAdminIds(getEnvVar('ADMIN_TELEGRAM_IDS')),
};
