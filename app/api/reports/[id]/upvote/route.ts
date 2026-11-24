import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await db.mutate((d) => {
    const report = d.reports.find((r) => r.id === id);
    if (!report) return null;
    report.upvotes += 1;
    return { id: report.id, upvotes: report.upvotes };
  });
  if (!result) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json(result);
}
