import ExcelJS from 'exceljs';
import path from 'path';
import os from 'os';
import { Citizen } from '../models/Citizen';
import { Family } from '../models/Family';
import { createFamily } from './family.service';
import { upsertCitizen } from './citizen.service';

const VALID_GENDERS = ['Erkak', 'Ayol'];
const VALID_EDUCATION = [
  "Ta'limsiz", "Boshlang'ich", "Umumiy o'rta", "O'rta maxsus",
  'Professional', 'Oliy', 'Magistr', 'Boshqa',
];
const VALID_MARITAL_MALE = ['Uylangan', "Bo'ydoq", 'Ajrashgan', 'Beva'];
const VALID_MARITAL_FEMALE = ['Turmushga chiqqan', 'Turmushga chiqmagan', 'Ajrashgan', 'Beva'];

const REQUIRED_COLUMNS = [
  'F.I.O.', 'Jinsi', "Tug'ilgan sana", 'JSHSHIR', 'Hujjat raqami',
  'Oilaviy holati', "Ta'lim darajasi", 'Kasbi/Bandligi', "Ko'cha", 'Uy raqami',
];

const ALL_COLUMNS = [
  'Oila ID', 'Turi', 'F.I.O.', 'Jinsi', "Tug'ilgan sana",
  'JSHSHIR', 'Hujjat raqami', 'Telefon', 'Oilaviy holati',
  "Ta'lim darajasi", 'Kasbi/Bandligi', "Ko'cha", 'Uy raqami', 'Xonadon raqami',
];

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  familiesCreated: number;
  errors: string[];
}

function cellToString(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const value: any = cell.value;
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) {
    const d = value.getUTCDate().toString().padStart(2, '0');
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = value.getUTCFullYear();
    return `${d}.${m}.${y}`;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((r: any) => r.text).join('').trim();
    }
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) {
      const r = value.result;
      if (r instanceof Date) {
        const d = r.getUTCDate().toString().padStart(2, '0');
        const m = (r.getUTCMonth() + 1).toString().padStart(2, '0');
        const y = r.getUTCFullYear();
        return `${d}.${m}.${y}`;
      }
      return String(r ?? '').trim();
    }
  }
  return String(value).trim();
}

