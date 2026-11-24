import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/store';
import { resolveAuthorities } from '@/lib/jurisdictions';
import { getCategory } from '@/lib/categories';
import { generateDraft } from '@/lib/draft';
import type { Severity } from '@/lib/types';

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Please sign in to generate your complaint draft.' }, { status: 401 });

  let body: {
    category?: string; title?: string; description?: string; severity?: Severity;
    address?: string; landmark?: string; lat?: number; lng?: number;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!body.category || !body.title?.trim() || !body.description?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Category, title, description and coordinates are required.' }, { status: 400 });
  }

  const cat = getCategory(body.category);
  const resolved = resolveAuthorities(lat, lng, cat.departmentId);
  const primary = resolved.departmentOfficer ?? resolved.elected;
  if (!primary) return NextResponse.json({ error: 'No authority could be resolved for this location.' }, { status: 500 });

  // Allocate the reference number now so the draft and the final submission share it
  const refNo = await db.mutate((d) => db.nextRefNo(d));

  const { subject, body: draftBody } = generateDraft({
    refNo,
    name: session.user.name || 'A Concerned Citizen',
    phone: session.user.phone,
    category: body.category,
    title: body.title,
    description: body.description,
    severity: body.severity ?? 'medium',
    address: body.address ?? '',
    landmark: body.landmark,
    lat,
    lng,
    jurisdictionName: resolved.body.name,
    primaryOfficerName: primary.name,
    primaryDesignation: primary.designation,
    primaryDepartment: primary.department,
  });

  return NextResponse.json({
    refNo,
    subject,
    body: draftBody,
    jurisdiction: resolved.body.name,
    primaryRecipient: { name: primary.name, designation: primary.designation, email: primary.email, phone: primary.phone },
  });
}
