import { getCategory } from './categories';
import type { Severity } from './types';

export interface DraftInput {
  refNo: string;
  name: string;
  phone: string;
  category: string;
  title: string;
  description: string;
  severity: Severity;
  address: string;
  landmark?: string;
  lat: number;
  lng: number;
  jurisdictionName: string;
  primaryOfficerName: string;
  primaryDesignation: string;
  primaryDepartment: string;
}

function longDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SEVERITY_LINE: Record<Severity, string> = {
  low: 'While not an emergency, continued neglect will only worsen the problem and increase the eventual cost of repair.',
  medium: 'This issue causes daily inconvenience to a large number of residents and commuters and deserves prompt attention.',
  high: 'This issue poses a genuine safety risk to pedestrians, children, two-wheeler riders and motorists, and delay may lead to an accident.',
  emergency: 'This is an emergency situation. Immediate intervention is required to prevent injury, loss of life or major damage to property. Please treat this with the highest priority.',
};

export function generateDraft(input: DraftInput): { subject: string; body: string } {
  const cat = getCategory(input.category);
  const now = new Date();
  const mapsLink = `https://www.google.com/maps?q=${input.lat.toFixed(6)},${input.lng.toFixed(6)}`;
  const locationLine = [input.address.trim(), input.landmark ? `near ${input.landmark.trim()}` : null]
    .filter(Boolean)
    .join(', ');
  const name = input.name.trim() || 'A Concerned Citizen';

  const subject = `Formal complaint — ${input.title.trim()} [Ref: ${input.refNo}]`;

  const body = `To,
The ${input.primaryDesignation},
${input.primaryDepartment},
${input.jurisdictionName}

Date: ${longDate(now)}
Reference No: ${input.refNo}

Subject: Formal complaint regarding ${cat.label.toLowerCase()} — ${input.title.trim()}

Respected Sir/Madam,

I, ${name}, a resident accessible to the local body through the contact details below, wish to bring to your attention a civic grievance affecting the public at the following location:

${locationLine || 'Location as per enclosed geotag'}
Coordinates: ${input.lat.toFixed(6)}, ${input.lng.toFixed(6)}
Google Maps: ${mapsLink}

Nature of the issue — ${cat.label}:
${input.description.trim()}

${SEVERITY_LINE[input.severity]}

I therefore request that:
1. ${cat.request}
2. A written or SMS acknowledgement of this complaint be sent to the contact number below.
3. The timeline for rectification be communicated to me, and the work be verified by a field officer upon completion.

Evidence documenting the issue (photograph/video with geotag) is enclosed with this communication. I would appreciate an inspection and resolution within 15 days of receipt of this letter, failing which I intend to escalate the matter to the District Collector and the State Public Grievance portal.

Yours faithfully,
${name}
Phone: ${input.phone}
Ref: ${input.refNo} · Filed via CityFix`;

  return { subject, body };
}
