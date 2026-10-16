import { Context } from 'telegraf';
import { getSession } from '../session';
import { isAdmin } from '../../services/auth.service';
import { Citizen } from '../../models/Citizen';
import { Family } from '../../models/Family';
import { Mahalla } from '../../models/Mahalla';
import { findReferenceByJshshir } from '../../services/reference.service';
import { startCitizenFormMember, CITIZEN_FIRST_PROMPT } from './citizen';
import { cancelKeyboard, adminMenuKeyboard } from '../keyboards';

export async function handleStat(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const totalCitizens = await Citizen.countDocuments();
  const totalFamilies = await Family.countDocuments();
  const totalMahallas = await Mahalla.countDocuments({ isActive: true });

  let msg = "📊 STATISTIKA\n\n";
  msg += `👥 Jami fuqarolar: ${totalCitizens}\n`;
  msg += `🏠 Jami oilalar: ${totalFamilies}\n`;
  msg += `🏘 Jami mahallalar: ${totalMahallas}\n`;

  if (isAdmin(telegramId)) {
    const mahallas = await Mahalla.find({ isActive: true }).sort({ name: 1 }).lean();

    if (mahallas.length > 0) {
      msg += "\n📋 Mahallalar bo'yicha:\n\n";

      for (const m of mahallas) {
        const citizenCount = await Citizen.countDocuments({ mahallaId: m._id });
        const familyCount = await Family.countDocuments({ mahallaId: m._id });
        msg += `🏘 ${m.name}\n`;
        msg += `   👥 ${citizenCount} fuqaro, 🏠 ${familyCount} oila\n\n`;
      }
    }
  }

  await ctx.reply(msg);
}

export async function handleRemove(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  if (!isAdmin(telegramId)) {
    await ctx.reply("❌ Bu buyruq faqat admin uchun.");
    return;
  }

  const msg = ctx.message;
  if (!msg || !('text' in msg)) return;

  const parts = msg.text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("❌ Format: /remove JSHSHIR\n\nMasalan: /remove 12345678901234");
    return;
  }

  const jshshir = parts[1].trim();
  if (!/^\d{14}$/.test(jshshir)) {
    await ctx.reply("❌ JSHSHIR 14 ta raqamdan iborat bo'lishi kerak.");
    return;
  }

  const citizen = await Citizen.findOne({ jshshir });
  if (!citizen) {
    await ctx.reply(`❌ JSHSHIR ${jshshir} bo'yicha fuqaro topilmadi.`);
    return;
  }

  const family = await Family.findById(citizen.familyId);
  const mahalla = await Mahalla.findById(citizen.mahallaId);
  const wasHead = citizen.isFamilyHead;
  const familyId = String(citizen.familyId);

  await Citizen.deleteOne({ _id: citizen._id });

  if (wasHead) {
    const nextHead = await Citizen.findOne({ familyId }).sort({ createdAt: 1 });
    if (nextHead) {
      await Citizen.updateOne({ _id: nextHead._id }, { isFamilyHead: true });
    }
  }

  let msg2 = `✅ Fuqaro o'chirildi.\n\n`;
  msg2 += `👤 ${citizen.fullName}\n`;
  msg2 += `📄 JSHSHIR: ${jshshir}\n`;
  if (mahalla) msg2 += `🏘 Mahalla: ${mahalla.name}\n`;
  if (family) msg2 += `🏠 ${family.street}, uy ${family.houseNumber}\n`;
  if (wasHead) msg2 += `\n⚠️ Oila boshlig'i edi — yangi boshlig' tayinlandi.`;

  await ctx.reply(msg2, adminMenuKeyboard());
}

