import { Markup } from 'telegraf';

export function adminMenuKeyboard() {
  return Markup.keyboard([
    ['🏘 Mahallalar', '➕ Mahalla qo\'shish'],
    ['📥 Excel eksport', '📤 Excel import'],
  ]).resize();
}

export function exportMenuKeyboard() {
  return Markup.keyboard([
    ['📥 Barcha Shofirkon'],
    ['📥 Mahalla bo\'yicha'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function importMenuKeyboard() {
  return Markup.keyboard([
    ['📄 Shablon olish'],
    ['📤 Mahallaga yuklash'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function operatorMenuKeyboard() {
  return Markup.keyboard([
    ['🏠 Yangi oila'],
    ['📥 Excel eksport', '📤 Excel import'],
    ['🚪 Chiqish'],
  ]).resize();
}

export function operatorImportMenuKeyboard() {
  return Markup.keyboard([
    ['📄 Shablon olish'],
    ['📤 Faylni yuklash'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function cancelKeyboard() {
  return Markup.keyboard([['❌ Bekor qilish']]).resize();
}

export function skipCancelKeyboard() {
  return Markup.keyboard([['⏭ O\'tkazib yuborish', '❌ Bekor qilish']]).resize();
}

export function citizenSavedKeyboard() {
  return Markup.keyboard([
    ['➕ Oila a\'zosi qo\'shish'],
    ['✅ Oilani yakunlash'],
  ]).resize();
}

export function confirmKeyboard() {
  return Markup.keyboard([['✅ Saqlash', '❌ Bekor qilish']]).resize();
}

export function referenceConfirmKeyboard() {
  return Markup.keyboard([
    ["✅ To'g'ri, saqlash"],
    ['✏️ Tahrirlash'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function keepFieldKeyboard() {
  return Markup.keyboard([
    ['✅ Qoldirish'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function keepFieldGenderKeyboard() {
  return Markup.keyboard([
    ['✅ Qoldirish'],
    ['👨 Erkak', '👩 Ayol'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function keepFieldPhoneKeyboard() {
  return Markup.keyboard([
    ['✅ Qoldirish'],
    ["⏭ O'tkazib yuborish"],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function genderKeyboard() {
  return Markup.keyboard([['👨 Erkak', '👩 Ayol'], ['❌ Bekor qilish']]).resize();
}

export function phoneKeyboard() {
  return Markup.keyboard([
    ['⏭ O\'tkazib yuborish'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function maritalKeyboardMale() {
  return Markup.keyboard([
    ['Uylangan', 'Bo\'ydoq'],
    ['Ajrashgan', 'Beva'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function maritalKeyboardFemale() {
  return Markup.keyboard([
    ['Turmushga chiqqan', 'Turmushga chiqmagan'],
    ['Ajrashgan', 'Beva'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function educationKeyboard() {
  return Markup.keyboard([
    ['Ta\'limsiz', 'Boshlang\'ich'],
    ['Umumiy o\'rta', 'O\'rta maxsus'],
    ['Professional', 'Oliy'],
    ['Magistr', 'Boshqa'],
    ['❌ Bekor qilish'],
  ]).resize();
}
