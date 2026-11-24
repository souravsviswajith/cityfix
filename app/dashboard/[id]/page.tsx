'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Report } from '@/lib/types';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false, loading: () => <div className="h-[220px] animate-pulse rounded-2xl bg-pine-50" /> });

const STATUS_LABEL: Record<string, string> = { submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'In progress', resolved: 'Resolved' };

export default function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    const token = localStorage.getItem('cityfix_token');
    fetch(`/api/reports/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Could not load report'); return r.json(); })
      .then((d) => setReport(d.report))
      .catch((e) => setError(e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const act = async (action: 'resolve' | 'escalate') => {
    setBusy(true);
    const token = localStorage.getItem('cityfix_token');
    try {
      const r = await fetch(`/api/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Action failed');
      setReport(d.report);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([report.draftBody], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report.refNo}-complaint.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-muted">{error}</p><Link href="/dashboard" className="btn btn-outline mt-4">Back to my reports</Link></div>;
  if (!report) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-10"><div className="h-10 w-64 animate-pulse rounded bg-pine-50" /><div className="h-40 animate-pulse rounded-2xl bg-pine-50" /><div className="h-56 animate-pulse rounded-2xl bg-pine-50" /></div>;

  const mapsLink = `https://www.google.com/maps?q=${report.lat},${report.lng}`;
  const shareText = encodeURIComponent(`${report.draftSubject}\nFiled via CityFix — ${report.refNo}`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <Link href="/dashboard" className="text-xs font-bold text-pine-800 hover:underline">← My reports</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-wider text-muted">{report.refNo}</span>
            <button className="rounded-md bg-pine-50 px-2 py-0.5 text-[0.65rem] font-bold text-pine-800 hover:bg-pine-100" onClick={() => { navigator.clipboard?.writeText(report.refNo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy ref'}</button>
            <span className={`pill pill-${report.status}`}>{STATUS_LABEL[report.status]}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-black leading-[1.15] tracking-tight text-pine-950">{report.title}</h1>
          <p className="mt-1.5 text-sm text-muted">{report.jurisdictionName} · {report.address}{report.landmark ? ` · near ${report.landmark}` : ''}</p>
        </div>
        <div className="no-print flex flex-col gap-2">
          <button className="btn btn-outline !py-2 text-xs" onClick={download}>⬇ Download letter</button>
          <a className="btn btn-outline !py-2 text-xs" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">💬 Share</a>
          <button className="btn btn-outline !py-2 text-xs" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* left column */}
        <div className="space-y-6 lg:col-span-3">
          {report.photo && (
            <figure className="overflow-hidden rounded-2xl border border-line">
              <img src={report.photo} alt="Evidence attached to this report" className="max-h-96 w-full object-cover" />
              <figcaption className="bg-card px-4 py-2 text-[0.7rem] text-muted">Evidence attached at filing · {new Date(report.createdAt).toLocaleString('en-IN')}</figcaption>
            </figure>
          )}

          {/* timeline */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-pine-900">Progress timeline</h2>
            <ol className="mt-4 space-y-0">
              {report.timeline.map((t, i) => {
                const last = i === report.timeline.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-0.5 h-4 w-4 rounded-full border-2 ${last ? 'border-pine-600 bg-pine-600' : 'border-pine-600 bg-pine-100'}`} />
                      {!last && <span className="w-0.5 flex-1 bg-pine-100" />}
                    </div>
                    <div className={last ? '' : 'pb-5'}>
                      <p className="text-sm font-bold leading-snug text-pine-950">{t.label}</p>
                      {t.note && <p className="mt-0.5 text-xs leading-snug text-muted">{t.note}</p>}
                      <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-wide text-muted">{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {report.status !== 'resolved' && (
              <div className="no-print mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                <button className="btn btn-dark !py-2 text-xs" disabled={busy} onClick={() => act('resolve')}>✓ Mark as resolved</button>
                <button className="btn btn-outline !py-2 text-xs" disabled={busy} onClick={() => act('escalate')}>⬆ Escalate to District Collector</button>
              </div>
            )}
          </div>

          {/* letter */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-bold text-pine-900">The letter on record</h2>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-pine-800 hover:underline">View full complaint text</summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-[#fffdf6] p-4 font-mono text-[0.72rem] leading-relaxed text-pine-950">{report.draftBody}</pre>
            </details>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted">Location &amp; geotag</h2>
            <div className="mt-3"><MapPicker lat={report.lat} lng={report.lng} height={190} /></div>
            <a href={mapsLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold text-pine-800 hover:underline">{report.lat.toFixed(6)}, {report.lng.toFixed(6)} · Open in Google Maps ↗</a>
          </div>

          <div className="card p-5">
            <h2 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted">Authorities engaged ({report.officials.length})</h2>
            <ul className="mt-3 divide-y divide-line">
              {report.officials.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pine-50 font-display text-[0.65rem] font-bold text-pine-800">{o.name.replace(/^(Sri|Smt|Dr|Er|Adv)\.?\s*/g, '').slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.82rem] font-bold text-pine-950">{o.name}</span>
                    <span className="block truncate text-[0.68rem] text-muted">{o.designation}</span>
                  </span>
                  <a href={`tel:${o.phone.replace(/[^+\d]/g, '')}`} className="shrink-0 text-sm" title={o.phone} aria-label={`Call ${o.name}`}>📞</a>
                  {o.email.includes('@') && <a href={`mailto:${o.email}`} className="shrink-0 text-sm" title={o.email} aria-label={`Email ${o.name}`}>✉️</a>}
                </li>
              ))}
            </ul>
          </div>

          <div className="card border-saffron-600/25 bg-saffron-100/40 p-5 text-[0.78rem] leading-snug text-pine-950">
            <strong>No acknowledgement in 15 days?</strong>
            <p className="mt-1 text-muted">Tap “Escalate to District Collector” — your evidence history, ref number and timeline are forwarded as a formal escalation letter.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
