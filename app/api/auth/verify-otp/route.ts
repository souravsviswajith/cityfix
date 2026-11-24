import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/store';
import { normalizePhone } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const phone = normalizePhone(body.phone ?? '');
  const code = (body.code ?? '').trim();
  if (!phone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });

  const result = await db.mutate((d) => {
    const otp = d.otps.find((o) => o.phone === phone);
    if (!otp) return { ok: false as const, error: 'No code requested for this number. Tap “Send code” again.' };
    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      d.otps = d.otps.filter((o) => o.phone !== phone);
      return { ok: false as const, error: 'Code expired. Request a fresh one.' };
    }
    otp.attempts += 1;
    if (otp.attempts > 5) {
      d.otps = d.otps.filter((o) => o.phone !== phone);
      return { ok: false as const, error: 'Too many attempts. Request a fresh code.' };
    }
    if (otp.code !== code) return { ok: false as const, error: 'Incorrect code. Please try again.' };
    d.otps = d.otps.filter((o) => o.phone !== phone);

    let user = d.users.find((u) => u.phone === phone);
    if (!user) {
      user = { id: crypto.randomUUID(), phone, name: (body.name ?? '').trim(), createdAt: new Date().toISOString() };
      d.users.push(user);
    } else if (body.name && body.name.trim() && !user.name) {
      user.name = body.name.trim();
    }
    const token = crypto.randomBytes(32).toString('hex');
    d.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
    return { ok: true as const, token, user };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ token: result.token, user: result.user });
}
