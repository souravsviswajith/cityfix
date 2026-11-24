import { NextResponse } from 'next/server';
import { ALL_OFFICIALS } from '@/lib/jurisdictions';
import { LOCAL_BODIES } from '@/lib/jurisdictions';

export async function GET() {
  return NextResponse.json({
    count: ALL_OFFICIALS.length,
    officials: ALL_OFFICIALS,
    jurisdictions: LOCAL_BODIES.map((b) => ({ id: b.id, name: b.name, district: b.district, type: b.type })),
  });
}