function parseBirthDate(input: string): Date | null {
  const str = input.trim();
  const match = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const year = parseInt(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  if (date > new Date()) return null;
  if (year < 1900) return null;
  return date;
}

function addrKey(street: string, house: string, apt?: string): string {
  return `${street.toLowerCase().trim()}|${house.toLowerCase().trim()}|${(apt || '').toLowerCase().trim()}`;
}

export async function importFromExcel(mahallaId: string, buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch (_) {
    throw new Error("Faylni o'qib bo'lmadi. Excel (.xlsx) formatda yuboring.");
  }

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) {
    throw new Error("Faylda ma'lumot topilmadi.");
  }

  const headerRow = ws.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const name = cellToString(cell);
    if (name) colIndex[name] = col;
  });

  const missing = REQUIRED_COLUMNS.filter((h) => !(h in colIndex));
  if (missing.length > 0) {
    throw new Error(`Yetishmayotgan ustunlar: ${missing.join(', ')}`);
  }

  const existingFamilies = await Family.find({ mahallaId }).lean();
  const familyByOilaId = new Map(existingFamilies.map((f) => [f.familyId, String(f._id)]));
  const familyByAddr = new Map(existingFamilies.map((f) => [addrKey(f.street, f.houseNumber, f.apartmentNumber), String(f._id)]));

  const result: ImportResult = { totalRows: 0, created: 0, updated: 0, familiesCreated: 0, errors: [] };
  const newFamilyIds = new Set<string>();
  const familyCache = new Map<string, string>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (name: string): string =>
      colIndex[name] ? cellToString(row.getCell(colIndex[name])) : '';

    const fullName = get('F.I.O.');
    if (!fullName) continue;

    result.totalRows++;

    try {
      const gender = get('Jinsi');
      const birthDateStr = get("Tug'ilgan sana");
      const jshshir = get('JSHSHIR');
      const docNumber = get('Hujjat raqami');
      const phone = get('Telefon');
      const marital = get('Oilaviy holati');
      const education = get("Ta'lim darajasi");
      const occupation = get('Kasbi/Bandligi');
      const street = get("Ko'cha");
      const houseNumber = get('Uy raqami');
      const apartmentRaw = get('Xonadon raqami');
      const apartment = apartmentRaw || undefined;
      const oilaIdRaw = get('Oila ID');
      const type = get('Turi');

      if (!VALID_GENDERS.includes(gender)) {
        throw new Error("Jinsi noto'g'ri (Erkak/Ayol bo'lishi kerak)");
      }
      const birthDate = parseBirthDate(birthDateStr);
      if (!birthDate) {
        throw new Error("Tug'ilgan sana noto'g'ri (KK.OO.YYYY formatida)");
      }
      if (!/^\d{14}$/.test(jshshir)) {
        throw new Error("JSHSHIR 14 ta raqamdan iborat bo'lishi kerak");
      }
      if (!docNumber) throw new Error("Hujjat raqami bo'sh");
      const validMarital = gender === 'Erkak' ? VALID_MARITAL_MALE : VALID_MARITAL_FEMALE;
      if (!validMarital.includes(marital)) {
        throw new Error("Oilaviy holati noto'g'ri");
      }
      if (!VALID_EDUCATION.includes(education)) {
        throw new Error("Ta'lim darajasi noto'g'ri");
      }
      if (!occupation) throw new Error("Kasbi/Bandligi bo'sh");
      if (!street) throw new Error("Ko'cha bo'sh");
      if (!houseNumber) throw new Error("Uy raqami bo'sh");

      const isHead = /boshli[gq]/i.test(type);

      let familyIdStr: string | undefined;

      if (oilaIdRaw) {
        const uid = oilaIdRaw.toUpperCase();
        if (!/^OILA-\d{6}$/.test(uid)) {
          throw new Error(`Oila ID formati noto'g'ri: ${oilaIdRaw}`);
        }
        familyIdStr = familyByOilaId.get(uid);
        if (!familyIdStr) {
          throw new Error(`Oila topilmadi: ${uid}`);
        }
      }

      if (!familyIdStr) {
        const key = addrKey(street, houseNumber, apartment);
        familyIdStr = familyCache.get(key) || familyByAddr.get(key);
        if (!familyIdStr) {
          const fam = await createFamily({ mahallaId, street, houseNumber, apartmentNumber: apartment });
          familyIdStr = String(fam._id);
          familyByAddr.set(key, familyIdStr);
          familyByOilaId.set(fam.familyId, familyIdStr);
          newFamilyIds.add(familyIdStr);
          result.familiesCreated++;
        }
        familyCache.set(key, familyIdStr);
      }

      const upsertRes = await upsertCitizen({
        fullName,
        gender,
        birthDate,
        jshshir,
        documentNumber: docNumber,
        phone: phone || undefined,
        familyId: familyIdStr,
        mahallaId,
        isFamilyHead: isHead,
        maritalStatus: marital,
        education,
        occupation,
      });

      if (upsertRes.isUpdate) result.updated++;
      else result.created++;
    } catch (err: any) {
      result.errors.push(`Qator ${r}: ${err.message || err}`);
    }
  }

  for (const fid of newFamilyIds) {
    const hasHead = await Citizen.findOne({ familyId: fid, isFamilyHead: true });
    if (!hasHead) {
      const earliest = await Citizen.findOne({ familyId: fid }).sort({ createdAt: 1 });
      if (earliest) {
        await Citizen.updateOne({ _id: earliest._id }, { isFamilyHead: true });
      }
    }
  }

  return result;
}

