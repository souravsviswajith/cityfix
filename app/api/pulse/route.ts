import { NextResponse } from 'next/server';
import { db } from '@/lib/store';

// Public community pulse: deliberately anonymised — no user identity, no contact details.
export async function GET() {
  const d = await db.get();
  const feed = [...d.reports]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((r) => ({
      id: r.id,
      refNo: r.refNo,
      category: r.category,
      title: r.title,
      severity: r.severity,
      status: r.status,
      address: r.address,
      jurisdictionName: r.jurisdictionName,
      lat: r.lat,
      lng: r.lng,
      createdAt: r.createdAt,
      upvotes: r.upvotes,
      photo: r.photo,
    }));
  return NextResponse.json({ reports: feed });
}
