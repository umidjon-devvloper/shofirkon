import ExcelJS from 'exceljs';
import path from 'path';
import os from 'os';
import { Citizen } from '../models/Citizen';
import { Family } from '../models/Family';
import { Mahalla } from '../models/Mahalla';

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

interface ExportRow {
  mahallaName: string;
  familyId: string;
  isFamilyHead: boolean;
  fullName: string;
  gender: string;
  birthDate: Date;
  jshshir: string;
  documentNumber: string;
  phone?: string;
  maritalStatus: string;
  education: string;
  occupation: string;
  street: string;
  houseNumber: string;
  apartmentNumber?: string;
}

async function buildRows(mahallaId?: string): Promise<ExportRow[]> {
  const filter = mahallaId ? { mahallaId } : {};

  const citizens = await Citizen.find(filter).lean();
  if (citizens.length === 0) return [];

  const familyIds = [...new Set(citizens.map((c) => String(c.familyId)))];
  const families = await Family.find({ _id: { $in: familyIds } }).lean();
  const familyMap = new Map(families.map((f) => [String(f._id), f]));

  const mahallaIds = [...new Set(citizens.map((c) => String(c.mahallaId)))];
  const mahallas = await Mahalla.find({ _id: { $in: mahallaIds } }).lean();
  const mahallaMap = new Map(mahallas.map((m) => [String(m._id), m]));

  const rows: ExportRow[] = citizens.map((c) => {
    const family = familyMap.get(String(c.familyId));
    const mahalla = mahallaMap.get(String(c.mahallaId));

    return {
      mahallaName: mahalla?.name || '',
      familyId: family?.familyId || '',
      isFamilyHead: c.isFamilyHead ?? false,
      fullName: c.fullName,
      gender: c.gender,
      birthDate: c.birthDate,
      jshshir: c.jshshir,
      documentNumber: c.documentNumber,
      phone: c.phone || undefined,
      maritalStatus: c.maritalStatus,
      education: c.education,
      occupation: c.occupation,
      street: family?.street || '',
      houseNumber: family?.houseNumber || '',
      apartmentNumber: family?.apartmentNumber || undefined,
    };
  });

  rows.sort((a, b) => {
    if (a.mahallaName !== b.mahallaName) return a.mahallaName.localeCompare(b.mahallaName);
    if (a.familyId !== b.familyId) return a.familyId.localeCompare(b.familyId);
    return a.fullName.localeCompare(b.fullName);
  });

  return rows;
}

const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'Mahalla', key: 'mahalla', width: 20 },
  { header: 'Oila ID', key: 'familyId', width: 16 },
  { header: 'Turi', key: 'type', width: 16 },
  { header: 'F.I.O.', key: 'fullName', width: 30 },
  { header: 'Jinsi', key: 'gender', width: 10 },
  { header: "Tug'ilgan sana", key: 'birthDate', width: 14 },
  { header: 'Yoshi', key: 'age', width: 8 },
  { header: 'JSHSHIR', key: 'jshshir', width: 18 },
  { header: 'Hujjat raqami', key: 'docNumber', width: 14 },
  { header: 'Telefon', key: 'phone', width: 16 },
  { header: 'Oilaviy holati', key: 'marital', width: 20 },
  { header: "Ta'lim darajasi", key: 'education', width: 16 },
  { header: 'Kasbi/Bandligi', key: 'occupation', width: 22 },
  { header: "Ko'cha", key: 'street', width: 20 },
  { header: 'Uy raqami', key: 'houseNumber', width: 12 },
  { header: 'Xonadon raqami', key: 'apartment', width: 14 },
];

function buildWorkbook(rows: ExportRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Fuqarolar');

  ws.columns = COLUMNS;

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  for (const row of rows) {
    ws.addRow({
      mahalla: row.mahallaName,
      familyId: row.familyId,
      type: row.isFamilyHead ? 'Oila boshlig\'i' : 'Oila a\'zosi',
      fullName: row.fullName,
      gender: row.gender,
      birthDate: formatDate(row.birthDate),
      age: calculateAge(row.birthDate),
      jshshir: row.jshshir,
      docNumber: row.documentNumber,
      phone: row.phone || '',
      marital: row.maritalStatus,
      education: row.education,
      occupation: row.occupation,
      street: row.street,
      houseNumber: row.houseNumber,
      apartment: row.apartmentNumber || '',
    });
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  return wb;
}

export async function exportAllCitizens(): Promise<{ filePath: string; fileName: string; count: number }> {
  const rows = await buildRows();
  if (rows.length === 0) {
    throw new Error("Ma'lumot topilmadi.");
  }

  const wb = buildWorkbook(rows);
  const fileName = 'Shofirkon_barcha_fuqarolar.xlsx';
  const filePath = path.join(os.tmpdir(), fileName);
  await wb.xlsx.writeFile(filePath);

  return { filePath, fileName, count: rows.length };
}

export async function exportByMahalla(mahallaId: string, mahallaName: string): Promise<{ filePath: string; fileName: string; count: number }> {
  const rows = await buildRows(mahallaId);
  if (rows.length === 0) {
    throw new Error("Bu mahallada fuqaro topilmadi.");
  }

  const wb = buildWorkbook(rows);
  const safeName = mahallaName.replace(/[^a-zA-Z0-9Ѐ-ӿ\s_-]/g, '').trim();
  const fileName = `${safeName}.xlsx`;
  const filePath = path.join(os.tmpdir(), fileName);
  await wb.xlsx.writeFile(filePath);

  return { filePath, fileName, count: rows.length };
}
