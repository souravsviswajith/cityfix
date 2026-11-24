'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Could not send code');
      setDemoCode(d.demoCode ?? null);
      setStage('otp');
      setCooldown(30);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code, name }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Verification failed');
      localStorage.setItem('cityfix_token', d.token);
      router.push(next);
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
      <div className="hidden md:block">
        <p className="eyebrow">Sign in · 10 seconds</p>
        <h1 className="mt-2 font-display text-5xl font-black leading-[1.05] tracking-tight text-pine-950">One number.<br />Every department.<br /><span className="text-saffron-600">One tap.</span></h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">Your mobile number is your identity on CityFix — the same number that appears on the complaint letter that reaches the officer. No passwords, no paperwork.</p>
        <ul className="mt-8 space-y-3 text-sm text-pine-900">
          {['No app install — runs in your browser', 'Complaints carry your phone number for official follow-up', 'Your details are never shown publicly'].map((t) => (
            <li key={t} className="flex items-start gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f7354" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M4 12.5l5 5L20 6.5" /></svg>{t}</li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-black text-pine-900">Sign in to CityFix</h2>
          <p className="mt-1 text-sm text-muted">{stage === 'phone' ? 'Enter your mobile number — we’ll send a 6-digit code.' : `Code sent to +91 ${phone.replace(/\D/g, '').slice(-10)}`}</p>

          {stage === 'phone' ? (
            <form onSubmit={sendCode} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="phone">Mobile number</label>
                <div className="flex overflow-hidden rounded-[.85rem] border-[1.5px] border-line focus-within:border-pine-600 focus-within:ring-2 focus-within:ring-pine-600/20">
                  <span className="flex items-center border-r border-line bg-pine-50 px-4 font-mono text-sm font-semibold text-pine-800">+91</span>
                  <input id="phone" autoFocus inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" className="w-full border-0 px-4 py-3.5 outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="name">Your name <span className="font-normal normal-case text-muted">(printed on the letter)</span></label>
                <input id="name" className="input" placeholder="e.g. Anjali Krishnan" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center text-base !py-3.5">{busy ? 'Sending…' : 'Send OTP'}</button>
              <p className="text-center text-[0.72rem] leading-snug text-muted">By continuing you agree to be contacted by CityFix and the relevant department on this number regarding your reports.</p>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-6 space-y-4">
              {demoCode && (
                <div className="rounded-xl border border-dashed border-saffron-600/50 bg-saffron-100 px-4 py-3 text-center">
                  <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-saffron-700">Demo mode — no SMS sent</p>
                  <p className="mt-1 text-sm text-saffron-700">Your one-time code is</p>
                  <p className="font-mono text-3xl font-semibold tracking-[0.35em] text-pine-950">{demoCode}</p>
                </div>
              )}
              <div>
                <label className="label" htmlFor="otp">6-digit code</label>
                <input id="otp" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input text-center font-mono text-2xl tracking-[0.5em]" placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{error}</p>}
              <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary w-full justify-center text-base !py-3.5">{busy ? 'Verifying…' : 'Verify & Continue'}</button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="font-semibold text-pine-800 hover:underline" onClick={() => { setStage('phone'); setCode(''); setError(null); }}>← Change number</button>
                <button type="button" className="font-semibold text-pine-800 hover:underline disabled:opacity-40" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
              </div>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Trouble signing in? WhatsApp the CityFix desk — <a href="https://wa.me/919645000191" className="font-semibold text-pine-800 hover:underline">+91 96450 00191</a></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
