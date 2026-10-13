import { connectDatabase, disconnectDatabase } from './db/connection';
import { createBot } from './bot';
import { normalizeFamilyHeads } from './services/normalize.service';

async function main(): Promise<void> {
  await connectDatabase();
  await normalizeFamilyHeads();

  const bot = createBot();

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    bot.stop(signal);
    await disconnectDatabase();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni boshlash' },
    { command: 'stat', description: 'Statistika' },
    { command: 'add', description: 'Oilaga fuqaro qo\'shish (admin)' },
    { command: 'remove', description: 'Fuqaroni o\'chirish (admin)' },
  ]);

  bot.launch().catch((error) => {
    console.error('Bot failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
  console.log('🤖 Bot started');
}

main().catch((error) => {
  console.error('Failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
