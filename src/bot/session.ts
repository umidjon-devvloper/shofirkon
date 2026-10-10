import { UserSession } from '../types/session';

const sessions = new Map<number, UserSession>();

export function getSession(telegramId: number): UserSession {
  let session = sessions.get(telegramId);
  if (!session) {
    session = { step: 'idle', tempData: {} };
    sessions.set(telegramId, session);
  }
  return session;
}

export function resetSession(telegramId: number): void {
  sessions.set(telegramId, { step: 'idle', tempData: {} });
}
