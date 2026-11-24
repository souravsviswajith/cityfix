import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthorities } from '@/lib/jurisdictions';
import { getCategory } from '@/lib/categories';

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  const category = req.nextUrl.searchParams.get('category') ?? 'other';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }
  const cat = getCategory(category);
  const resolved = resolveAuthorities(lat, lng, cat.departmentId);
  return NextResponse.json({
    jurisdiction: {
      id: resolved.body.id,
      name: resolved.body.name,
      district: resolved.body.district,
      type: resolved.body.type,
      distanceKm: resolved.distanceKm,
    },
    department: cat.departmentLabel,
    authorities: {
      department: resolved.departmentOfficer,
      elected: resolved.elected,
      collector: resolved.collector,
      state: resolved.stateContact,
    },
  });
}