export async function buildImportTemplate(): Promise<{ filePath: string; fileName: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Fuqarolar');

  ws.columns = [
    { header: 'Oila ID', key: 'oilaId', width: 14 },
    { header: 'Turi', key: 'type', width: 18 },
    { header: 'F.I.O.', key: 'fullName', width: 30 },
    { header: 'Jinsi', key: 'gender', width: 10 },
    { header: "Tug'ilgan sana", key: 'birthDate', width: 14 },
    { header: 'JSHSHIR', key: 'jshshir', width: 18 },
    { header: 'Hujjat raqami', key: 'docNumber', width: 14 },
    { header: 'Telefon', key: 'phone', width: 16 },
    { header: 'Oilaviy holati', key: 'marital', width: 20 },
    { header: "Ta'lim darajasi", key: 'education', width: 16 },
    { header: 'Kasbi/Bandligi', key: 'occupation', width: 22 },
    { header: "Ko'cha", key: 'street', width: 22 },
    { header: 'Uy raqami', key: 'houseNumber', width: 12 },
    { header: 'Xonadon raqami', key: 'apartment', width: 14 },
  ];

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };

  ws.getColumn('jshshir').numFmt = '@';
  ws.getColumn('phone').numFmt = '@';
  ws.getColumn('docNumber').numFmt = '@';
  ws.getColumn('birthDate').numFmt = '@';
  ws.getColumn('houseNumber').numFmt = '@';
  ws.getColumn('apartment').numFmt = '@';

  ws.addRow({
    oilaId: '',
    type: "Oila boshlig'i",
    fullName: 'Alijonov Ali Alijonovich',
    gender: 'Erkak',
    birthDate: '15.03.1980',
    jshshir: '12345678901234',
    docNumber: 'AA1234567',
    phone: '+998901234567',
    marital: 'Uylangan',
    education: 'Oliy',
    occupation: 'Hisobchi',
    street: "Mustaqillik ko'chasi",
    houseNumber: '12',
    apartment: '5',
  });
  ws.addRow({
    oilaId: '',
    type: "Oila a'zosi",
    fullName: 'Alijonova Nilufar Baxtiyorovna',
    gender: 'Ayol',
    birthDate: '20.05.1985',
    jshshir: '12345678901235',
    docNumber: 'AA1234568',
    phone: '',
    marital: 'Turmushga chiqqan',
    education: "O'rta maxsus",
    occupation: 'Shifokor',
    street: "Mustaqillik ko'chasi",
    houseNumber: '12',
    apartment: '5',
  });

  const notesSheet = wb.addWorksheet('Yo\'riqnoma');
  notesSheet.columns = [{ header: 'Ustun', width: 24 }, { header: 'Izoh', width: 80 }];
  notesSheet.getRow(1).font = { bold: true };
  const notes: Array<[string, string]> = [
    ['Oila ID', "Majburiy emas. Mavjud oilaga qo'shish uchun OILA-XXXXXX kiriting. Bo'sh qoldirsangiz manzil bo'yicha yangi oila yaratiladi."],
    ['Turi', "\"Oila boshlig'i\" yoki \"Oila a'zosi\". Har bir oilada bitta boshlig' bo'ladi."],
    ['F.I.O.', 'Majburiy. To\'liq ism-sharif.'],
    ['Jinsi', 'Majburiy. Faqat "Erkak" yoki "Ayol".'],
    ["Tug'ilgan sana", 'Majburiy. KK.OO.YYYY formatida (masalan 15.03.1985).'],
    ['JSHSHIR', "Majburiy. 14 ta raqam. Bir xil JSHSHIR qayta uchrasa, yangilanadi."],
    ['Hujjat raqami', 'Majburiy.'],
    ['Telefon', "Majburiy emas."],
    ['Oilaviy holati', "Erkak uchun: Uylangan / Bo'ydoq / Ajrashgan / Beva. Ayol uchun: Turmushga chiqqan / Turmushga chiqmagan / Ajrashgan / Beva."],
    ["Ta'lim darajasi", "Ta'limsiz / Boshlang'ich / Umumiy o'rta / O'rta maxsus / Professional / Oliy / Magistr / Boshqa."],
    ['Kasbi/Bandligi', 'Majburiy.'],
    ["Ko'cha", "Majburiy. Yangi oila manzili uchun ishlatiladi."],
    ['Uy raqami', 'Majburiy.'],
    ['Xonadon raqami', 'Majburiy emas.'],
  ];
  for (const [col, note] of notes) notesSheet.addRow([col, note]);
  notesSheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const fileName = 'Shofirkon_import_shabloni.xlsx';
  const filePath = path.join(os.tmpdir(), fileName);
  await wb.xlsx.writeFile(filePath);
  return { filePath, fileName };
}

export { ALL_COLUMNS };
