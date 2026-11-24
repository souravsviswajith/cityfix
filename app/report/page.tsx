'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CATEGORIES, SEVERITIES, getCategory } from '@/lib/categories';
import type { Officer } from '@/lib/types';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-pine-50" /> });

const STEPS = ['Category', 'Evidence', 'Location', 'Authorities', 'Draft & Send'];
const KERALA_CITIES = [
  { label: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  { label: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { label: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
  { label: 'Thrissur', lat: 10.5276, lng: 76.2144 },
  { label: 'Kollam', lat: 8.8932, lng: 76.6141 },
];

interface Resolution {
  jurisdiction: { id: string; name: string; district: string; type: string; distanceKm: number };
  department: string;
  authorities: { department: Officer | null; elected: Officer | null; collector: Officer | null; state: Officer | null };
}
interface Draft {
  refNo: string; subject: string; body: string; jurisdiction: string;
  primaryRecipient: { name: string; designation: string; email: string; phone: string };
}

export default function ReportPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);

  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'emergency'>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'ok' | 'error'>('idle');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [resolving, setResolving] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'download'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; refNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ————— auth gate ————— */
  useEffect(() => {
    const token = localStorage.getItem('cityfix_token');
    if (!token) { setAuthed(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  /* ————— jurisdiction resolution ————— */
  const lat = geo?.lat, lng = geo?.lng;
  useEffect(() => {
    if (lat == null || lng == null) { setResolution(null); return; }
    setResolving(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/resolve?lat=${lat}&lng=${lng}&category=${category || 'other'}`);
        if (r.ok) setResolution(await r.json());
      } finally { setResolving(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [lat, lng, category]);

  /* ————— draft auto-generation ————— */
  useEffect(() => {
    if (step !== 4 || draft || drafting || !geo) return;
    (async () => {
      setDrafting(true); setError(null);
      try {
        const token = localStorage.getItem('cityfix_token');
        const r = await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ category, title, description, severity, address, landmark, lat: geo.lat, lng: geo.lng }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Could not generate the draft');
        setDraft(d);
      } catch (e) { setError((e as Error).message); } finally { setDrafting(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const useMyLocation = useCallback(() => {
    setGeoState('asking');
    if (!navigator.geolocation) { setGeoState('error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 }); setGeoState('ok'); },
      () => setGeoState('error'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
    );
  }, []);

  const onPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      setPhoto(dataUrl);
    } catch { setError('Could not read that image. Try another photo.'); } finally { setPhotoBusy(false); }
  }, []);

  const toggleDictation = useCallback(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const rec = new (SR as new () => {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void; start: () => void; stop: () => void;
    })();
    rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
      setDescription((d) => (d + ' ' + text).trim());
    };
    rec.onend = () => setListening(false);
    rec.start();
    recogRef.current = rec;
    setListening(true);
  }, [listening]);

  const speechSupported = typeof window !== 'undefined' &&
    Boolean((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition);

  const canProceed = (s: number): boolean => {
    switch (s) {
      case 0: return !!category;
      case 1: return title.trim().length >= 8 && description.trim().length >= 20;
      case 2: return !!geo && address.trim().length >= 4;
      case 3: return !!resolution;
      case 4: return !!draft && draft.subject.trim().length > 4 && draft.body.trim().length > 40;
      default: return false;
    }
  };
  const go = (s: number) => { setStep(s); setMaxStep((m) => Math.max(m, s)); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const submit = async () => {
    if (!geo || !draft) return;
    setSubmitting(true); setError(null);
    try {
      const token = localStorage.getItem('cityfix_token');
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          refNo: draft.refNo, category, title, description, severity, address, landmark,
          lat: geo.lat, lng: geo.lng, channel, photo: photo ?? undefined, hasVideo,
          draftSubject: draft.subject, draftBody: draft.body,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Submission failed');

      const cc = [resolution?.authorities.elected?.email, resolution?.authorities.collector?.email].filter(Boolean).join(',');
      if (channel === 'email') {
        window.location.href = `mailto:${draft.primaryRecipient.email}?subject=${encodeURIComponent(draft.subject)}&cc=${encodeURIComponent(cc)}&body=${encodeURIComponent(draft.body)}`;
      } else if (channel === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${draft.subject}\n\n${draft.body}`)}`, '_blank', 'noopener');
      } else if (channel === 'download') {
        const blob = new Blob([draft.body], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${draft.refNo}-complaint.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setResult({ id: d.report.id, refNo: d.report.refNo });
    } catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  };

  /* ————— render ————— */
  if (authed === null) {
    return <div className="mx-auto max-w-3xl px-4 py-24"><div className="h-64 animate-pulse rounded-3xl bg-pine-50" /></div>;
  }
  if (!authed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="card p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pine-50 text-3xl">📱</span>
          <h1 className="mt-4 font-display text-2xl font-black text-pine-950">Sign in to file your report</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">CityFix ties every complaint to your mobile number so the department can contact you. It takes 10 seconds — one OTP, no password.</p>
          <Link href="/login?next=/report" className="btn btn-primary mt-6 w-full justify-center text-base !py-3.5">Sign in with OTP →</Link>
          <p className="mt-3 text-[0.72rem] text-muted">Demo mode: the OTP appears on screen — no SMS is sent.</p>
        </div>
      </div>
    );
  }
  if (result) return <SuccessScreen refNo={result.refNo} reportId={result.id} issueTitle={title} jurisdiction={resolution?.jurisdiction.name ?? ''} onAnother={() => { setResult(null); setStep(0); setMaxStep(0); setCategory(''); setTitle(''); setDescription(''); setPhoto(null); setHasVideo(false); setGeo(null); setAddress(''); setLandmark(''); setDraft(null); setResolution(null); }} />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* stepper */}
      <ol className="flex items-center justify-between gap-1" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <button onClick={() => i <= maxStep && go(i)} disabled={i > maxStep} className="flex flex-col items-center gap-1.5 disabled:cursor-default" aria-current={i === step ? 'step' : undefined}>
              <span className={`step-dot ${i === step ? 'step-dot-active' : i < step || i <= maxStep ? 'step-dot-done' : ''}`}>{i < step ? '✓' : i + 1}</span>
              <span className="hidden font-mono text-[0.6rem] font-semibold uppercase tracking-wider text-muted sm:block">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-1 h-0.5 flex-1 rounded bg-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-6">
        {/* ————— STEP 0 — category ————— */}
        {step === 0 && (
          <section className="card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-black text-pine-950 sm:text-3xl">What’s the problem?</h1>
            <p className="mt-1 text-sm text-muted">Pick the closest match — CityFix routes your report to the right department automatically.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                  className={`group flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${category === c.id ? 'border-saffron-600 bg-saffron-100 shadow-md' : 'border-line bg-white hover:border-pine-600 hover:shadow-sm'}`}>
                  <CategoryGlyph id={c.id} active={category === c.id} />
                  <span className={`text-[0.82rem] font-bold leading-tight ${category === c.id ? 'text-saffron-700' : 'text-pine-900'}`}>{c.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <span className="label">How urgent is it?</span>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button key={s.id} onClick={() => setSeverity(s.id)} aria-pressed={severity === s.id} title={s.hint}
                    className={`chip !px-4 !py-2 ${severity === s.id ? 'chip-active !border-pine-900' : ''}`}>{s.label}</button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ————— STEP 1 — evidence & description ————— */}
        {step === 1 && (
          <section className="card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-black text-pine-950 sm:text-3xl">Evidence &amp; details</h1>
            <p className="mt-1 text-sm text-muted">A photo makes the complaint 5× harder to ignore. Aim for a wide shot + one close-up if you can.</p>

            <div className="mt-6 grid gap-6 md:grid-cols-5">
              {/* photo side */}
              <div className="md:col-span-2">
                <span className="label">Photo / video</span>
                {photo ? (
                  <div className="relative overflow-hidden rounded-2xl border border-line">
                    <img src={photo} alt="Evidence attached to your report" className="h-56 w-full object-cover" />
                    <button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white hover:bg-black">Remove</button>
                    <span className="absolute bottom-2 left-2 rounded-full bg-emerald-600 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white">✓ Attached to letter</span>
                  </div>
                ) : (
                  <label className="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-pine-200 bg-pine-50/50 text-center transition-colors hover:border-pine-600">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#175e47" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.6" /></svg>
                    <span className="text-sm font-bold text-pine-800">{photoBusy ? 'Processing photo…' : 'Tap to capture or upload'}</span>
                    <span className="px-4 text-[0.7rem] text-muted">Opens your camera on phones. Compressed on-device.</span>
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
                  </label>
                )}
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-pine-800 hover:underline">
                  <input type="checkbox" className="h-4 w-4 accent-[#175e47]" checked={hasVideo} onChange={(e) => setHasVideo(e.target.checked)} />
                  I also recorded a video {hasVideo ? '— will be delivered in person / via WhatsApp' : ''}
                </label>
              </div>

              {/* text side */}
              <div className="space-y-4 md:col-span-3">
                <div>
                  <label className="label" htmlFor="title">One-line title</label>
                  <input id="title" className="input" maxLength={90} placeholder="e.g. Deep potholes near Kaloor junction, two-wheelers swerving" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <p className="mt-1 text-right font-mono text-[0.65rem] text-muted">{title.trim().length}/90 · min 8</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label mb-0" htmlFor="desc">Describe the problem</label>
                    {speechSupported && (
                      <button type="button" onClick={toggleDictation} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-bold transition-colors ${listening ? 'bg-red-600 text-white' : 'bg-pine-100 text-pine-800 hover:bg-pine-200'}`} aria-pressed={listening}>
                        <span className={`h-2 w-2 rounded-full ${listening ? 'animate-ping bg-white' : 'bg-red-500'}`} />{listening ? 'Listening… tap to stop' : 'Dictate'}
                      </button>
                    )}
                  </div>
                  <textarea id="desc" className="input mt-2 min-h-[130px] leading-relaxed" placeholder="What exactly is wrong, since when, who is affected, and what is the risk? The more specific, the faster it gets fixed." value={description} onChange={(e) => setDescription(e.target.value)} />
                  <p className="mt-1 text-right font-mono text-[0.65rem] text-muted">{description.trim().length} chars · min 20</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ————— STEP 2 — location ————— */}
        {step === 2 && (
          <section className="card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-black text-pine-950 sm:text-3xl">Where exactly?</h1>
            <p className="mt-1 text-sm text-muted">Precise coordinates go inside the complaint letter with a Google Maps link — no vague “near the market”.</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={useMyLocation} className="btn btn-dark !py-2.5 text-sm">
                {geoState === 'asking' ? 'Locating…' : geoState === 'error' ? 'Location failed — pick on map' : '📍 Use my GPS location'}
              </button>
              <span className="text-xs font-semibold text-muted">or tap the map, or jump to:</span>
              {KERALA_CITIES.map((c) => (
                <button key={c.label} className="chip hover:border-pine-600 hover:text-pine-800" onClick={() => { setGeo({ lat: c.lat, lng: c.lng }); setGeoState('ok'); }}>{c.label}</button>
              ))}
            </div>

            <div className="mt-4">
              <MapPicker lat={lat ?? null} lng={lng ?? null} onPick={(la, ln) => { setGeo({ lat: la, lng: ln }); setGeoState('ok'); }} height={260} />
              <p className="mt-2 font-mono text-[0.7rem] text-muted">{geo ? `📍 ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}` : 'No pin yet — tap the map or use GPS.'}</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="addr">Address / road / landmark</label>
                <input id="addr" className="input" placeholder="e.g. Kaloor Junction, Banerji Road" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="lm">Nearest landmark</label>
                <input id="lm" className="input" placeholder="e.g. Near Lulu signal" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </div>
            </div>

            {geo && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-pine-200 bg-pine-50 px-4 py-3">
                {resolving ? (
                  <span className="text-sm font-semibold text-pine-800">Resolving jurisdiction…</span>
                ) : resolution ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#175e47" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                    <span className="text-sm"><strong className="text-pine-900">{resolution.jurisdiction.name}</strong> <span className="text-muted">· {resolution.jurisdiction.district} district · {resolution.jurisdiction.distanceKm} km away</span></span>
                    <span className="chip !border-pine-200 !bg-white text-pine-800">{resolution.department}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Could not resolve jurisdiction. Check the pin.</span>
                )}
              </div>
            )}
          </section>
        )}

        {/* ————— STEP 3 — authorities ————— */}
        {step === 3 && (
          <section className="card p-6 sm:p-8">
            <p className="eyebrow">Who answers this complaint</p>
            <h1 className="mt-1 font-display text-2xl font-black text-pine-950 sm:text-3xl">Named officials on your letter</h1>
            <p className="mt-1 text-sm text-muted">CityFix identified these authorities from your location and category. The department officer is the primary addressee; the rest are copied.</p>

            {resolving || !resolution ? (
              <div className="mt-6 h-40 animate-pulse rounded-2xl bg-pine-50" />
            ) : (
              <div className="mt-6 space-y-4">
                <AuthorityCard officer={resolution.authorities.department} role="Primary addressee" primary />
                <AuthorityCard officer={resolution.authorities.elected} role="Elected representative — cc’d" />
                <AuthorityCard officer={resolution.authorities.collector} role="Escalation — cc’d" />
                <AuthorityCard officer={resolution.authorities.state} role="State-level oversight" subtle />
              </div>
            )}
            <p className="mt-4 text-[0.72rem] leading-snug text-muted">Contact details shown are <strong>illustrative demo directory data</strong>. In production, CityFix syncs with verified PWD / KWA / KSEB / LSGD directories weekly.</p>
          </section>
        )}

        {/* ————— STEP 4 — draft & send ————— */}
        {step === 4 && (
          <section className="card p-6 sm:p-8">
            <p className="eyebrow">Smart draft · editable</p>
            <h1 className="mt-1 font-display text-2xl font-black text-pine-950 sm:text-3xl">Your complaint is ready</h1>
            <p className="mt-1 text-sm text-muted">Formal, numbered and referenced. Edit anything — then choose how to send it.</p>

            {drafting || !draft ? (
              <div className="mt-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-pine-50" style={{ width: `${88 - i * 13}%` }} />)}</div>
            ) : (
              <>
                <div className="mt-6 rounded-2xl border-2 border-pine-900/10 bg-[#fffdf6] p-5 shadow-inner sm:p-7" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 30px, rgba(18,76,58,.05) 31px)' }}>
                  <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                    <span className="font-mono text-[0.72rem] font-semibold tracking-[0.15em] text-saffron-700">REF · {draft.refNo}</span>
                    <button className="text-[0.7rem] font-bold text-pine-800 hover:underline" onClick={() => navigator.clipboard?.writeText(draft.body)}>Copy letter</button>
                  </div>
                  <label className="label mt-4" htmlFor="subject">Subject</label>
                  <input id="subject" className="input !border-0 !bg-transparent !px-0 font-bold text-pine-950 focus:!shadow-none" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                  <label className="label mt-3" htmlFor="body">Letter</label>
                  <textarea id="body" className="input !border-0 !bg-transparent !px-0 font-mono text-[0.8rem] leading-[1.9] focus:!shadow-none" rows={18} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </div>

                <fieldset className="mt-6">
                  <legend className="label">Send via</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['email', '✉️', 'E-mail', `to ${draft.primaryRecipient.designation.split(' ').slice(0, 2).join(' ')} · Mayor & Collector cc’d`],
                      ['whatsapp', '💬', 'WhatsApp', 'Opens share sheet with the letter'],
                      ['download', '⬇️', 'Download', 'Plain-text file, print-ready'],
                    ] as const).map(([id, icon, t, hint]) => (
                      <button key={id} onClick={() => setChannel(id)} aria-pressed={channel === id}
                        className={`rounded-2xl border-2 p-3 text-left transition-all ${channel === id ? 'border-saffron-600 bg-saffron-100' : 'border-line bg-white hover:border-pine-600'}`}>
                        <span className="text-xl" aria-hidden="true">{icon}</span>
                        <span className="mt-1 block text-sm font-extrabold text-pine-900">{t}</span>
                        <span className="mt-0.5 block text-[0.65rem] leading-snug text-muted">{hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 rounded-2xl border border-pine-200 bg-pine-50 px-4 py-3 text-[0.78rem] leading-snug text-pine-900">
                  <strong>Review checklist:</strong> ① details are true ② the photo shows the issue ③ the tone is factual, not abusive ④ you are okay with your number being on the letter.
                </div>
              </>
            )}
          </section>
        )}

        {/* ————— footer nav of wizard ————— */}
        <div className="mt-5 flex items-center justify-between">
          <button className="btn btn-ghost" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>← Back</button>
          {step < 4 ? (
            <button className="btn btn-primary text-base !px-6" onClick={() => canProceed(step) && go(step + 1)} disabled={!canProceed(step)} aria-disabled={!canProceed(step)}>
              {step === 3 ? 'Generate formal complaint' : 'Continue'} →
            </button>
          ) : (
            <button className="btn btn-primary text-base !px-8 !py-4" onClick={submit} disabled={submitting || !canProceed(4)}>
              {submitting ? 'Filing your report…' : channel === 'email' ? 'Send complaint e-mail →' : channel === 'whatsapp' ? 'Share on WhatsApp →' : 'Download letter & file →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ————— helper components & utilities ————— */

function CategoryGlyph({ id, active }: { id: string; active: boolean }) {
  const c = active ? '#bf3f0a' : '#175e47';
  const common = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'roads': return <svg {...common}><path d="M4 18c3-1 4-9 8-9s5 8 8 9" /><path d="M12 6v2M9.5 8.5l.6 1.6M14.5 8.5l-.6 1.6" /></svg>;
    case 'drain': return <svg {...common}><path d="M4 14c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" /><path d="M4 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" /></svg>;
    case 'water': return <svg {...common}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></svg>;
    case 'waste': return <svg {...common}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6.5 7l1.4 13a1 1 0 0 0 1 .9h6.2a1 1 0 0 0 1-.9L17.5 7" /></svg>;
    case 'light': return <svg {...common}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 1 3.5 10.9c-.8.6-.9 1.6-.9 2.6h-5.2c0-1-.1-2-.9-2.6A6 6 0 0 1 12 3Z" /></svg>;
    case 'parks': return <svg {...common}><path d="M12 21v-7" /><path d="M12 14c-3 0-5.5-2.4-5.5-6.5 4.5 0 6.5 2 7 6.5" /><path d="M12 12c.5-4.5 2.5-6.5 7-6.5 0 4.1-2.5 6.5-5.5 6.5" /></svg>;
    case 'encroach': return <svg {...common}><path d="M4 20h16" /><path d="M6 20V6l6-3 6 3v14" /><path d="M12 11v4" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v.5M12 11.5V16" /></svg>;
  }
}

function AuthorityCard({ officer, role, primary, subtle }: { officer: Officer | null; role: string; primary?: boolean; subtle?: boolean }) {
  if (!officer) return null;
  const initials = officer.name.replace(/^(Sri|Smt|Dr|Er|Adv)\.?\s*/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const telHref = `tel:${officer.phone.replace(/[^+\d]/g, '')}`;
  const mailHref = officer.email.includes('@') ? `mailto:${officer.email}` : undefined;
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${primary ? 'border-saffron-600/40 bg-saffron-100/50' : subtle ? 'border-line bg-pine-50/40' : 'border-line bg-white'}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pine-800 font-display text-sm font-bold text-gold-400">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">{role}</p>
        <p className="mt-0.5 font-extrabold leading-tight text-pine-950">{officer.name}</p>
        <p className="text-[0.78rem] leading-snug text-muted">{officer.designation} · {officer.department}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a href={telHref} className="rounded-xl border border-line bg-white px-3 py-2 text-center text-[0.68rem] font-bold text-pine-800 hover:border-pine-600" title={officer.phone}>📞<br />Call</a>
        {mailHref && <a href={mailHref} className="rounded-xl border border-line bg-white px-3 py-2 text-center text-[0.68rem] font-bold text-pine-800 hover:border-pine-600" title={officer.email}>✉️<br />Mail</a>}
      </div>
    </div>
  );
}

function SuccessScreen({ refNo, reportId, issueTitle, jurisdiction, onAnother }: { refNo: string; reportId: string; issueTitle: string; jurisdiction: string; onAnother: () => void }) {
  const confetti = useMemo(() => Array.from({ length: 48 }, (_, i) => ({
    id: i,
    left: (i * 37) % 100,
    delay: (i % 12) * 0.14,
    color: ['#e8590c', '#e9b949', '#1f7354', '#175e47', '#ff8a3d'][i % 5],
    rotate: (i * 53) % 360,
  })), []);

  return (
    <div className="relative mx-auto max-w-3xl overflow-hidden px-4 py-14 text-center sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {confetti.map((p) => <span key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, background: p.color, transform: `rotate(${p.rotate}deg)` }} />)}
      </div>
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-pine-600 text-white">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
      </span>
      <p className="eyebrow mt-6">Filed &amp; geotagged</p>
      <h1 className="mt-1 font-display text-4xl font-black text-pine-950">Complaint on record.</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">
        <strong className="text-pine-900">“{issueTitle}”</strong> has been delivered to the authority for {jurisdiction}. Keep your reference number safe:
      </p>
      <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-2xl border border-line bg-card px-6 py-3 shadow-sm">
        <span className="font-mono text-2xl font-semibold tracking-widest text-pine-900">{refNo}</span>
        <button className="rounded-lg bg-pine-50 px-3 py-1.5 text-xs font-bold text-pine-800 hover:bg-pine-100" onClick={() => navigator.clipboard?.writeText(refNo)}>Copy</button>
      </div>

      <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
        {[
          ['Filed & geotagged with evidence', 'Just now', true],
          ['Delivered to department inbox', 'Done', true],
          ['Acknowledgement from officer', 'Expected within 48 hours', false],
          ['Rectification & verification', 'Commitment: 15 days', false],
        ].map(([label, when, done], i) => (
          <li key={i} className="flex items-center gap-3">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${done ? 'bg-pine-600 text-white' : 'border-2 border-line text-muted'}`}>{done ? '✓' : i + 1}</span>
            <span className={`flex-1 text-sm ${done ? 'font-semibold text-pine-900' : 'text-muted'}`}>{label as string}</span>
            <span className="font-mono text-[0.62rem] uppercase tracking-wide text-muted">{when as string}</span>
          </li>
        ))}
      </ol>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href={`/dashboard/${reportId}`} className="btn btn-dark">Track this report →</Link>
        <button className="btn btn-outline" onClick={onAnother}>Report another issue</button>
      </div>
    </div>
  );
}

async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const MAX = 1280;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}
