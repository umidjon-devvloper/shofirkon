import { Markup } from 'telegraf';

export function adminMenuKeyboard() {
  return Markup.keyboard([
    ['🏘 Mahallalar', '➕ Mahalla qo\'shish'],
    ['📥 Excel eksport'],
  ]).resize();
}

export function exportMenuKeyboard() {
  return Markup.keyboard([
    ['📥 Barcha Shofirkon'],
    ['📥 Mahalla bo\'yicha'],
    ['❌ Bekor qilish'],
  ]).resize();
}

export function operatorMenuKeyboard() {
  return Markup.keyboard([
    ['🏠 Yangi oila'],
    ['🚪 Chiqish'],
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
