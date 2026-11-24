import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/store';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser(req);
  const dbShape = await db.get();
  const report = dbShape.reports.find((r) => r.id === id || r.refNo === id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const isOwner = session?.user.id === report.userId;
  if (!isOwner && report.userId !== 'seed') {
    return NextResponse.json({ error: 'This report is private to its author' }, { status: 403 });
  }
  // Never leak ownership for seeded/community content
  const { userId, draftBody, ...pub } = report;
  return NextResponse.json({ report: isOwner ? report : { ...pub, isCommunity: true } });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: { action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const updated = await db.mutate((d) => {
    const report = d.reports.find((r) => r.id === id);
    if (!report) return { error: 'not_found' as const };
    if (report.userId !== session.user.id) return { error: 'forbidden' as const };
    const now = new Date().toISOString();
    if (body.action === 'resolve') {
      report.status = 'resolved';
      report.updatedAt = now;
      report.timeline.push({ at: now, label: 'Marked resolved by citizen', note: 'Citizen confirmed the issue is fixed' });
      return { report };
    }
    if (body.action === 'escalate') {
      report.status = 'in_progress';
      report.updatedAt = now;
      report.timeline.push({ at: now, label: 'Escalated to District Collector', note: 'No action within the committed 15-day window; escalation copy dispatched' });
      return { report };
    }
    return { error: 'bad_action' as const };
  });

  if ('error' in updated) {
    const map = { not_found: [404, 'Report not found'], forbidden: [403, 'You can only update your own reports'], bad_action: [400, 'Unknown action'] } as const;
    const [status, message] = map[updated.error as keyof typeof map];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ report: updated.report });
}
