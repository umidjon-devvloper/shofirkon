import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { connectDatabase, disconnectDatabase } from '../db/connection';
import { CitizenReference } from '../models/CitizenReference';
import { cleanName, genderFromJshshir, normalizePhone } from '../services/reference.service';

interface Row {
  jshshir: string;
  fullName: string;
  fullNameCyrillic?: string;
  passport?: string;
  birthDate?: Date;
  phone?: string;
  address?: string;
  mahallaName?: string;
  gender?: string;
}

function cellStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) {
    const d = v.getUTCDate().toString().padStart(2, '0');
    const m = (v.getUTCMonth() + 1).toString().padStart(2, '0');
    const y = v.getUTCFullYear();
    return `${d}.${m}.${y}`;
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('').trim();
    if ('text' in v) return String(v.text ?? '').trim();
    if ('result' in v) return cellStr(v.result);
  }
  return String(v).trim();
}

function parseDate(s: string): Date | undefined {
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return undefined;
  const day = parseInt(m[1]);
  const mo = parseInt(m[2]) - 1;
  const y = parseInt(m[3]);
  const d = new Date(Date.UTC(y, mo, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo || d.getUTCDate() !== day) return undefined;
  if (d > new Date() || y < 1900) return undefined;
  return d;
}

function parsePassport(raw: string): string | undefined {
  const s = raw.trim().toUpperCase();
  if (!s) return undefined;
  if (/^[A-Z]{2}\d{7}$/.test(s)) return s;
  if (/^\d{7}$/.test(s)) return s;
  return s;
}

async function flush(batch: Row[], source: string, stats: { inserted: number; updated: number }) {
  if (batch.length === 0) return;
  const ops = batch.map((row) => ({
    updateOne: {
      filter: { jshshir: row.jshshir },
      update: {
        $set: {
          fullName: row.fullName,
          ...(row.fullNameCyrillic ? { fullNameCyrillic: row.fullNameCyrillic } : {}),
          ...(row.passport ? { passport: row.passport } : {}),
          ...(row.birthDate ? { birthDate: row.birthDate } : {}),
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.address ? { address: row.address } : {}),
          ...(row.mahallaName ? { mahallaName: row.mahallaName } : {}),
          ...(row.gender ? { gender: row.gender } : {}),
        },
        $addToSet: { sources: source },
        $setOnInsert: { jshshir: row.jshshir },
      },
      upsert: true,
    },
  }));
  const result = await CitizenReference.bulkWrite(ops, { ordered: false });
  stats.inserted += result.upsertedCount || 0;
  stats.updated += (result.modifiedCount || 0);
}

async function loadBalans(filePath: string): Promise<{ parsed: number; skipped: number; inserted: number; updated: number }> {
  console.log(`\n📘 Loading Balans: ${filePath}`);
  const wb = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { entries: 'emit', sharedStrings: 'cache', styles: 'ignore' });

  const stats = { inserted: 0, updated: 0 };
  let parsed = 0, skipped = 0;
  const BATCH_SIZE = 1000;
  let batch: Row[] = [];
  const seen = new Set<string>();

  for await (const worksheet of wb as any) {
    for await (const row of worksheet) {
      const rn = row.number;
      if (rn === 1) continue;
      const mahalla = cellStr(row.getCell(2).value);
      const fio = cellStr(row.getCell(3).value);
      const passport = cellStr(row.getCell(4).value);
      const jshshir = cellStr(row.getCell(5).value);
      const address = cellStr(row.getCell(6).value);
      const phone = cellStr(row.getCell(7).value);
      const birthDate = cellStr(row.getCell(8).value);

      if (!/^\d{14}$/.test(jshshir)) { skipped++; continue; }
      if (seen.has(jshshir)) { skipped++; continue; }
      seen.add(jshshir);

      batch.push({
        jshshir,
        fullName: cleanName(fio),
        passport: parsePassport(passport),
        birthDate: parseDate(birthDate),
        phone: normalizePhone(phone),
        address: address || undefined,
        mahallaName: mahalla || undefined,
        gender: genderFromJshshir(jshshir),
      });
      parsed++;

      if (batch.length >= BATCH_SIZE) {
        await flush(batch, 'balans-2025', stats);
        batch = [];
        process.stdout.write(`\r  parsed=${parsed} inserted=${stats.inserted} updated=${stats.updated}`);
      }
    }
  }
  if (batch.length) await flush(batch, 'balans-2025', stats);
  console.log(`\n  ✓ parsed=${parsed} skipped=${skipped} inserted=${stats.inserted} updated=${stats.updated}`);
  return { parsed, skipped, ...stats };
}

