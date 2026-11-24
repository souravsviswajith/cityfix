'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Report, ReportStatus } from '@/lib/types';
import { getCategory } from '@/lib/categories';

const ORDER: ReportStatus[] = ['submitted', 'acknowledged', 'in_progress', 'resolved'];
const STATUS_LABEL: Record<ReportStatus, string> = { submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'In progress', resolved: 'Resolved' };

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');

  useEffect(() => {
    const token = localStorage.getItem('cityfix_token');
    if (!token) { window.location.href = '/login?next=/dashboard'; return; }
    fetch('/api/reports', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Could not load reports'); return r.json(); })
      .then((d) => setReports(d.reports))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => (reports ?? []).filter((r) => filter === 'all' || r.status === filter), [reports, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports?.length ?? 0 };
    for (const s of ORDER) c[s] = (reports ?? []).filter((r) => r.status === s).length;
    return c;
  }, [reports]);

  if (error) return <div className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-muted">{error}</p><Link href="/login" className="btn btn-primary mt-4">Sign in again</Link></div>;
  if (!reports) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">{[...Array(3)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-pine-50" />)}</div>;

  const resolvedCount = counts['resolved'] ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My reports</p>
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight text-pine-950">Track your complaints</h1>
          <p className="mt-1 text-sm text-muted">{reports.length} filed · {resolvedCount} resolved — ref numbers stay valid for appeals.</p>
        </div>
        <Link href="/report" className="btn btn-primary">+ New report</Link>
      </div>

      {/* filter chips */}
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {(['all', ...ORDER] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'chip-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABEL[f]} · {counts[f] ?? 0}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <span className="text-4xl" aria-hidden="true">🕳️</span>
            <h2 className="font-display text-xl font-bold text-pine-900">{filter === 'all' ? 'No reports yet' : `No ${STATUS_LABEL[filter as ReportStatus].toLowerCase()} reports`}</h2>
            <p className="max-w-sm text-sm text-muted">See a pothole, a leaking pipe, a dead streetlight on your street? File your first report — it reaches the officer in minutes.</p>
            <Link href="/report" className="btn btn-primary mt-2">Report an issue →</Link>
          </div>
        )}
        {filtered.map((r) => {
          const idx = ORDER.indexOf(r.status);
          const cat = getCategory(r.category);
          return (
            <Link key={r.id} href={`/dashboard/${r.id}`} className="card card-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              {r.photo
                ? <img src={r.photo} alt="" className="h-24 w-full shrink-0 rounded-xl object-cover sm:w-28" />
                : <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl bg-pine-50 font-display text-2xl font-black text-pine-800 sm:w-28" aria-hidden="true">{cat.short.charAt(0)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[0.65rem] font-semibold tracking-wider text-muted">{r.refNo}</span>
                  <span className={`pill pill-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="text-[0.7rem] font-semibold text-muted">· {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <h2 className="mt-1.5 truncate font-display text-lg font-bold leading-snug text-pine-950">{r.title}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{r.jurisdictionName} · {r.address}</p>
                {/* progress bar */}
                <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                  {ORDER.map((s, i) => (
                    <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-pine-600' : 'bg-line'}`} />
                  ))}
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b6b62" strokeWidth="2" strokeLinecap="round" className="hidden shrink-0 sm:block"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
