export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#0d3a2d" />
        <path d="M24 7c-6.6 0-12 5.3-12 11.8 0 8.6 10.3 18.6 10.8 19.1a1.7 1.7 0 0 0 2.4 0C26.4 37.4 36 27.4 36 18.8 36 12.3 30.6 7 24 7Z" fill="#e8590c" />
        <path d="M18.6 19.4l4 4 7-8" stroke="#fdfcf7" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="leading-tight">
        <span className="block font-display text-[1.35rem] font-black tracking-tight text-pine-900">CityFix</span>
        <span className="hidden sm:block font-mono text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-muted">Citizen Accountability</span>
      </span>
    </span>
  );
}
