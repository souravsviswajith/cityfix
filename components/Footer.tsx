import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-pine-800 bg-pine-950 text-pine-100">
      {/* Emergency strip */}
      <div className="border-b border-white/10 bg-pine-900/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-2.5 text-center text-[0.8rem] font-semibold">
          <span className="inline-flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-red-400" />Life-threatening emergency? Call <a href="tel:112" className="underline underline-offset-2 hover:text-white">112</a> first</span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span>Central grievance portal: <a href="https://pgportal.gov.in" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">pgportal.gov.in</a> · <a href="tel:1916" className="hover:text-white">1916</a></span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span>Kerala CM cell: <a href="tel:1595" className="hover:text-white">1595</a></span>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo size={36} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-pine-200">
            CityFix reduces the distance between <em>spotting a civic problem</em> and <em>reaching the people responsible for fixing it</em> — evidence-backed reports, geotagged proof, named authorities, and a formal letter drafted for you.
          </p>
          <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-400">See the problem. Report it. Reach the authority.</p>
        </div>
        <nav aria-label="Platform">
          <h3 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-pine-200">Platform</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/report" className="hover:text-white">Report an Issue</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">My Reports</Link></li>
            <li><Link href="/directory" className="hover:text-white">Officials Directory</Link></li>
            <li><Link href="/pulse" className="hover:text-white">Civic Pulse Map</Link></li>
            <li><Link href="/login" className="hover:text-white">Sign in with OTP</Link></li>
          </ul>
        </nav>
        <div>
          <h3 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-pine-200">Honest notes</h3>
          <ul className="mt-3 space-y-2 text-[0.8rem] leading-snug text-pine-200">
            <li>• Directory names &amp; contacts shown are <strong className="text-white">illustrative demo data</strong> for the prototype.</li>
            <li>• Demo OTP login — no SMS is sent; the code appears on screen.</li>
            <li>• CityFix drafts communications; the decision to submit is always yours.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[0.75rem] text-pine-200 sm:px-6">
          <span>© {new Date().getFullYear()} CityFix — Citizen-powered accountability. Built for civic demo purposes.</span>
          <span>Kerala, India · Demo build v0.1</span>
        </div>
      </div>
    </footer>
  );
}
