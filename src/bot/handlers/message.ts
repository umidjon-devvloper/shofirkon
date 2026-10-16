import fs from 'fs';
import { Context, Markup } from 'telegraf';
import { getSession, resetSession } from '../session';
import { UserSession } from '../../types/session';
import { isAdmin, verifyOperator, loginOperator, logoutOperator } from '../../services/auth.service';
import { createMahalla, getAllMahallas, isLoginTaken } from '../../services/mahalla.service';
import { createFamily } from '../../services/family.service';
import { exportAllCitizens, exportByMahalla } from '../../services/export.service';
import { buildImportTemplate } from '../../services/import.service';
import {
  adminMenuKeyboard,
  operatorMenuKeyboard,
  cancelKeyboard,
  skipCancelKeyboard,
  exportMenuKeyboard,
  importMenuKeyboard,
} from '../keyboards';
import {
  startCitizenFormHead,
  handleCitizenCancel,
  handleCitizenName,
  handleCitizenGender,
  handleCitizenBirthDate,
  handleCitizenJshshir,
  handleCitizenReferenceConfirm,
  handleCitizenDocNumber,
  handleCitizenPhone,
  handleCitizenMarital,
  handleCitizenEducation,
  handleCitizenOccupation,
  handleCitizenConfirm,
  handleCitizenSaved,
} from './citizen';

const CITIZEN_FORM_STEPS = [
  'citizen_name', 'citizen_gender', 'citizen_birthdate',
  'citizen_jshshir', 'citizen_reference_confirm',
  'citizen_doc_number', 'citizen_phone',
  'citizen_marital', 'citizen_education', 'citizen_occupation', 'citizen_confirm',
];

export async function handleMessage(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const msg = ctx.message;
  if (!msg || !('text' in msg)) return;

  const text = msg.text;
  if (text.startsWith('/')) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getSession(telegramId);

  if (text === '🚪 Chiqish' && session.role === 'operator') {
    await logoutOperator(telegramId);
    resetSession(telegramId);
    const newSession = getSession(telegramId);
    newSession.step = 'operator_login';
    await ctx.reply('🔐 Tizimdan chiqdingiz.\n\nLogin kiriting:', Markup.removeKeyboard());
    return;
  }

  if (
    text === '❌ Bekor qilish' &&
    (session.step === 'export_menu' || session.step === 'export_mahalla_select' ||
     session.step === 'import_menu' || session.step === 'import_mahalla_select' ||
     session.step === 'import_waiting_file' ||
     session.step === 'adding_mahalla_name' || session.step === 'adding_mahalla_login' ||
     session.step === 'adding_mahalla_password')
  ) {
    session.step = 'admin_menu';
    session.tempData = {};
    await ctx.reply('❌ Bekor qilindi.', adminMenuKeyboard());
    return;
  }

  if (
    text === '❌ Bekor qilish' &&
    (session.step === 'family_street' || session.step === 'family_house' || session.step === 'family_apartment')
  ) {
    session.step = 'operator_menu';
    session.tempData = {};
    session.activeFamilyId = undefined;
    await ctx.reply('❌ Bekor qilindi.', operatorMenuKeyboard());
    return;
  }

  if (text === '❌ Bekor qilish' && CITIZEN_FORM_STEPS.includes(session.step)) {
    await handleCitizenCancel(ctx, session);
    return;
  }

  switch (session.step) {
    case 'operator_login':
      await handleOperatorLogin(ctx, session, telegramId, text);
      break;
    case 'operator_password':
      await handleOperatorPassword(ctx, session, telegramId, text);
      break;

    case 'admin_menu':
      await handleAdminMenu(ctx, session, telegramId, text);
      break;
    case 'adding_mahalla_name':
      await handleMahallaName(ctx, session, telegramId, text);
      break;
    case 'adding_mahalla_login':
      await handleMahallaLogin(ctx, session, telegramId, text);
      break;
    case 'adding_mahalla_password':
      await handleMahallaPassword(ctx, session, telegramId, text);
      break;

    case 'export_menu':
      await handleExportMenu(ctx, session, telegramId, text);
      break;
    case 'export_mahalla_select':
      await handleExportMahallaSelect(ctx, session, telegramId, text);
      break;

    case 'import_menu':
      await handleImportMenu(ctx, session, telegramId, text);
      break;
    case 'import_mahalla_select':
      await handleImportMahallaSelect(ctx, session, telegramId, text);
      break;
    case 'import_waiting_file':
      await ctx.reply("📎 Excel (.xlsx) faylni biriktirib yuboring yoki bekor qiling.");
      break;

    case 'operator_menu':
      await handleOperatorMenu(ctx, session, text);
      break;

    case 'family_street':
      await handleFamilyStreet(ctx, session, text);
      break;
    case 'family_house':
      await handleFamilyHouse(ctx, session, text);
      break;
    case 'family_apartment':
      await handleFamilyApartment(ctx, session, text);
      break;

    case 'citizen_name':
      await handleCitizenName(ctx, session, text);
      break;
    case 'citizen_gender':
      await handleCitizenGender(ctx, session, text);
      break;
    case 'citizen_birthdate':
      await handleCitizenBirthDate(ctx, session, text);
      break;
    case 'citizen_jshshir':
      await handleCitizenJshshir(ctx, session, text);
      break;
    case 'citizen_reference_confirm':
      await handleCitizenReferenceConfirm(ctx, session, text);
      break;
    case 'citizen_doc_number':
      await handleCitizenDocNumber(ctx, session, text);
      break;
    case 'citizen_phone':
      await handleCitizenPhone(ctx, session, text);
      break;
    case 'citizen_marital':
      await handleCitizenMarital(ctx, session, text);
      break;
    case 'citizen_education':
      await handleCitizenEducation(ctx, session, text);
      break;
    case 'citizen_occupation':
      await handleCitizenOccupation(ctx, session, text);
      break;
    case 'citizen_confirm':
      await handleCitizenConfirm(ctx, session, text);
      break;
    case 'citizen_saved':
      await handleCitizenSaved(ctx, session, text);
      break;

    default:
      await ctx.reply("Botdan foydalanish uchun /start buyrug'ini yuboring.");
      break;
  }
}

