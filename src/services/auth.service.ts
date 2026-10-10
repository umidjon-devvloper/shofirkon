import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { Mahalla } from '../models/Mahalla';
import { Operator } from '../models/Operator';

interface OperatorLoginResult {
  success: boolean;
  mahallaId?: string;
  mahallaName?: string;
  error?: string;
}

export function isAdmin(telegramId: number): boolean {
  return env.ADMIN_TELEGRAM_IDS.includes(telegramId);
}

export async function verifyOperator(login: string, password: string): Promise<OperatorLoginResult> {
  const mahalla = await Mahalla.findOne({ login: login.toLowerCase().trim() });

  if (!mahalla) {
    return { success: false, error: "Login yoki parol noto'g'ri." };
  }

  if (!mahalla.isActive) {
    return { success: false, error: 'Bu mahalla hozirda faol emas.' };
  }

  const isMatch = await bcrypt.compare(password, mahalla.passwordHash);
  if (!isMatch) {
    return { success: false, error: "Login yoki parol noto'g'ri." };
  }

  return {
    success: true,
    mahallaId: mahalla._id.toString(),
    mahallaName: mahalla.name,
  };
}

export async function loginOperator(telegramId: number, mahallaId: string): Promise<void> {
  await Operator.findOneAndUpdate(
    { telegramId },
    { telegramId, mahallaId, isAuthenticated: true },
    { upsert: true }
  );
}

export async function logoutOperator(telegramId: number): Promise<void> {
  await Operator.updateOne(
    { telegramId },
    { isAuthenticated: false }
  );
}

export async function getAuthenticatedOperator(telegramId: number): Promise<{ mahallaId: string; mahallaName: string } | null> {
  const operator = await Operator.findOne({ telegramId, isAuthenticated: true });
  if (!operator) return null;

  const mahalla = await Mahalla.findById(operator.mahallaId);
  if (!mahalla || !mahalla.isActive) return null;

  return {
    mahallaId: mahalla._id.toString(),
    mahallaName: mahalla.name,
  };
}
