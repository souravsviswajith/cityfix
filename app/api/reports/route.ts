import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { resolveAuthorities } from '@/lib/jurisdictions';
import { getCategory } from '@/lib/categories';
import type { Officer, Report, Severity } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const dbShape = await db.get();
  const mine = dbShape.reports
    .filter((r) => r.userId === session.user.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ reports: mine });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Please sign in to file your report.' }, { status: 401 });

  let body: {
    refNo?: string; category?: string; title?: string; description?: string; severity?: Severity;
    address?: string; landmark?: string; lat?: number; lng?: number;
    photo?: string; hasVideo?: boolean; channel?: 'email' | 'whatsapp' | 'download';
    draftSubject?: string; draftBody?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!body.category || !body.title?.trim() || !body.description?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing required report fields.' }, { status: 400 });
  }
  if (body.photo && body.photo.length > 6_000_000) {
    return NextResponse.json({ error: 'Photo is too large (max ~4 MB). Please retake or compress it.' }, { status: 413 });
  }

  const cat = getCategory(body.category);
  const resolved = resolveAuthorities(lat, lng, cat.departmentId);
  const officials = [resolved.departmentOfficer, resolved.elected, resolved.collector, resolved.stateContact].filter(Boolean) as Officer[];

  const created = await db.mutate((d) => {
    const now = new Date().toISOString();
    const refNo = body.refNo && /^CFX-\d{4}-\d{4}$/.test(body.refNo) ? body.refNo : db.nextRefNo(d);
    const report: Report = {
      id: crypto.randomUUID(),
      refNo,
      userId: session.user.id,
      category: body.category!,
      title: body.title!.trim(),
      description: body.description!.trim(),
      severity: body.severity ?? 'medium',
      address: (body.address ?? '').trim(),
      landmark: body.landmark?.trim() || undefined,
      lat, lng,
      jurisdictionId: resolved.body.id,
      jurisdictionName: resolved.body.name,
      departmentName: cat.departmentLabel,
      officials,
      draftSubject: (body.draftSubject ?? `Formal complaint — ${body.title}`).trim(),
      draftBody: (body.draftBody ?? '').trim(),
      channel: body.channel ?? 'email',
      photo: body.photo,
      hasVideo: body.hasVideo || undefined,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
      timeline: [
        { at: now, label: 'Complaint filed & geotagged', note: `Evidence attached · addressed to ${resolved.departmentOfficer?.designation ?? resolved.elected?.designation ?? 'department'}, ${resolved.body.name}` },
        { at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), label: body.channel === 'whatsapp' ? 'Notification sent via WhatsApp' : body.channel === 'download' ? 'Complaint letter downloaded by citizen' : 'Complaint e-mail dispatched', note: 'Citizen review & submission completed' },
      ],
      upvotes: 0,
    };
    d.reports.push(report);
    return report;
  });

  return NextResponse.json({ report: created }, { status: 201 });
}