async function handleOperatorLogin(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (isAdmin(telegramId)) {
    await ctx.reply('❌ Admin akkaunt operator sifatida kira olmaydi.', Markup.removeKeyboard());
    return;
  }
  session.tempData.login = text;
  session.step = 'operator_password';
  await ctx.reply('Parol kiriting:');
}

async function handleOperatorPassword(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  const result = await verifyOperator(session.tempData.login, text);
  session.tempData = {};

  if (result.success && result.mahallaId && result.mahallaName) {
    await loginOperator(telegramId, result.mahallaId);
    session.step = 'operator_menu';
    session.role = 'operator';
    session.mahallaId = result.mahallaId;
    session.mahallaName = result.mahallaName;
    await ctx.reply(
      `✅ Tizimga muvaffaqiyatli kirdingiz.\n\n🏘 Mahalla: ${result.mahallaName}`,
      operatorMenuKeyboard()
    );
  } else {
    session.step = 'operator_login';
    await ctx.reply(`❌ ${result.error}\n\nLogin kiriting:`, Markup.removeKeyboard());
  }
}

async function handleAdminMenu(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  if (text === '🏘 Mahallalar') {
    const mahallas = await getAllMahallas();
    if (mahallas.length === 0) {
      await ctx.reply('Hozircha mahallalar mavjud emas.', adminMenuKeyboard());
      return;
    }

    let message = "🏘 Mahallalar ro'yxati:\n\n";
    mahallas.forEach((m, i) => {
      message += `${i + 1}. ${m.name}\n`;
      message += `   Login: ${m.login}\n`;
      message += `   Status: ${m.isActive ? '✅ Faol' : '❌ Nofaol'}\n\n`;
    });

    await ctx.reply(message, adminMenuKeyboard());
  } else if (text === '➕ Mahalla qo\'shish') {
    session.step = 'adding_mahalla_name';
    session.tempData = {};
    await ctx.reply('Mahalla nomini kiriting:', cancelKeyboard());
  } else if (text === '📥 Excel eksport') {
    session.step = 'export_menu';
    await ctx.reply('📥 Excel eksport turini tanlang:', exportMenuKeyboard());
  } else if (text === '📤 Excel import') {
    session.step = 'import_menu';
    session.tempData = {};
    await ctx.reply(
      "📤 Excel import.\n\n" +
      "📄 Shablon olish — bo'sh namuna fayl.\n" +
      "📤 Mahallaga yuklash — tanlangan mahallaga fayldagi fuqarolarni yozish.",
      importMenuKeyboard()
    );
  }
}

