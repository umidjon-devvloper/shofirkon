import { Context } from 'telegraf';
import { UserSession } from '../../types/session';
import { upsertCitizen } from '../../services/citizen.service';
import { findReferenceByJshshir, genderFromJshshir } from '../../services/reference.service';
import {
  cancelKeyboard,
  genderKeyboard,
  phoneKeyboard,
  maritalKeyboardMale,
  maritalKeyboardFemale,
  educationKeyboard,
  confirmKeyboard,
  referenceConfirmKeyboard,
  citizenSavedKeyboard,
  operatorMenuKeyboard,
  adminMenuKeyboard,
} from '../keyboards';

function isValidJshshir(value: string): boolean {
  return /^\d{14}$/.test(value);
}

function parseBirthDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const year = parseInt(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  if (date > new Date()) return null;
  if (year < 1900) return null;
  return date;
}

function formatDMY(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function advanceStep(session: UserSession): string {
  const n = parseInt(session.tempData.stepNum || '0') + 1;
  session.tempData.stepNum = String(n);
  return String(n);
}

function currentStep(session: UserSession): string {
  return session.tempData.stepNum || '1';
}

export function startCitizenFormHead(session: UserSession): void {
  session.tempData = { isFamilyHead: 'true', stepNum: '1' };
  session.step = 'citizen_name';
}

export function startCitizenFormMember(session: UserSession): void {
  session.tempData = { isFamilyHead: 'false', stepNum: '1' };
  session.step = 'citizen_name';
}

export async function handleCitizenCancel(ctx: Context, session: UserSession): Promise<void> {
  const wasHead = session.tempData.isFamilyHead === 'true';
  const isAdminRole = session.role === 'admin';
  session.tempData = {};

  if (isAdminRole) {
    session.activeFamilyId = undefined;
    session.mahallaId = undefined;
    session.mahallaName = undefined;
    session.step = 'admin_menu';
    await ctx.reply('❌ Bekor qilindi.', adminMenuKeyboard());
  } else if (wasHead) {
    session.activeFamilyId = undefined;
    session.step = 'operator_menu';
    await ctx.reply('❌ Bekor qilindi.', operatorMenuKeyboard());
  } else {
    session.step = 'citizen_saved';
    await ctx.reply('❌ Bekor qilindi.', citizenSavedKeyboard());
  }
}

export async function handleCitizenName(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.reply("❌ F.I.O. bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.fullName = text.trim();
  session.step = 'citizen_gender';
  const s = advanceStep(session);
  await ctx.reply(`${s}. Jinsini tanlang:`, genderKeyboard());
}

export async function handleCitizenGender(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text === '👨 Erkak') {
    session.tempData.gender = 'Erkak';
  } else if (text === '👩 Ayol') {
    session.tempData.gender = 'Ayol';
  } else {
    await ctx.reply(`${currentStep(session)}. Jinsini tanlang:`, genderKeyboard());
    return;
  }
  session.step = 'citizen_birthdate';
  const s = advanceStep(session);
  await ctx.reply(`${s}. Tug'ilgan sanani kiriting (KK.OO.YYYY):\n\nMasalan: 15.03.1985`, cancelKeyboard());
}

export async function handleCitizenBirthDate(ctx: Context, session: UserSession, text: string): Promise<void> {
  const date = parseBirthDate(text.trim());
  if (!date) {
    await ctx.reply("❌ Noto'g'ri sana formati.\nKK.OO.YYYY formatida kiriting.\n\nMasalan: 15.03.1985");
    return;
  }
  session.tempData.birthDate = text.trim();
  session.step = 'citizen_jshshir';
  const s = advanceStep(session);
  await ctx.reply(`${s}. JSHSHIR ni kiriting (14 raqam):`, cancelKeyboard());
}

export async function handleCitizenJshshir(ctx: Context, session: UserSession, text: string): Promise<void> {
  const jshshir = text.trim();
  if (!isValidJshshir(jshshir)) {
    await ctx.reply("❌ JSHSHIR 14 ta raqamdan iborat bo'lishi kerak.\nQaytadan kiriting:");
    return;
  }
  session.tempData.jshshir = jshshir;

  const ref = await findReferenceByJshshir(jshshir);
  if (ref) {
    session.tempData.refFullName = ref.fullName || '';
    session.tempData.refGender = ref.gender || genderFromJshshir(jshshir) || '';
    session.tempData.refBirthDate = ref.birthDate ? formatDMY(ref.birthDate) : '';
    session.tempData.refPassport = ref.passport || '';
    session.tempData.refPhone = ref.phone || '';
    session.tempData.refAddress = ref.address || '';
    session.tempData.refMahalla = ref.mahallaName || '';

    let msg = "💡 BAZADAN TOPILDI\n\n";
    msg += `👤 F.I.O.: ${ref.fullName}\n`;
    if (ref.gender) msg += `Jinsi: ${ref.gender}\n`;
    if (ref.birthDate) msg += `Tug'ilgan sana: ${formatDMY(ref.birthDate)}\n`;
    msg += `JSHSHIR: ${jshshir}\n`;
    if (ref.passport) msg += `Pasport: ${ref.passport}\n`;
    if (ref.phone) msg += `Telefon: ${ref.phone}\n`;
    if (ref.address) msg += `Manzil: ${ref.address}\n`;
    if (ref.mahallaName) msg += `Mahalla (bazadagi): ${ref.mahallaName}\n`;
    msg += "\n✅ Bazadan foydalanishni tanlasangiz, yuqoridagi ma'lumotlar avtomatik qo'yiladi va faqat qolgan maydonlarni to'ldirasiz.";

    session.step = 'citizen_reference_confirm';
    await ctx.reply(msg, referenceConfirmKeyboard());
    return;
  }

  session.step = 'citizen_doc_number';
  const s = advanceStep(session);
  await ctx.reply(`${s}. Hujjat raqamini kiriting:`, cancelKeyboard());
}

export async function handleCitizenReferenceConfirm(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text === '✅ Bazadan foydalanish') {
    const d = session.tempData;
    if (d.refFullName) d.fullName = d.refFullName;
    if (d.refGender) d.gender = d.refGender;
    if (d.refBirthDate) d.birthDate = d.refBirthDate;
    if (d.refPassport) d.documentNumber = d.refPassport;
    if (d.refPhone) d.phone = d.refPhone;

    delete d.refFullName; delete d.refGender; delete d.refBirthDate;
    delete d.refPassport; delete d.refPhone; delete d.refAddress; delete d.refMahalla;

    if (!d.documentNumber) {
      session.step = 'citizen_doc_number';
      const s = advanceStep(session);
      await ctx.reply(`${s}. Hujjat raqamini kiriting:`, cancelKeyboard());
      return;
    }
    if (!d.phone) {
      session.step = 'citizen_phone';
      const s = advanceStep(session);
      await ctx.reply(`${s}. 📞 Telefon raqamini kiriting:`, phoneKeyboard());
      return;
    }
    session.step = 'citizen_marital';
    const s = advanceStep(session);
    const keyboard = d.gender === 'Erkak' ? maritalKeyboardMale() : maritalKeyboardFemale();
    await ctx.reply(`${s}. Oilaviy holatini tanlang:`, keyboard);
    return;
  }

  if (text === "✏️ Qo'lda davom etish") {
    const d = session.tempData;
    delete d.refFullName; delete d.refGender; delete d.refBirthDate;
    delete d.refPassport; delete d.refPhone; delete d.refAddress; delete d.refMahalla;

    session.step = 'citizen_doc_number';
    const s = advanceStep(session);
    await ctx.reply(`${s}. Hujjat raqamini kiriting:`, cancelKeyboard());
    return;
  }

  await ctx.reply('Tugmalardan birini tanlang:', referenceConfirmKeyboard());
}

