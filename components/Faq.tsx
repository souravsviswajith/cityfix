'use client';
import { useState } from 'react';
const ITEMS = [
  { q: 'Does CityFix actually send my complaint to the government?', a: 'CityFix drafts a complete, formal complaint addressed to the identified authority. When you tap “Send via Email” or “Send via WhatsApp”, your own device opens your mail or WhatsApp app with everything pre-filled — you press send, and the message goes from you to the official, on the record. CityFix keeps a time-stamped copy and reference number.' },
  { q: 'How does CityFix know which department is responsible?', a: 'Your report’s GPS coordinates are matched to the nearest local body (corporation / secretariat), your category is mapped to the responsible department — Roads, KWA, KSEB Public Lighting, Health & Sanitation and so on — and its registered officer and elected head are listed, along with the District Collector for escalation.' },
  { q: 'Is this free? Who sees my personal details?', a: 'CityFix is free for citizens. Your phone number is visible only to you and is not published. The public Civic Pulse shows locations and issues — never your identity or contact details.' },
  { q: 'What if nobody acts on my complaint?', a: 'Every report carries a 15-day acknowledgement commitment. If nothing happens, you can escalate inside the app — the complaint is forwarded to the District Collector with your full evidence history attached.' },
  { q: 'Which areas does CityFix cover right now?', a: 'The demo covers Kerala’s municipal corporations (Thiruvananthapuram, Kochi, Kozhikode, Thrissur, Kollam), the State Secretariat and district collectorates, plus national escalation through CPGRAMS. Expansion to panchayats is on the roadmap.' },
];
export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card">
      {ITEMS.map((item, i) => (
        <div key={i}>
          <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span className="font-semibold text-pine-900">{item.q}</span>
            <span className={`shrink-0 text-xl leading-none text-saffron-600 transition-transform duration-200 ${open === i ? 'rotate-45' : ''}`}>+</span>
          </button>
          {open === i && <div className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}
