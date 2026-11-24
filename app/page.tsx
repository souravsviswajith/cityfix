import Link from 'next/link';
import { db } from '@/lib/store';
import { ALL_OFFICIALS, LOCAL_BODIES } from '@/lib/jurisdictions';
import Faq from '@/components/Faq';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = { submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'In progress', resolved: 'Resolved' };

export default async function Home() {
  const data = await db.get();
  const total = data.reports.length;
  const resolved = data.reports.filter((r) => r.status === 'resolved').length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
  const ticker = [...data.reports].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);

  return (
    <>
      {/* ————— HERO ————— */}
      <section className="dot-grid relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-saffron-100 blur-3xl opacity-60" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-pine-100 blur-3xl opacity-70" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:gap-14 md:pb-24 md:pt-20">
          <div>
            <span className="chip mb-6 border-saffron-600/30 bg-saffron-100 text-saffron-700">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-saffron-600" /> Kerala beta · live demo
            </span>
            <h1 className="font-display text-[2.6rem] font-black leading-[1.05] tracking-tight text-pine-950 sm:text-6xl">
              See the problem.<br />
              <span className="text-saffron-600">Report it.</span><br />
              Reach the authority.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Photograph a pothole, a leak or a dead streetlight. CityFix geotags it, identifies the <strong className="text-pine-900">name and number of the official responsible</strong>, and drafts the formal complaint — ready to send from your phone in under two minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/report" className="btn btn-primary text-base !px-6 !py-3.5">Report an Issue — Free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <a href="#how" className="btn btn-outline text-base !px-6 !py-3.5">How it works</a>
            </div>
            {/* live stats */}
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
              {[
                [String(total), 'reports filed (demo data)'],
                [`${resolutionRate}%`, 'marked resolved by citizens'],
                [String(ALL_OFFICIALS.length), 'officials & helplines listed'],
              ].map(([n, label]) => (
                <div key={label as string}>
                  <dt className="font-display text-2xl font-black text-pine-900">{n}</dt>
                  <dd className="max-w-[9rem] text-[0.72rem] leading-snug text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <figure className="overflow-hidden rounded-3xl border-4 border-card shadow-2xl shadow-pine-900/20">
              <img src="/hero-civic.jpg" alt="Citizens photographing civic problems — a pothole, an electric pole and a municipal worker" className="h-full w-full object-cover" />
            </figure>
            {/* floating cards */}
            <div className="floaty absolute -left-2 top-6 rounded-2xl border border-line bg-card/95 px-4 py-3 shadow-xl backdrop-blur sm:-left-6">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-[0.68rem] font-semibold tracking-wider text-muted">CFX-2026-0101</span>
              </div>
              <p className="mt-1 text-xs font-bold text-pine-900">Potholes · Kaloor, Kochi</p>
              <p className="text-[0.7rem] font-semibold text-[#6d28d9]">IN PROGRESS — crew assigned</p>
            </div>
            <div className="floaty-2 absolute -right-2 bottom-8 rounded-2xl border border-line bg-pine-950/95 px-4 py-3 text-white shadow-xl backdrop-blur sm:-right-4">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e9b949" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                <span className="font-mono text-[0.68rem] font-semibold tracking-wider text-gold-400">AUTHORITY NOTIFIED</span>
              </div>
              <p className="mt-1 text-[0.75rem] leading-tight">Executive Engineer (Roads)<br /><span className="text-white/70">+ Mayor copied · Collector on escalation</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ————— LIVE TICKER ————— */}
      <div className="overflow-hidden border-b border-line bg-pine-950 py-2.5 text-pine-100" aria-hidden="true">
        <div className="marquee flex gap-10 whitespace-nowrap text-[0.8rem] font-medium">
          {[...ticker, ...ticker].map((r, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="text-gold-400">●</span>
              <span className="font-semibold text-white">{r.title}</span>
              <span className="text-pine-200">— {r.jurisdictionName.replace(' Municipal Corporation', '').replace(' City Corporation', '')} · {STATUS_LABEL[r.status]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ————— HOW IT WORKS ————— */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <p className="eyebrow">Four steps · under two minutes</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-black tracking-tight text-pine-950 sm:text-5xl">From spot-the-problem to<br />signed-and-sent complaint</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', t: 'Capture evidence', d: 'Photograph or record the issue with your phone. CityFix stamps time, GPS and the reporting device metadata automatically.', icon: <><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" /><circle cx="12" cy="13.5" r="3.6" stroke="currentColor" strokeWidth="1.8" fill="none" /></> },
            { n: '02', t: 'Auto-geotag & jurisdiction', d: 'Coordinates pin the exact spot and resolve the responsible local body — corporation, ward and district — instantly.', icon: <><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" fill="none" /></> },
            { n: '03', t: 'Know who answers', d: 'The department officer, the elected mayor and the District Collector are identified by name — with phone and official e-mail.', icon: <><circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></> },
            { n: '04', t: 'Draft, review, send', d: 'A formal complaint is drafted for you — ref. number, maps link, legal-style formatting. Edit it, then send by email or WhatsApp.', icon: <><path d="M5 4h14v16H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" /><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></> },
          ].map((s) => (
            <li key={s.n} className="card card-hover relative flex flex-col p-6">
              <span className="font-display text-4xl font-black text-pine-100">{s.n}</span>
              <span className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-xl bg-pine-50 text-pine-800">
                <svg width="22" height="22" viewBox="0 0 24 24">{s.icon}</svg>
              </span>
              <h3 className="mt-3 font-display text-xl font-bold text-pine-900">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ————— FEATURES ————— */}
      <section className="border-y border-line bg-pine-50/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <p className="eyebrow">Everything in one flow</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-pine-950 sm:text-4xl">Built for the chai shop,<br />the bus stop and the ballot box</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['📸', 'Camera-first reporting', 'Snap or upload a photo or video. Evidence is compressed on-device and attached to the complaint — no forms about your form.'],
              ['🎙️', 'Voice dictation', 'Type or dictate in English or Malayalam-accented English. CityFix turns it into formal, respectful complaint language.'],
              ['📍', 'Automatic geotagging', 'GPS coordinates + a Google Maps link embedded in the letter itself. The officer cannot claim “wrong location”.'],
              ['🏛️', 'Named officials, not departments', 'Not “to whom it may concern” — the Executive Engineer, the Mayor and the Collector, with numbers and official e-mail IDs.'],
              ['✉️', 'Formal AI-drafted letter', 'Structured, numbered, referenced (CFX-2026-XXXX) complaint with location, evidence summary and a 15-day action request.'],
              ['📈', 'Track to resolution', 'A timeline from Filed → Acknowledged → In Progress → Resolved. Escalate to the Collector if the window lapses.'],
            ].map(([icon, t, d]) => (
              <div key={t as string} className="card p-6">
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                <h3 className="mt-3 font-display text-lg font-bold text-pine-900">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— VISION / MISSION ————— */}
      <section id="vision" className="bg-pine-950 text-pine-100">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 md:py-24">
          <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-gold-400">The vision</p>
          <blockquote className="mt-6 font-display text-2xl font-medium leading-snug text-[#f3efe3] sm:text-4xl">
            “The objective is not simply to collect complaints, but to reduce the distance between identifying a civic problem and bringing it to the attention of the people responsible for resolving it.”
          </blockquote>
          <p className="mt-8 text-sm uppercase tracking-[0.2em] text-pine-200">CityFix · Citizen-Powered Accountability</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/pulse" className="btn bg-gold-400 text-pine-950 hover:brightness-105 font-bold">See live civic pulse →</Link>
            <Link href="/directory" className="btn border border-white/25 text-white hover:bg-white/10">Browse the officials directory</Link>
          </div>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
        <p className="eyebrow">Fair questions</p>
        <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-pine-950">Asked at every ward meeting</h2>
        <div className="mt-8"><Faq /></div>
      </section>

      {/* ————— FINAL CTA ————— */}
      <section className="border-t border-line bg-saffron-600">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 text-center text-white sm:px-6 md:flex-row md:text-left">
          <div>
            <h2 className="font-display text-2xl font-black sm:text-3xl">Your street knows who to call.<br className="hidden sm:block" /> Now you do too.</h2>
            <p className="mt-1 text-sm text-white/85">Free, no app install, works on any phone with a camera.</p>
          </div>
          <Link href="/report" className="btn shrink-0 bg-white text-saffron-700 hover:bg-saffron-100 font-extrabold">File your first report →</Link>
        </div>
      </section>
    </>
  );
}
