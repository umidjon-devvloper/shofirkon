import bcrypt from 'bcryptjs';
import { Mahalla, IMahalla } from '../models/Mahalla';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

interface CreateMahallaResult {
  success: boolean;
  mahalla?: IMahalla;
  error?: string;
}

export async function createMahalla(
  name: string,
  login: string,
  password: string
): Promise<CreateMahallaResult> {
  if (!name.trim()) {
    return { success: false, error: "Mahalla nomi bo'sh bo'lishi mumkin emas." };
  }

  if (!login.trim()) {
    return { success: false, error: "Login bo'sh bo'lishi mumkin emas." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak.`,
    };
  }

  const existing = await Mahalla.findOne({ login: login.toLowerCase().trim() });
  if (existing) {
    return { success: false, error: `"${login}" login allaqachon mavjud.` };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const mahalla = await Mahalla.create({
    name: name.trim(),
    login: login.toLowerCase().trim(),
    passwordHash,
  });

  return { success: true, mahalla };
}

export async function getAllMahallas(): Promise<IMahalla[]> {
  return Mahalla.find().sort({ name: 1 });
}

export async function isLoginTaken(login: string): Promise<boolean> {
  const existing = await Mahalla.findOne({ login: login.toLowerCase().trim() });
  return existing !== null;
}
