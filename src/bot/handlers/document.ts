import fs from 'fs';
import { Context } from 'telegraf';
import { getSession } from '../session';
import { isAdmin } from '../../services/auth.service';
import { importFromExcel, ImportResult } from '../../services/import.service';
import { adminMenuKeyboard } from '../keyboards';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function handleDocument(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);
  if (session.step !== 'import_waiting_file') return;

  if (!isAdmin(telegramId)) {
    await ctx.reply('❌ Bu amal faqat admin uchun.');
    return;
  }

  const msg = ctx.message;
  if (!msg || !('document' in msg) || !msg.document) {
    await ctx.reply("❌ Excel (.xlsx) faylni biriktirib yuboring.");
    return;
  }

  const doc = msg.document;
  const fileName = doc.file_name || '';
  if (!/\.xlsx$/i.test(fileName)) {
    await ctx.reply("❌ Faqat .xlsx fayllar qabul qilinadi.");
    return;
  }

  if (doc.file_size && doc.file_size > MAX_FILE_SIZE) {
    await ctx.reply("❌ Fayl juda katta. 20 MB dan kichik bo'lishi kerak.");
    return;
  }

  const mahallaId = session.tempData.importMahallaId;
  const mahallaName = session.tempData.importMahallaName;
  if (!mahallaId) {
    session.step = 'admin_menu';
    session.tempData = {};
    await ctx.reply('❌ Mahalla tanlanmagan. Qaytadan boshlang.', adminMenuKeyboard());
    return;
  }

  await ctx.reply('⏳ Fayl yuklanmoqda va qayta ishlanmoqda...');

  let buffer: Buffer;
  try {
    const link = await ctx.telegram.getFileLink(doc.file_id);
    const response = await fetch(link.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err: any) {
    await ctx.reply(`❌ Faylni yuklab bo'lmadi: ${err.message || err}`);
    session.step = 'admin_menu';
    session.tempData = {};
    await ctx.reply('📋 Admin menyu:', adminMenuKeyboard());
    return;
  }

  let result: ImportResult;
  try {
    result = await importFromExcel(mahallaId, buffer);
  } catch (err: any) {
    await ctx.reply(`❌ ${err.message || err}`);
    session.step = 'admin_menu';
    session.tempData = {};
    await ctx.reply('📋 Admin menyu:', adminMenuKeyboard());
    return;
  }

  let summary = `✅ Import yakunlandi.\n\n`;
  summary += `🏘 Mahalla: ${mahallaName}\n`;
  summary += `📊 Jami qatorlar: ${result.totalRows}\n`;
  summary += `➕ Yangi fuqarolar: ${result.created}\n`;
  summary += `♻️ Yangilangan fuqarolar: ${result.updated}\n`;
  summary += `🏠 Yangi oilalar: ${result.familiesCreated}\n`;
  if (result.errors.length > 0) {
    summary += `⚠️ Xatoliklar: ${result.errors.length}\n`;
  }

  await ctx.reply(summary);

  if (result.errors.length > 0) {
    const header = "❌ Xatolik ro'yxati:\n\n";
    const lines = result.errors;
    const chunks: string[] = [];
    let current = header;
    for (const line of lines) {
      const next = current + line + '\n';
      if (next.length > 3800) {
        chunks.push(current);
        current = line + '\n';
      } else {
        current = next;
      }
    }
    if (current.trim()) chunks.push(current);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  }

  session.step = 'admin_menu';
  session.tempData = {};
  await ctx.reply('📋 Admin menyu:', adminMenuKeyboard());
}
