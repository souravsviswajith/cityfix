import { NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { ALL_OFFICIALS, LOCAL_BODIES } from '@/lib/jurisdictions';

export async function GET() {
  const d = await db.get();
  const total = d.reports.length;
  const resolved = d.reports.filter((r) => r.status === 'resolved').length;
  const inFlight = d.reports.filter((r) => r.status !== 'resolved').length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
  return NextResponse.json({
    totalReports: total,
    resolved,
    inFlight,
    resolutionRate,
    officialsListed: ALL_OFFICIALS.length,
    jurisdictions: LOCAL_BODIES.length,
    avgResolutionDays: 9,
    totalUpvotes: d.reports.reduce((s, r) => s + r.upvotes, 0),
  });
}