async function loadXatlov(filePath: string): Promise<{ parsed: number; skipped: number; inserted: number; updated: number }> {
  console.log(`\n📙 Loading Xatlov: ${filePath}`);
  const wb = new ExcelJS.stream.xlsx.WorkbookReader(filePath, { entries: 'emit', sharedStrings: 'cache', styles: 'ignore' });

  const stats = { inserted: 0, updated: 0 };
  let parsed = 0, skipped = 0;
  const BATCH_SIZE = 1000;
  let batch: Row[] = [];
  const seen = new Set<string>();

  for await (const worksheet of wb as any) {
    for await (const row of worksheet) {
      const rn = row.number;
      if (rn === 1) continue;
      const fioLatin = cellStr(row.getCell(2).value);
      const fioCyrl = cellStr(row.getCell(3).value);
      const jshshir = cellStr(row.getCell(4).value);
      const passport = cellStr(row.getCell(5).value);
      const birthDate = cellStr(row.getCell(6).value);
      const phone = cellStr(row.getCell(7).value);
      const address = cellStr(row.getCell(10).value);

      if (!/^\d{14}$/.test(jshshir)) { skipped++; continue; }
      if (seen.has(jshshir)) { skipped++; continue; }
      seen.add(jshshir);

      batch.push({
        jshshir,
        fullName: cleanName(fioLatin || fioCyrl),
        fullNameCyrillic: fioCyrl || undefined,
        passport: parsePassport(passport),
        birthDate: parseDate(birthDate),
        phone: normalizePhone(phone),
        address: address || undefined,
        gender: genderFromJshshir(jshshir),
      });
      parsed++;

      if (batch.length >= BATCH_SIZE) {
        await flush(batch, 'xatlov-2022', stats);
        batch = [];
        process.stdout.write(`\r  parsed=${parsed} inserted=${stats.inserted} updated=${stats.updated}`);
      }
    }
  }
  if (batch.length) await flush(batch, 'xatlov-2022', stats);
  console.log(`\n  ✓ parsed=${parsed} skipped=${skipped} inserted=${stats.inserted} updated=${stats.updated}`);
  return { parsed, skipped, ...stats };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run load-reference -- <path-to-xlsx> [--type=balans|xatlov] [more paths...]');
    console.error('If --type is omitted, auto-detected by filename.');
    process.exit(1);
  }

  await connectDatabase();

  try {
    for (const arg of args) {
      if (arg.startsWith('--')) continue;
      if (!fs.existsSync(arg)) {
        console.error(`❌ File not found: ${arg}`);
        continue;
      }
      const base = path.basename(arg).toLowerCase();
      const typeArg = args.find((a) => a.startsWith('--type='))?.split('=')[1];
      const type = typeArg || (base.includes('balans') ? 'balans' : base.includes('хатлов') || base.includes('xatlov') ? 'xatlov' : null);

      if (type === 'balans') await loadBalans(arg);
      else if (type === 'xatlov') await loadXatlov(arg);
      else {
        console.error(`❌ Cannot detect type for ${arg}. Use --type=balans or --type=xatlov.`);
      }
    }

    const total = await CitizenReference.countDocuments();
    console.log(`\n✅ Done. Total reference records: ${total}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
