'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from './Logo';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setOpen(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('cityfix_token') : null;
    if (!token) { setLoggedIn(false); setUserName(null); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setLoggedIn(!!d?.user); setUserName(d?.user?.name?.trim() || null); })
      .catch(() => { setLoggedIn(false); });
  }, [pathname]);

  const signOut = () => {
    localStorage.removeItem('cityfix_token');
    setLoggedIn(false);
    router.push('/');
    router.refresh();
  };

  const linkCls = (href: string) =>
    `text-sm font-semibold transition-colors ${pathname === href ? 'text-saffron-600' : 'text-pine-900 hover:text-saffron-600'}`;

  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="CityFix home"><Logo size={40} /></Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          <Link className={linkCls('/pulse')} href="/pulse">Civic Pulse</Link>
          <Link className={linkCls('/directory')} href="/directory">Officials Directory</Link>
          <Link className={linkCls('/dashboard')} href="/dashboard">My Reports</Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {loggedIn ? (
            <>
              <span className="text-sm font-semibold text-muted">Hi{userName ? `, ${userName.split(' ')[0]}` : ''} 👋</span>
              <button className="btn btn-ghost !px-4 !py-2 text-sm" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <Link href="/login" className="btn btn-ghost !px-4 !py-2 text-sm">Sign in</Link>
          )}
          <Link href="/report" className="btn btn-primary !py-2 text-sm">Report an Issue</Link>
        </div>

        <button className="rounded-lg border border-line p-2 md:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <><path d="M6 6l12 12M18 6L6 18" /></> : <><path d="M4 7h16M4 12h16M4 17h16" /></>}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/pulse" className="rounded-lg px-3 py-2 font-semibold text-pine-900 hover:bg-pine-50">Civic Pulse</Link>
            <Link href="/directory" className="rounded-lg px-3 py-2 font-semibold text-pine-900 hover:bg-pine-50">Officials Directory</Link>
            <Link href="/dashboard" className="rounded-lg px-3 py-2 font-semibold text-pine-900 hover:bg-pine-50">My Reports</Link>
            {loggedIn
              ? <button onClick={signOut} className="rounded-lg px-3 py-2 text-left font-semibold text-muted hover:bg-pine-50">Sign out</button>
              : <Link href="/login" className="rounded-lg px-3 py-2 font-semibold text-pine-900 hover:bg-pine-50">Sign in</Link>}
            <Link href="/report" className="btn btn-primary justify-center">Report an Issue</Link>
          </div>
        </div>
      )}
    </header>
  );
}
