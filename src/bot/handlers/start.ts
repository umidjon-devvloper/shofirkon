import { Context, Markup } from 'telegraf';
import { getSession } from '../session';
import { isAdmin, getAuthenticatedOperator } from '../../services/auth.service';
import { adminMenuKeyboard, operatorMenuKeyboard } from '../keyboards';

export async function handleStart(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);

  if (isAdmin(telegramId)) {
    session.step = 'admin_menu';
    session.role = 'admin';
    session.tempData = {};
    session.activeFamilyId = undefined;
    await ctx.reply('✅ Admin sifatida tizimga kirdingiz.', adminMenuKeyboard());
    return;
  }

  if (session.role === 'operator' && session.mahallaId && session.mahallaName) {
    session.step = 'operator_menu';
    session.tempData = {};
    session.activeFamilyId = undefined;
    await ctx.reply(
      `✅ Tizimga kirgansiz.\n\n🏘 Mahalla: ${session.mahallaName}`,
      operatorMenuKeyboard()
    );
    return;
  }

  const auth = await getAuthenticatedOperator(telegramId);
  if (auth) {
    session.step = 'operator_menu';
    session.role = 'operator';
    session.mahallaId = auth.mahallaId;
    session.mahallaName = auth.mahallaName;
    await ctx.reply(
      `✅ Tizimga kirgansiz.\n\n🏘 Mahalla: ${auth.mahallaName}`,
      operatorMenuKeyboard()
    );
    return;
  }

  session.step = 'operator_login';
  session.role = undefined;
  session.mahallaId = undefined;
  session.mahallaName = undefined;
  session.tempData = {};
  await ctx.reply(
    '👋 Assalomu alaykum!\n\n' +
      "Shofirkon tumani fuqarolarini ro'yxatga olish tizimiga xush kelibsiz.\n\n" +
      '🔐 Login kiriting:',
    Markup.removeKeyboard()
  );
}