export async function handleAdd(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  if (!isAdmin(telegramId)) {
    await ctx.reply("❌ Bu buyruq faqat admin uchun.");
    return;
  }

  const msg = ctx.message;
  if (!msg || !('text' in msg)) return;

  const parts = msg.text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("❌ Format: /add OILA-XXXXXX\n\nMasalan: /add OILA-000001");
    return;
  }

  const familyIdStr = parts[1].trim().toUpperCase();
  if (!/^OILA-\d{6}$/.test(familyIdStr)) {
    await ctx.reply("❌ Oila ID formati noto'g'ri.\n\nFormat: OILA-XXXXXX\nMasalan: /add OILA-000001");
    return;
  }

  const family = await Family.findOne({ familyId: familyIdStr });
  if (!family) {
    await ctx.reply(`❌ "${familyIdStr}" oila topilmadi.`);
    return;
  }

  const mahalla = await Mahalla.findById(family.mahallaId);
  if (!mahalla) {
    await ctx.reply("❌ Oilaga tegishli mahalla topilmadi.");
    return;
  }

  const session = getSession(telegramId);
  session.step = 'citizen_name';
  session.role = 'admin';
  session.activeFamilyId = String(family._id);
  session.mahallaId = String(mahalla._id);
  session.mahallaName = mahalla.name;

  startCitizenFormMember(session);

  let info = `✅ Oila topildi.\n\n`;
  info += `🏘 Mahalla: ${mahalla.name}\n`;
  info += `📍 ${family.street}, uy ${family.houseNumber}`;
  if (family.apartmentNumber) info += `, xonadon ${family.apartmentNumber}`;

  const members = await Citizen.find({ familyId: family._id }).sort({ createdAt: 1 }).lean();
  if (members.length > 0) {
    info += `\n\n👥 Oila a'zolari (${members.length}):\n`;
    for (const m of members) {
      info += `${m.isFamilyHead ? '👑' : '  •'} ${m.fullName}\n`;
    }
  }

  info += "\n\n👤 Yangi a'zoning ma'lumotlarini kiriting.";

  await ctx.reply(info);
  await ctx.reply(CITIZEN_FIRST_PROMPT, cancelKeyboard());
}

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export async function handleFind(ctx: Context): Promise<void> {
  if (ctx.chat?.type !== 'private') return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  if (!isAdmin(telegramId)) {
    await ctx.reply("❌ Bu buyruq faqat admin uchun.");
    return;
  }

  const msg = ctx.message;
  if (!msg || !('text' in msg)) return;

  const parts = msg.text.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply("❌ Format: /find JSHSHIR\n\nMasalan: /find 12345678901234");
    return;
  }

  const jshshir = parts[1].trim();
  if (!/^\d{14}$/.test(jshshir)) {
    await ctx.reply("❌ JSHSHIR 14 ta raqamdan iborat bo'lishi kerak.");
    return;
  }

  const citizen = await Citizen.findOne({ jshshir }).lean();
  if (!citizen) {
    const ref = await findReferenceByJshshir(jshshir);
    if (ref) {
      let info = "ℹ️ Fuqaro ro'yxatga olinmagan, lekin bazada mavjud:\n\n";
      info += `👤 F.I.O.: ${ref.fullName}\n`;
      if (ref.gender) info += `Jinsi: ${ref.gender}\n`;
      if (ref.birthDate) info += `Tug'ilgan sana: ${formatDate(ref.birthDate)}\n`;
      info += `JSHSHIR: ${jshshir}\n`;
      if (ref.passport) info += `Pasport: ${ref.passport}\n`;
      if (ref.phone) info += `Telefon: ${ref.phone}\n`;
      if (ref.address) info += `Manzil: ${ref.address}\n`;
      if (ref.mahallaName) info += `Mahalla (bazadagi): ${ref.mahallaName}\n`;
      info += `\n📥 Manba: ${(ref.sources || []).join(', ')}`;
      await ctx.reply(info);
      return;
    }
    await ctx.reply(`❌ JSHSHIR ${jshshir} bo'yicha fuqaro topilmadi.`);
    return;
  }

  const family = await Family.findById(citizen.familyId).lean();
  const mahalla = await Mahalla.findById(citizen.mahallaId).lean();

  let info = "🔍 FUQARO MA'LUMOTLARI\n\n";
  info += `👤 F.I.O.: ${citizen.fullName}\n`;
  info += `${citizen.isFamilyHead ? '👑 Oila boshlig\'i' : '👥 Oila a\'zosi'}\n`;
  info += `Jinsi: ${citizen.gender}\n`;
  info += `Tug'ilgan sana: ${formatDate(citizen.birthDate)}\n`;
  info += `Yoshi: ${calculateAge(citizen.birthDate)}\n`;
  info += `JSHSHIR: ${citizen.jshshir}\n`;
  info += `Hujjat raqami: ${citizen.documentNumber}\n`;
  info += `Telefon: ${citizen.phone || 'Kiritilmagan'}\n`;
  info += `Oilaviy holati: ${citizen.maritalStatus}\n`;
  info += `Ta'lim: ${citizen.education}\n`;
  info += `Kasbi/Bandligi: ${citizen.occupation}\n`;

  if (mahalla) info += `\n🏘 Mahalla: ${mahalla.name}\n`;
  if (family) {
    info += `🏠 Manzil: ${family.street}, uy ${family.houseNumber}`;
    if (family.apartmentNumber) info += `, xonadon ${family.apartmentNumber}`;
    info += `\n📋 Oila ID: ${family.familyId}\n`;

    const members = await Citizen.find({ familyId: family._id, jshshir: { $ne: jshshir } }).sort({ createdAt: 1 }).lean();
    if (members.length > 0) {
      info += `\n👥 Boshqa oila a'zolari:\n`;
      for (const m of members) {
        info += `${m.isFamilyHead ? '👑' : '  •'} ${m.fullName} (${m.jshshir})\n`;
      }
    }
  }

  await ctx.reply(info);
}
