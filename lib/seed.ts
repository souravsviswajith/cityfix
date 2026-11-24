import type { Report, ReportStatus, Severity } from './types';
import { getCategory } from './categories';
import { resolveAuthorities } from './jurisdictions';

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function timelineFor(status: ReportStatus, createdAt: string): Report['timeline'] {
  const t0 = new Date(createdAt);
  const at = (extraDays: number, h = 11) => {
    const d = new Date(t0);
    d.setDate(d.getDate() + extraDays);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const tl: Report['timeline'] = [{ at: createdAt, label: 'Complaint filed & geotagged', note: 'Evidence attached and authorities identified' }];
  if (status === 'submitted') return tl;
  tl.push({ at: at(1, 16), label: 'Delivered to authority inbox', note: 'Complaint mail + WhatsApp notification dispatched' });
  tl.push({ at: at(2, 12), label: 'Acknowledged by department', note: 'Field officer deputed for inspection' });
  if (status === 'acknowledged') return tl;
  tl.push({ at: at(4, 15), label: 'Work ordered / in progress', note: 'Crew assigned and site visit completed' });
  if (status === 'in_progress') return tl;
  tl.push({ at: at(9, 18), label: 'Resolved', note: 'Rectification verified and closed by department' });
  return tl;
}

interface SeedSpec {
  category: string; title: string; description: string; severity: Severity;
  address: string; landmark?: string; lat: number; lng: number;
  status: ReportStatus; upvotes: number; daysBack: number; photo?: string;
}

const SEEDS: SeedSpec[] = [
  { category: 'roads', title: 'Deep pothole cluster near Kaloor junction', description: 'Three large potholes in the middle lane of the Kaloor–Kadavanthra stretch. Two-wheelers are swerving dangerously into oncoming traffic every evening. Water collects in the holes after rain, hiding their depth.', severity: 'high', address: 'Kaloor Junction, Ernakulam', landmark: 'Near Lulu Office signal', lat: 9.9937, lng: 76.2968, status: 'in_progress', upvotes: 47, daysBack: 21, photo: '/seed/pothole.jpg' },
  { category: 'waste', title: 'Overflowing garbage bin at MG Road junction', description: 'The municipal bin has not been cleared for five days. Waste is spilling onto the pavement and the road, and the stench is unbearable for shops and pedestrians. Stray animals are scattering refuse nightly.', severity: 'medium', address: 'MG Road Junction, Thrissur', landmark: 'Opposite Swaraj Round', lat: 10.5248, lng: 76.2134, status: 'acknowledged', upvotes: 32, daysBack: 12, photo: '/seed/garbage.jpg' },
  { category: 'light', title: 'Entire stretch of streetlights non-functional', description: 'A run of eleven consecutive streetlight poles between the East Fort and Pazhavangadi junction has been dark for three weeks. Women returning from work and students avoid this stretch after 6 PM.', severity: 'high', address: 'East Fort, Thiruvananthapuram', landmark: 'Pazhavangadi flyover', lat: 8.4838, lng: 76.9455, status: 'in_progress', upvotes: 74, daysBack: 26, photo: '/seed/streetlight.jpg' },
  { category: 'drain', title: 'Blocked storm-water drain flooding the road', description: 'The side drain is choked with silt and market waste. After every spell of rain the road is submerged in knee-deep water and school buses get stranded. An open manhole next to the drain is a serious hazard.', severity: 'high', address: 'Palayam, Thiruvananthapuram', landmark: 'Near Central Library', lat: 8.5183, lng: 76.9483, status: 'in_progress', upvotes: 89, daysBack: 30, photo: '/seed/drainage.jpg' },
  { category: 'roads', title: 'Caved-in carriageway after monsoon', description: 'A stretch of about 40 metres has sunk by nearly one foot near the market entry. Trucks are forced to mount the footpath, damaging the boundary wall of the school compound.', severity: 'high', address: 'Market Road, Kollam', landmark: 'Near Sree Krishna Swamy School', lat: 8.8872, lng: 76.6251, status: 'acknowledged', upvotes: 41, daysBack: 9 },
  { category: 'water', title: 'Main pipeline leaking for two weeks', description: 'A continuous leak from the distribution main is wasting water and has eroded the foundation of the footpath. KWA meter reading shows zero supply despite full pressure in the area.', severity: 'medium', address: 'S.M. Street, Kozhikode', landmark: 'Near Big Bazaar', lat: 11.2509, lng: 75.7776, status: 'resolved', upvotes: 33, daysBack: 34 },
  { category: 'parks', title: 'Broken swing and exposed bolts in children’s park', description: 'The swing set is bent with exposed threaded bolts at a child’s head height. Two children have reported injuries this month. The park has no warning board or fencing.', severity: 'medium', address: 'Thampanoor, Thiruvananthapuram', landmark: 'Children’s Park, KSRTC bus stand side', lat: 8.4889, lng: 76.9523, status: 'resolved', upvotes: 26, daysBack: 41 },
  { category: 'encroach', title: 'Unauthorised wall blocking pedestrian footpath', description: 'A shop owner has extended a brick wall into the footpath, forcing pedestrians onto the carriageway for 25 metres. Elderly residents and wheelchair users cannot pass at all.', severity: 'medium', address: 'Kadavanthra, Ernakulam', landmark: 'Near St. Michael’s Church', lat: 9.9667, lng: 76.2990, status: 'submitted', upvotes: 15, daysBack: 2 },
  { category: 'water', title: 'Zero water supply for six days', description: 'Ward 21 has received no piped supply since last Monday. Tanker water is being sold at ₹2,000 a load and households with infants are suffering the most.', severity: 'high', address: 'Ward 21, Bombey Road, Kozhikode', landmark: 'Near Bombey Medical College', lat: 11.2702, lng: 75.7863, status: 'submitted', upvotes: 58, daysBack: 6 },
  { category: 'waste', title: 'Uncollected waste for nearly a week', description: 'The bio-bin cluster behind the temple has overflowed. Health inspectors inspected last week but no collection happened since. Peak season market waste adds to the pile daily.', severity: 'medium', address: 'Punkunnam, Thrissur', landmark: 'Near Punkunnam Temple', lat: 10.5341, lng: 76.2241, status: 'resolved', upvotes: 61, daysBack: 38 },
  { category: 'roads', title: 'Fallen trees blocking carriageway', description: 'Two eucalyptus trees fallen across the road after last night’s storm. The road is down to a single lane and visibility around the bend is near zero after dark.', severity: 'emergency', address: 'MG Road, Kochi', landmark: 'Near Shenoys theatre', lat: 9.9816, lng: 76.2775, status: 'acknowledged', upvotes: 57, daysBack: 3 },
  { category: 'light', title: 'Streetlights dead for 300-metre stretch', description: 'No public lighting between the corporation office and the main junction. Evening walkers and commuters at the bus stop are at risk; two chain-snatching attempts reported last month.', severity: 'high', address: 'Swaraj Round, Thrissur', landmark: 'Near KSRTC stand entrance', lat: 10.5303, lng: 76.2149, status: 'in_progress', upvotes: 66, daysBack: 17 },
];

export function buildSeedReports(): Report[] {
  return SEEDS.map((s, i) => {
    const createdAt = daysAgo(s.daysBack, 9 + (i % 8));
    const cat = getCategory(s.category);
    const { body, departmentOfficer, elected, collector } = resolveAuthorities(s.lat, s.lng, cat.departmentId);
    const officials = [departmentOfficer, elected, collector].filter(Boolean) as Report['officials'];
    const primary = departmentOfficer ?? elected;
    return {
      id: `seed-${String(i + 1).padStart(3, '0')}`,
      refNo: `CFX-2026-${String(101 + i)}`,
      userId: 'seed',
      category: s.category,
      title: s.title,
      description: s.description,
      severity: s.severity,
      address: s.address,
      landmark: s.landmark,
      lat: s.lat,
      lng: s.lng,
      jurisdictionId: body.id,
      jurisdictionName: body.name,
      departmentName: cat.departmentLabel,
      officials,
      draftSubject: `Formal complaint — ${s.title}`,
      draftBody: `(Original complaint filed on ${new Date(createdAt).toLocaleDateString('en-IN')} via CityFix. Addressed to ${primary?.designation ?? 'department'}, ${body.name}.)`,
      channel: 'email',
      photo: s.photo,
      status: s.status,
      createdAt,
      updatedAt: createdAt,
      timeline: timelineFor(s.status, createdAt),
      upvotes: s.upvotes,
    } satisfies Report;
  });
}