export async function handleCitizenDocNumber(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.reply("❌ Hujjat raqami bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.documentNumber = text.trim();
  session.step = 'citizen_phone';
  const s = advanceStep(session);
  await ctx.reply(`${s}. 📞 Telefon raqamini kiriting:`, phoneKeyboard());
}

export async function handleCitizenPhone(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text !== '⏭ O\'tkazib yuborish') {
    session.tempData.phone = text.trim();
  }
  session.step = 'citizen_marital';
  const s = advanceStep(session);
  const keyboard = session.tempData.gender === 'Erkak' ? maritalKeyboardMale() : maritalKeyboardFemale();
  await ctx.reply(`${s}. Oilaviy holatini tanlang:`, keyboard);
}

const VALID_MARITAL_MALE = ['Uylangan', "Bo'ydoq", 'Ajrashgan', 'Beva'];
const VALID_MARITAL_FEMALE = ['Turmushga chiqqan', 'Turmushga chiqmagan', 'Ajrashgan', 'Beva'];

export async function handleCitizenMarital(ctx: Context, session: UserSession, text: string): Promise<void> {
  const validOptions = session.tempData.gender === 'Erkak' ? VALID_MARITAL_MALE : VALID_MARITAL_FEMALE;
  const keyboard = session.tempData.gender === 'Erkak' ? maritalKeyboardMale() : maritalKeyboardFemale();

  if (!validOptions.includes(text)) {
    await ctx.reply(`${currentStep(session)}. Oilaviy holatini tanlang:`, keyboard);
    return;
  }
  session.tempData.maritalStatus = text;
  session.step = 'citizen_education';
  const s = advanceStep(session);
  await ctx.reply(`${s}. Ta'lim darajasini tanlang:`, educationKeyboard());
}

