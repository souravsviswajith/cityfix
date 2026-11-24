'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getCategory } from '@/lib/categories';
import type { ReportStatus, Severity } from '@/lib/types';

const PulseMap = dynamic(() => import('@/components/PulseMap'), { ssr: false, loading: () => <div className="h-[440px] animate-pulse rounded-2xl bg-pine-50" /> });

interface PulseItem {
  id: string; refNo: string; category: string; title: string; severity: Severity; status: ReportStatus;
  address: string; jurisdictionName: string; lat: number; lng: number; createdAt: string; upvotes: number; photo?: string;
}

const STATUS_LABEL: Record<string, string> = { submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'In progress', resolved: 'Resolved' };
const DOT: Record<string, string> = { submitted: '#e8590c', acknowledged: '#0b5cad', in_progress: '#6d28d9', resolved: '#15803d' };

export default function PulsePage() {
  const [items, setItems] = useState<PulseItem[] | null>(null);
  const [filter, setFilter] = useState<'all' | ReportStatus>('all');
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/pulse').then((r) => r.json()).then((d) => setItems(d.reports)).catch(() => setItems([]));
    try { setUpvoted(new Set(JSON.parse(localStorage.getItem('cityfix_upvotes') ?? '[]'))); } catch { /* ignore */ }
  }, []);

  const filtered = useMemo(() => (items ?? []).filter((i) => filter === 'all' || i.status === filter), [items, filter]);
  const maxUp = Math.max(1, ...(items ?? []).map((i) => i.upvotes));

  const upvote = async (id: string) => {
    if (upvoted.has(id)) return;
    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i)) ?? prev);
    setUpvoted((prev) => { const s = new Set(prev); s.add(id); localStorage.setItem('cityfix_upvotes', JSON.stringify([...s])); return s; });
    fetch(`/api/reports/${id}/upvote`, { method: 'POST' }).catch(() => {
      setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, upvotes: Math.max(0, i.upvotes - 1) } : i)) ?? prev);
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Civic pulse · live from the community</p>
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight text-pine-950">What your city is<br />already reporting</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">Anonymised reports from across the five Kerala corporations. Upvote what affects you — clustered votes become louder signals to the department.</p>
        </div>
        <Link href="/report" className="btn btn-primary">+ Add yours</Link>
      </div>

      {/* legend + filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(['all', 'submitted', 'acknowledged', 'in_progress', 'resolved'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'chip-active' : ''}`} onClick={() => setFilter(f)}>
            {f !== 'all' && <span className="inline-block h-2 w-2 rounded-full" style={{ background: DOT[f] }} />}
            {f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-3 font-mono text-[0.62rem] uppercase tracking-wider text-muted md:flex">Marker size = severity</span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-5">
        {/* map */}
        <div className="lg:col-span-3">
          {items ? <PulseMap reports={filtered} /> : <div className="h-[440px] animate-pulse rounded-2xl bg-pine-50" />}
          <div className="mt-3 flex flex-wrap gap-3 text-[0.7rem] font-semibold text-muted">
            {Object.entries(DOT).map(([s, c]) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border border-white shadow" style={{ background: c }} />{STATUS_LABEL[s]}</span>
            ))}
          </div>
        </div>

        {/* feed */}
        <aside className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1 lg:col-span-2" aria-label="Latest community reports">
          {items === null && [...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-pine-50" />)}
          {filtered.length === 0 && items !== null && <p className="card p-6 text-center text-sm text-muted">Nothing with this status yet.</p>}
          {filtered.map((i) => (
            <article key={i.id} className="card flex gap-3 p-4">
              {i.photo
                ? <img src={i.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-pine-50 text-2xl" aria-hidden="true">{getCategory(i.category).short.charAt(0)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.58rem] font-semibold tracking-wider text-muted">{i.refNo}</span>
                  <span className={`pill pill-${i.status} !px-2 !py-0.5 !text-[0.6rem]`}>{STATUS_LABEL[i.status]}</span>
                </div>
                <h2 className="mt-1 line-clamp-2 text-[0.85rem] font-bold leading-snug text-pine-950">{i.title}</h2>
                <p className="mt-0.5 truncate text-[0.68rem] text-muted">{i.jurisdictionName}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={() => upvote(i.id)} disabled={upvoted.has(i.id)} aria-pressed={upvoted.has(i.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold transition-colors ${upvoted.has(i.id) ? 'border-saffron-600 bg-saffron-100 text-saffron-700' : 'border-line text-pine-800 hover:border-saffron-600 hover:text-saffron-700'}`}>
                    ▲ {i.upvotes}
                  </button>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" title="Community salience">
                    <div className="h-full rounded-full bg-saffron-500" style={{ width: `${Math.round((i.upvotes / maxUp) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </aside>
      </div>
      <p className="mt-6 text-[0.72rem] text-muted">Pulse shows location and issue only — never the reporter&apos;s identity or phone number. Counts include seeded demo reports.</p>
    </div>
  );
}
