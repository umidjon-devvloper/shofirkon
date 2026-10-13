import { Telegraf } from 'telegraf';
import { env } from '../config/env';
import { handleStart } from './handlers/start';
import { handleMessage } from './handlers/message';
import { handleStat, handleRemove, handleAdd } from './handlers/commands';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  bot.command('start', handleStart);
  bot.command('stat', handleStat);
  bot.command('remove', handleRemove);
  bot.command('add', handleAdd);
  bot.on('text', handleMessage);

  return bot;
}
