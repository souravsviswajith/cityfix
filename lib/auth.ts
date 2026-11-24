import { NextRequest } from 'next/server';
import { db } from './store';
import type { User } from './types';

export async function getSessionUser(req: NextRequest): Promise<{ user: User; token: string } | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const dbShape = await db.get();
  const session = dbShape.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = dbShape.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { user, token };
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let national = digits;
  if (national.startsWith('91') && national.length === 12) national = national.slice(2);
  if (national.startsWith('0') && national.length === 11) national = national.slice(1);
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}