async function handleMahallaName(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  if (!text.trim()) {
    await ctx.reply("❌ Mahalla nomi bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.name = text.trim();
  session.step = 'adding_mahalla_login';
  await ctx.reply('Login kiriting:', cancelKeyboard());
}

async function handleMahallaLogin(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  if (!text.trim()) {
    await ctx.reply("❌ Login bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }

  const taken = await isLoginTaken(text);
  if (taken) {
    await ctx.reply(`❌ "${text.trim()}" login allaqachon mavjud. Boshqa login kiriting:`);
    return;
  }

  session.tempData.login = text.trim().toLowerCase();
  session.step = 'adding_mahalla_password';
  await ctx.reply('Parol kiriting (kamida 6 belgi):', cancelKeyboard());
}

async function handleMahallaPassword(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  const result = await createMahalla(session.tempData.name, session.tempData.login, text);
  session.tempData = {};

  if (result.success && result.mahalla) {
    session.step = 'admin_menu';
    await ctx.reply(
      `✅ Mahalla yaratildi.\n\n🏘 ${result.mahalla.name}\n🔐 Login: ${result.mahalla.login}`,
      adminMenuKeyboard()
    );
  } else {
    session.step = 'admin_menu';
    await ctx.reply(`❌ ${result.error}`, adminMenuKeyboard());
  }
}

async function handleExportMenu(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  if (text === '📥 Barcha Shofirkon') {
    await ctx.reply('📊 Excel tayyorlanmoqda...');
    try {
      const { filePath, fileName, count } = await exportAllCitizens();
      await ctx.replyWithDocument(
        { source: filePath, filename: fileName },
        { caption: `✅ Barcha Shofirkon fuqarolari: ${count} ta` }
      );
      fs.unlinkSync(filePath);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
    session.step = 'admin_menu';
    await ctx.reply('📋 Admin menyu:', adminMenuKeyboard());
  } else if (text === '📥 Mahalla bo\'yicha') {
    const mahallas = await getAllMahallas();
    if (mahallas.length === 0) {
      await ctx.reply('Hozircha mahallalar mavjud emas.', adminMenuKeyboard());
      session.step = 'admin_menu';
      return;
    }
    const buttons = mahallas.map((m) => [m.name]);
    buttons.push(['❌ Bekor qilish']);
    session.step = 'export_mahalla_select';
    await ctx.reply('🏘 Mahallani tanlang:', Markup.keyboard(buttons).resize());
  }
}

async function handleExportMahallaSelect(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  const mahallas = await getAllMahallas();
  const selected = mahallas.find((m) => m.name === text);

  if (!selected) {
    await ctx.reply("❌ Bunday mahalla topilmadi. Ro'yxatdan tanlang.");
    return;
  }

  await ctx.reply('📊 Excel tayyorlanmoqda...');
  try {
    const { filePath, fileName, count } = await exportByMahalla(String(selected._id), selected.name);
    await ctx.replyWithDocument(
      { source: filePath, filename: fileName },
      { caption: `✅ ${selected.name}: ${count} ta fuqaro` }
    );
    fs.unlinkSync(filePath);
  } catch (err: any) {
    await ctx.reply(`❌ ${err.message}`);
  }
  session.step = 'admin_menu';
  await ctx.reply('📋 Admin menyu:', adminMenuKeyboard());
}

async function handleImportMenu(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  if (text === '📄 Shablon olish') {
    await ctx.reply('📄 Shablon tayyorlanmoqda...');
    try {
      const { filePath, fileName } = await buildImportTemplate();
      await ctx.replyWithDocument(
        { source: filePath, filename: fileName },
        {
          caption:
            "📄 Shablonni to'ldirib qaytaring.\n\n" +
            "• Ikkita misol qator berilgan — ularni almashtiring yoki o'chiring.\n" +
            "• \"Yo'riqnoma\" varag'ida har bir ustunning izohi bor.",
        }
      );
      fs.unlinkSync(filePath);
    } catch (err: any) {
      await ctx.reply(`❌ ${err.message}`);
    }
  } else if (text === '📤 Mahallaga yuklash') {
    const mahallas = await getAllMahallas();
    if (mahallas.length === 0) {
      await ctx.reply('Hozircha mahallalar mavjud emas.', adminMenuKeyboard());
      session.step = 'admin_menu';
      return;
    }
    const buttons = mahallas.map((m) => [m.name]);
    buttons.push(['❌ Bekor qilish']);
    session.step = 'import_mahalla_select';
    await ctx.reply('🏘 Qaysi mahallaga yuklaymiz?', Markup.keyboard(buttons).resize());
  }
}

async function handleImportMahallaSelect(ctx: Context, session: UserSession, telegramId: number, text: string): Promise<void> {
  if (!isAdmin(telegramId)) return;

  const mahallas = await getAllMahallas();
  const selected = mahallas.find((m) => m.name === text);
  if (!selected) {
    await ctx.reply("❌ Bunday mahalla topilmadi. Ro'yxatdan tanlang.");
    return;
  }

  session.step = 'import_waiting_file';
  session.tempData = {
    importMahallaId: String(selected._id),
    importMahallaName: selected.name,
  };

  await ctx.reply(
    `✅ Tanlandi: ${selected.name}\n\n` +
    "📎 Excel (.xlsx) faylni biriktirib yuboring.\n\n" +
    "Fayl ichidagi mahalla nomi ustuni e'tiborga olinmaydi — barcha fuqarolar shu mahallaga yoziladi.",
    cancelKeyboard()
  );
}

async function handleOperatorMenu(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text === '🏠 Yangi oila') {
    session.step = 'family_street';
    session.tempData = {};
    await ctx.reply("🏠 Yangi oila yaratamiz.\n\n📍 Ko'cha nomini kiriting:", cancelKeyboard());
  }
}

async function handleFamilyStreet(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.reply("❌ Ko'cha nomi bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.street = text.trim();
  session.step = 'family_house';
  await ctx.reply('🏠 Uy raqamini kiriting:', cancelKeyboard());
}

async function handleFamilyHouse(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.reply("❌ Uy raqami bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.houseNumber = text.trim();
  session.step = 'family_apartment';
  await ctx.reply(
    "🚪 Xonadon raqamini kiriting:\n\nAgar xonadon raqami bo'lmasa, o'tkazib yuboring.",
    skipCancelKeyboard()
  );
}

async function handleFamilyApartment(ctx: Context, session: UserSession, text: string): Promise<void> {
  let apartmentNumber: string | undefined;

  if (text === '⏭ O\'tkazib yuborish') {
    apartmentNumber = undefined;
  } else if (!text.trim()) {
    await ctx.reply("❌ Xonadon raqamini kiriting yoki o'tkazib yuboring.");
    return;
  } else {
    apartmentNumber = text.trim();
  }

  const family = await createFamily({
    mahallaId: session.mahallaId!,
    street: session.tempData.street,
    houseNumber: session.tempData.houseNumber,
    apartmentNumber,
  });

  session.tempData = {};
  session.activeFamilyId = String(family._id);

  let message = '✅ Oila yaratildi!\n\n';
  message += `🏘 Mahalla: ${session.mahallaName}\n`;
  message += `📍 Ko'cha: ${family.street}\n`;
  message += `🏠 Uy: ${family.houseNumber}`;
  if (family.apartmentNumber) {
    message += `\n🚪 Xonadon: ${family.apartmentNumber}`;
  }
  message += '\n\n👤 Oila boshlig\'ining ma\'lumotlarini kiriting.';

  await ctx.reply(message);

  startCitizenFormHead(session);
  await ctx.reply('1. 👤 F.I.O. ni kiriting:', cancelKeyboard());
}
