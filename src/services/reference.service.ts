import { CitizenReference, ICitizenReference } from '../models/CitizenReference';

export function genderFromJshshir(jshshir: string): string | undefined {
  if (!/^\d{14}$/.test(jshshir)) return undefined;
  const first = jshshir[0];
  if (first === '1' || first === '3' || first === '5') return 'Erkak';
  if (first === '2' || first === '4' || first === '6') return 'Ayol';
  return undefined;
}

export async function findReferenceByJshshir(jshshir: string): Promise<ICitizenReference | null> {
  if (!/^\d{14}$/.test(jshshir)) return null;
  return CitizenReference.findOne({ jshshir }).lean() as any;
}

export function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/O['‘’`]/g, "O'")
    .replace(/G['‘’`]/g, "G'")
    .trim();
}

export function normalizePhone(raw: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('+')) return digits;
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return digits;
}
