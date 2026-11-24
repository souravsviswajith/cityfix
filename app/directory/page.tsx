'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Officer } from '@/lib/types';

const KIND_LABEL: Record<string, string> = { elected: 'Elected', officer: 'Department Officer', collector: 'District Collectorate', state: 'State Government', helpline: 'Public Helpline' };
const KIND_ORDER = ['elected', 'officer', 'collector', 'state', 'helpline'];

export default function DirectoryPage() {
  const [officials, setOfficials] = useState<Officer[] | null>(null);
  const [jurisdictions, setJurisdictions] = useState<{ id: string; name: string; district: string }[]>([]);
  const [query, setQuery] = useState('');
  const [jur, setJur] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');

  useEffect(() => {
    fetch('/api/officials')
      .then((r) => r.json())
      .then((d) => { setOfficials(d.officials); setJurisdictions(d.jurisdictions); })
      .catch(() => setOfficials([]));
  }, []);

  const filtered = useMemo(() => {
    if (!officials) return [];
    const q = query.trim().toLowerCase();
    return officials
      .filter((o) => (jur === 'all' || o.jurisdictionId === jur || o.jurisdictionName === jur))
      .filter((o) => (kind === 'all' || o.kind === kind))
      .filter((o) => !q || [o.name, o.designation, o.department, o.jurisdictionName, o.district].join(' ').toLowerCase().includes(q))
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  }, [officials, query, jur, kind]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Public officials directory</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight text-pine-950">Who answers<br />your street?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">The named human beings — elected and administrative — responsible for each class of civic problem across Kerala&apos;s municipal corporations, district collectorates and state secretariat.</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-5 py-3 text-center">
          <p className="font-display text-3xl font-black text-pine-900">{officials?.length ?? '—'}</p>
          <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted">contacts listed</p>
        </div>
      </div>

      {/* filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input autoFocus className="input lg:max-w-md" placeholder="Search by name, designation, department, city…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search officials" />
        <select className="input lg:w-64" value={jur} onChange={(e) => setJur(e.target.value)} aria-label="Filter by jurisdiction">
          <option value="all">All jurisdictions ({jurisdictions.length + 2})</option>
          {jurisdictions.map((j) => <option key={j.id} value={j.name}>{j.name}</option>)}
          <option value="Government of India">Government of India — CPGRAMS</option>
          <option value="Government of Kerala">Government of Kerala — Secretariat</option>
        </select>
        <select className="input lg:w-48" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>

      <p className="mt-3 font-mono text-[0.68rem] uppercase tracking-wider text-muted">{filtered.length} result{filtered.length === 1 ? '' : 's'}{query ? ` for “${query}”` : ''}</p>

      {/* grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((o) => {
          const tel = o.phone.replace(/[^+\d]/g, '');
          const isMail = o.email.includes('@');
          return (
            <article key={o.id} className="card card-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pine-800 font-display text-sm font-bold text-gold-400">{o.name.replace(/^(Sri|Smt|Dr|Er|Adv)\.?\s*/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}</span>
                  <div className="min-w-0">
                    <h2 className="font-extrabold leading-tight text-pine-950">{o.name}</h2>
                    <p className="text-[0.72rem] font-semibold leading-snug text-muted">{o.designation}</p>
                  </div>
                </div>
                <span className={`pill shrink-0 ${o.kind === 'elected' ? 'pill-resolved' : o.kind === 'helpline' ? 'pill-submitted' : 'pill-acknowledged'}`}>{KIND_LABEL[o.kind]}</span>
              </div>
              <p className="mt-3 text-[0.8rem] leading-snug text-pine-900">{o.department}</p>
              <p className="text-[0.7rem] leading-snug text-muted">{o.jurisdictionName} · {o.district}</p>
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <a href={`tel:${tel}`} className="flex-1 rounded-xl border border-line px-3 py-2 text-center text-[0.75rem] font-bold text-pine-900 hover:border-pine-600 hover:bg-pine-50">📞 <span className="hidden xl:inline">{o.phone}</span><span className="xl:hidden">Call</span></a>
                {isMail
                  ? <a href={`mailto:${o.email}`} className="flex-1 truncate rounded-xl border border-line px-3 py-2 text-center text-[0.75rem] font-bold text-pine-900 hover:border-pine-600 hover:bg-pine-50" title={o.email}>✉️ Email</a>
                  : <a href={o.email.startsWith('http') ? o.email : `https://${o.email}`} target="_blank" rel="noreferrer" className="flex-1 truncate rounded-xl border border-line px-3 py-2 text-center text-[0.75rem] font-bold text-pine-900 hover:border-pine-600 hover:bg-pine-50" title={o.email}>🌐 Portal</a>}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="card col-span-full p-10 text-center">
            <p className="font-display text-xl font-bold text-pine-900">No match for “{query}”</p>
            <p className="mt-1 text-sm text-muted">Try a broader term — e.g. “roads”, “mayor”, “collector”, or a city name.</p>
          </div>
        )}
      </div>

      <p className="mt-6 rounded-2xl border border-line bg-pine-50/60 p-4 text-[0.75rem] leading-snug text-muted">⚠ <strong className="text-pine-900">Demo transparency:</strong> names, designations mapped to them and contact details on this page are illustrative sample data seeded for the CityFix prototype, not verified live government contacts. Phone prefixes are plausible STD codes; always confirm through the official LSGD / KWA / KSEB directories or 1916 before relying on them.</p>
    </div>
  );
}
