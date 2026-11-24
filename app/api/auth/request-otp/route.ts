import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { normalizePhone } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const phone = normalizePhone(body.phone ?? '');
  if (!phone) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number (starts with 6–9).' }, { status: 400 });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.mutate((d) => {
    d.otps = d.otps.filter((o) => o.phone !== phone);
    d.otps.push({ phone, code, expiresAt, attempts: 0 });
  });
  // Demo mode: no SMS gateway is configured, so the OTP is returned in the response.
  // In production this is replaced by an SMS / WhatsApp provider send.
  return NextResponse.json({ ok: true, phone, demoMode: true, demoCode: code, message: 'Demo mode — no SMS was actually sent. Use the code below.' });
}