const VALID_EDUCATION = [
  "Ta'limsiz", "Boshlang'ich", "Umumiy o'rta", "O'rta maxsus",
  'Professional', 'Oliy', 'Magistr', 'Boshqa',
];

export async function handleCitizenEducation(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!VALID_EDUCATION.includes(text)) {
    await ctx.reply(`${currentStep(session)}. Ta'lim darajasini tanlang:`, educationKeyboard());
    return;
  }
  session.tempData.education = text;
  session.step = 'citizen_occupation';
  const s = advanceStep(session);
  await ctx.reply(`${s}. Kasbi/Bandligini kiriting:`, cancelKeyboard());
}

export async function handleCitizenOccupation(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.reply("❌ Kasbi/Bandligi bo'sh bo'lishi mumkin emas. Qaytadan kiriting:");
    return;
  }
  session.tempData.occupation = text.trim();
  session.step = 'citizen_confirm';
  await showConfirmation(ctx, session);
}

async function showConfirmation(ctx: Context, session: UserSession): Promise<void> {
  const d = session.tempData;
  const birthDate = parseBirthDate(d.birthDate)!;
  const age = calculateAge(birthDate);
  const role = d.isFamilyHead === 'true' ? 'Oila boshlig\'i' : 'Oila a\'zosi';

  let msg = "📋 FUQARO MA'LUMOTLARI\n\n";
  msg += `Turi: ${role}\n`;
  msg += `F.I.O.: ${d.fullName}\n`;
  msg += `Jinsi: ${d.gender}\n`;
  msg += `Tug'ilgan sana: ${d.birthDate}\n`;
  msg += `Yoshi: ${age}\n`;
  msg += `JSHSHIR: ${d.jshshir}\n`;
  msg += `Hujjat raqami: ${d.documentNumber}\n`;
  msg += `Telefon: ${d.phone || 'Kiritilmagan'}\n`;
  msg += `Oilaviy holati: ${d.maritalStatus}\n`;
  msg += `Ta'lim: ${d.education}\n`;
  msg += `Kasbi/Bandligi: ${d.occupation}\n`;

  await ctx.reply(msg, confirmKeyboard());
}

export async function handleCitizenConfirm(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text === '✅ Saqlash') {
    const d = session.tempData;
    const birthDate = parseBirthDate(d.birthDate)!;
    const isHead = d.isFamilyHead === 'true';

    const result = await upsertCitizen({
      fullName: d.fullName,
      gender: d.gender,
      birthDate,
      jshshir: d.jshshir,
      documentNumber: d.documentNumber,
      phone: d.phone || undefined,
      familyId: session.activeFamilyId!,
      mahallaId: session.mahallaId!,
      isFamilyHead: isHead,
      maritalStatus: d.maritalStatus,
      education: d.education,
      occupation: d.occupation,
    });

    session.tempData = {};
    session.step = 'citizen_saved';

    let msg: string;
    if (result.isUpdate) {
      msg = "✅ Fuqaro ma'lumotlari yangilandi.";
    } else if (isHead) {
      msg = '✅ Oila boshlig\'i saqlandi.';
    } else {
      msg = '✅ Oila a\'zosi saqlandi.';
    }

    if (session.role === 'admin') {
      await ctx.reply(msg + "\n\nYana a'zo qo'shish uchun /add buyrug'ini yuboring.", adminMenuKeyboard());
      session.activeFamilyId = undefined;
      session.mahallaId = undefined;
      session.mahallaName = undefined;
      session.step = 'admin_menu';
    } else {
      await ctx.reply(msg, citizenSavedKeyboard());
    }
  } else if (text === '❌ Bekor qilish') {
    await handleCitizenCancel(ctx, session);
  }
}

export async function handleCitizenSaved(ctx: Context, session: UserSession, text: string): Promise<void> {
  if (text === '➕ Oila a\'zosi qo\'shish') {
    startCitizenFormMember(session);
    await ctx.reply('1. 👤 F.I.O. ni kiriting:', cancelKeyboard());
  } else if (text === '✅ Oilani yakunlash') {
    session.activeFamilyId = undefined;
    session.step = 'operator_menu';
    await ctx.reply('✅ Oila muvaffaqiyatli yakunlandi.', operatorMenuKeyboard());
  }
}
