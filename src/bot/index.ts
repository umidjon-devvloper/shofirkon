import { Telegraf } from 'telegraf';
import { env } from '../config/env';
import { handleStart } from './handlers/start';
import { handleMessage } from './handlers/message';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  bot.command('start', handleStart);
  bot.on('text', handleMessage);

  return bot;
}
