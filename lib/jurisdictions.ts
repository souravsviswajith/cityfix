// CityFix demo jurisdiction dataset — Kerala local bodies, district collectorates and state-level
// authorities. Names, phone numbers and e-mail addresses are ILLUSTRATIVE SAMPLE DATA for demo
// purposes, not verified contact details of real officials.
import type { Officer } from './types';

export interface LocalBody {
  id: string;
  name: string;
  shortName: string;
  type: 'corporation' | 'state';
  district: string;
  center: { lat: number; lng: number };
  collectorId: string;
}

export const LOCAL_BODIES: LocalBody[] = [
  { id: 'tvmc', name: 'Thiruvananthapuram City Corporation', shortName: 'T\'puram Corporation', type: 'corporation', district: 'Thiruvananthapuram', center: { lat: 8.5241, lng: 76.9366 }, collectorId: 'col-tvm' },
  { id: 'kmc', name: 'Kochi Municipal Corporation', shortName: 'Kochi Corporation', type: 'corporation', district: 'Ernakulam', center: { lat: 9.9312, lng: 76.2673 }, collectorId: 'col-ekm' },
  { id: 'kozcorp', name: 'Kozhikode Municipal Corporation', shortName: 'Kozhikode Corporation', type: 'corporation', district: 'Kozhikode', center: { lat: 11.2588, lng: 75.7804 }, collectorId: 'col-kzd' },
  { id: 'thrissur', name: 'Thrissur Municipal Corporation', shortName: 'Thrissur Corporation', type: 'corporation', district: 'Thrissur', center: { lat: 10.5276, lng: 76.2144 }, collectorId: 'col-tcr' },
  { id: 'kollam', name: 'Kollam Municipal Corporation', shortName: 'Kollam Corporation', type: 'corporation', district: 'Kollam', center: { lat: 8.8932, lng: 76.6141 }, collectorId: 'col-kol' },
  { id: 'state', name: 'Government of Kerala — State Secretariat', shortName: 'State Secretariat', type: 'state', district: 'Thiruvananthapuram', center: { lat: 8.5080, lng: 76.9560 }, collectorId: 'col-tvm' },
];

export const COLLECTORS: Officer[] = [
  { id: 'col-tvm', name: 'Smt. Kavya S. Nair', designation: 'District Collector', department: 'District Collectorate — Thiruvananthapuram', departmentId: 'collectorate', jurisdictionId: 'col-tvm', jurisdictionName: 'Thiruvananthapuram District', district: 'Thiruvananthapuram', phone: '+91 471 273 3100', email: 'collector@tvm.nic.in', kind: 'collector' },
  { id: 'col-ekm', name: 'Smt. A. Geetha', designation: 'District Collector', department: 'District Collectorate — Ernakulam', departmentId: 'collectorate', jurisdictionId: 'col-ekm', jurisdictionName: 'Ernakulam District', district: 'Ernakulam', phone: '+91 484 236 3100', email: 'collector@ernakulam.nic.in', kind: 'collector' },
  { id: 'col-kzd', name: 'Sri. Vishnu V.', designation: 'District Collector', department: 'District Collectorate — Kozhikode', departmentId: 'collectorate', jurisdictionId: 'col-kzd', jurisdictionName: 'Kozhikode District', district: 'Kozhikode', phone: '+91 495 237 4710', email: 'collector@kozhikode.nic.in', kind: 'collector' },
  { id: 'col-tcr', name: 'Smt. Lakshmi Rajan', designation: 'District Collector', department: 'District Collectorate — Thrissur', departmentId: 'collectorate', jurisdictionId: 'col-tcr', jurisdictionName: 'Thrissur District', district: 'Thrissur', phone: '+91 487 232 7777', email: 'collector@thr.nic.in', kind: 'collector' },
  { id: 'col-kol', name: 'Sri. Rahul Dev', designation: 'District Collector', department: 'District Collectorate — Kollam', departmentId: 'collectorate', jurisdictionId: 'col-kol', jurisdictionName: 'Kollam District', district: 'Kollam', phone: '+91 474 274 1000', email: 'collector@kollam.nic.in', kind: 'collector' },
];

export const STATE_OFFICIALS: Officer[] = [
  { id: 'st-lsgd', name: 'Sri. Manoj K. Sinha, IAS', designation: 'Principal Secretary', department: 'Local Self Government Department (LSGD)', departmentId: 'lsgd', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '+91 471 232 7951', email: 'ps.lsgd@kerala.gov.in', kind: 'state' },
  { id: 'st-pwd', name: 'Smt. Ritu Anand, IAS', designation: 'Secretary', department: 'Public Works Department', departmentId: 'roads', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '+91 471 233 3333', email: 'secy.pwd@kerala.gov.in', kind: 'state' },
  { id: 'st-water', name: 'Sri. Deepak Menon, IAS', designation: 'Principal Secretary', department: 'Water Resources Department', departmentId: 'water', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '+91 471 232 0606', email: 'ps.water@kerala.gov.in', kind: 'state' },
  { id: 'st-dma', name: 'Sri. Prakash Mani', designation: 'Director of Municipal Administration', department: 'Directorate of Municipal Administration', departmentId: 'dma', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '+91 471 233 7447', email: 'dma@kerala.gov.in', kind: 'state' },
  { id: 'st-health', name: 'Dr. Meera Krishnan', designation: 'Director of Urban Health', department: 'Health & Family Welfare Department', departmentId: 'health', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '+91 471 230 6300', email: 'director.urbanhealth@kerala.gov.in', kind: 'state' },
];

export const HELPLINES: Officer[] = [
  { id: 'hl-1916', name: 'CPGRAMS — Central Public Grievance Portal', designation: 'Citizen Grievance Helpline', department: 'Government of India · MoPPG', departmentId: 'helpline', jurisdictionId: 'national', jurisdictionName: 'Government of India', district: 'New Delhi', phone: '1916', email: 'pgportal.nic.in', kind: 'helpline' },
  { id: 'hl-cm', name: 'Kerala Chief Minister\'s Grievance Redressal Cell', designation: 'Citizen Helpline', department: 'Government of Kerala · Chief Minister\'s Office', departmentId: 'helpline', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Thiruvananthapuram', phone: '1595', email: 'cmcell@kerala.gov.in', kind: 'helpline' },
  { id: 'hl-kwh', name: 'KWA Consumer Helpline (Water / Sewerage)', designation: 'Utility Helpline', department: 'Kerala Water Authority', departmentId: 'water', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Statewide', phone: '1916', email: 'kwaonline@kerala.gov.in', kind: 'helpline' },
  { id: 'hl-kseb', name: 'KSEB Consumer Helpline (Power / Streetlights)', designation: 'Utility Helpline', department: 'Kerala State Electricity Board', departmentId: 'electrical', jurisdictionId: 'state', jurisdictionName: 'Government of Kerala', district: 'Statewide', phone: '1912', email: 'consumerhelpline@kseb.in', kind: 'helpline' },
];

interface CorpSeed {
  bodyId: string;
  elected: Omit<Officer, 'jurisdictionId' | 'jurisdictionName' | 'district' | 'kind'> & { kind?: Officer['kind'] };
  officers: Array<Omit<Officer, 'jurisdictionId' | 'jurisdictionName' | 'district'>>;
}

const CORP_SEEDS: CorpSeed[] = [
  {
    bodyId: 'tvmc',
    elected: { id: 'tvmc-mayor', name: 'Adv. Lakshmi Pillai', designation: 'Mayor', department: 'Thiruvananthapuram City Corporation', departmentId: 'elected', phone: '+91 471 233 3800', email: 'mayor@tvmc.gov.in' },
    officers: [
      { id: 'tvmc-roads', name: 'Er. Suresh Babu', designation: 'Executive Engineer (Roads & Storm Water)', department: 'Engineering Division — Roads', departmentId: 'roads', phone: '+91 471 233 4171', email: 'xr.roads@tvmc.gov.in', kind: 'officer' },
      { id: 'tvmc-water', name: 'Smt. Bindu G.', designation: 'Assistant Engineer (Water Supply)', department: 'Kerala Water Authority — City Circle', departmentId: 'water', phone: '+91 471 233 4102', email: 'ae.city@kwa.kerala.gov.in', kind: 'officer' },
      { id: 'tvmc-waste', name: 'Dr. Renjith Kumar', designation: 'Health Officer', department: 'Health & Sanitation', departmentId: 'waste', phone: '+91 471 233 4056', email: 'healthofficer@tvmc.gov.in', kind: 'officer' },
      { id: 'tvmc-elec', name: 'Er. Ajayan V.', designation: 'Assistant Executive Engineer', department: 'KSEB — Public Lighting Wing', departmentId: 'electrical', phone: '+91 471 233 4233', email: 'aee.lighting@kseb.in', kind: 'officer' },
      { id: 'tvmc-health', name: 'Smt. Sheeba Thomas', designation: 'Superintendent (Parks & Public Health)', department: 'Health & Parks', departmentId: 'health', phone: '+91 471 233 4088', email: 'parks@tvmc.gov.in', kind: 'officer' },
    ],
  },
  {
    bodyId: 'kmc',
    elected: { id: 'kmc-mayor', name: 'Adv. George Mathew', designation: 'Mayor', department: 'Kochi Municipal Corporation', departmentId: 'elected', phone: '+91 484 236 6100', email: 'mayor@kmc.gov.in' },
    officers: [
      { id: 'kmc-roads', name: 'Er. Divya Nair', designation: 'Executive Engineer (Roads & Storm Water)', department: 'Engineering Division — Roads', departmentId: 'roads', phone: '+91 484 236 6214', email: 'xr.roads@kmc.gov.in', kind: 'officer' },
      { id: 'kmc-water', name: 'Er. Arun Pillai', designation: 'Assistant Engineer (Water Supply)', department: 'Kerala Water Authority — Ernakulam', departmentId: 'water', phone: '+91 484 236 6345', email: 'ae.ernakulam@kwa.kerala.gov.in', kind: 'officer' },
      { id: 'kmc-waste', name: 'Sri. Sajith Mohammed', designation: 'Sanitation Superintendent', department: 'Health & Sanitation', departmentId: 'waste', phone: '+91 484 236 6420', email: 'sanitation@kmc.gov.in', kind: 'officer' },
      { id: 'kmc-elec', name: 'Er. Nikhil Joseph', designation: 'Assistant Executive Engineer', department: 'KSEB — Public Lighting Wing', departmentId: 'electrical', phone: '+91 484 236 6550', email: 'aee.lighting.kochi@kseb.in', kind: 'officer' },
      { id: 'kmc-health', name: 'Dr. Fathima Rahman', designation: 'Health Officer', department: 'Health & Parks', departmentId: 'health', phone: '+91 484 236 6701', email: 'healthofficer@kmc.gov.in', kind: 'officer' },
    ],
  },
  {
    bodyId: 'kozcorp',
    elected: { id: 'koz-mayor', name: 'Sri. Rajeev Menon', designation: 'Mayor', department: 'Kozhikode Municipal Corporation', departmentId: 'elected', phone: '+91 495 236 6000', email: 'mayor@kozcorp.gov.in' },
    officers: [
      { id: 'koz-roads', name: 'Er. Pradeepan K.', designation: 'Executive Engineer (Roads & Storm Water)', department: 'Engineering Division — Roads', departmentId: 'roads', phone: '+91 495 236 6112', email: 'xr.roads@kozcorp.gov.in', kind: 'officer' },
      { id: 'koz-water', name: 'Er. Sneha Balakrishnan', designation: 'Assistant Engineer (Water Supply)', department: 'Kerala Water Authority — Kozhikode', departmentId: 'water', phone: '+91 495 236 6230', email: 'ae.kozhikode@kwa.kerala.gov.in', kind: 'officer' },
      { id: 'koz-waste', name: 'Dr. Jayesh Krishnan', designation: 'Health Officer', department: 'Health & Sanitation', departmentId: 'waste', phone: '+91 495 236 6301', email: 'healthofficer@kozcorp.gov.in', kind: 'officer' },
      { id: 'koz-elec', name: 'Er. Santhosh Kumar', designation: 'Assistant Executive Engineer', department: 'KSEB — Public Lighting Wing', departmentId: 'electrical', phone: '+91 495 236 6412', email: 'aee.lighting.koz@kseb.in', kind: 'officer' },
      { id: 'koz-health', name: 'Smt. Thankamma Krishnan', designation: 'Superintendent (Parks & Public Health)', department: 'Health & Parks', departmentId: 'health', phone: '+91 495 236 6523', email: 'parks@kozcorp.gov.in', kind: 'officer' },
    ],
  },
  {
    bodyId: 'thrissur',
    elected: { id: 'tcr-mayor', name: 'Adv. Sunitha Warrier', designation: 'Mayor', department: 'Thrissur Municipal Corporation', departmentId: 'elected', phone: '+91 487 242 5100', email: 'mayor@thrissurcorp.gov.in' },
    officers: [
      { id: 'tcr-roads', name: 'Er. Manoj E. V.', designation: 'Executive Engineer (Roads & Storm Water)', department: 'Engineering Division — Roads', departmentId: 'roads', phone: '+91 487 242 5220', email: 'xr.roads@thrissurcorp.gov.in', kind: 'officer' },
      { id: 'tcr-water', name: 'Er. Deepa Sankar', designation: 'Assistant Engineer (Water Supply)', department: 'Kerala Water Authority — Thrissur', departmentId: 'water', phone: '+91 487 242 5330', email: 'ae.thrissur@kwa.kerala.gov.in', kind: 'officer' },
      { id: 'tcr-waste', name: 'Dr. Anil Raj', designation: 'Health Officer', department: 'Health & Sanitation', departmentId: 'waste', phone: '+91 487 242 5440', email: 'healthofficer@thrissurcorp.gov.in', kind: 'officer' },
      { id: 'tcr-elec', name: 'Er. Jomon Mathew', designation: 'Assistant Executive Engineer', department: 'KSEB — Public Lighting Wing', departmentId: 'electrical', phone: '+91 487 242 5550', email: 'aee.lighting.tcr@kseb.in', kind: 'officer' },
      { id: 'tcr-health', name: 'Smt. Geetha Menon', designation: 'Superintendent (Parks & Public Health)', department: 'Health & Parks', departmentId: 'health', phone: '+91 487 242 5660', email: 'parks@thrissurcorp.gov.in', kind: 'officer' },
    ],
  },
  {
    bodyId: 'kollam',
    elected: { id: 'kol-mayor', name: 'Sri. Ashok Kumar Sulochan', designation: 'Mayor', department: 'Kollam Municipal Corporation', departmentId: 'elected', phone: '+91 474 276 1000', email: 'mayor@kollamcorp.gov.in' },
    officers: [
      { id: 'kol-roads', name: 'Er. Rekha Menon', designation: 'Executive Engineer (Roads & Storm Water)', department: 'Engineering Division — Roads', departmentId: 'roads', phone: '+91 474 276 1120', email: 'xr.roads@kollamcorp.gov.in', kind: 'officer' },
      { id: 'kol-water', name: 'Er. Vinod Kumar', designation: 'Assistant Engineer (Water Supply)', department: 'Kerala Water Authority — Kollam', departmentId: 'water', phone: '+91 474 276 1230', email: 'ae.kollam@kwa.kerala.gov.in', kind: 'officer' },
      { id: 'kol-waste', name: 'Dr. Shiji Prasad', designation: 'Health Officer', department: 'Health & Sanitation', departmentId: 'waste', phone: '+91 474 276 1340', email: 'healthofficer@kollamcorp.gov.in', kind: 'officer' },
      { id: 'kol-elec', name: 'Er. Praveen Chandran', designation: 'Assistant Executive Engineer', department: 'KSEB — Public Lighting Wing', departmentId: 'electrical', phone: '+91 474 276 1450', email: 'aee.lighting.kol@kseb.in', kind: 'officer' },
      { id: 'kol-health', name: 'Smt. Beena Joseph', designation: 'Superintendent (Parks & Public Health)', department: 'Health & Parks', departmentId: 'health', phone: '+91 474 276 1560', email: 'parks@kollamcorp.gov.in', kind: 'officer' },
    ],
  },
];

export const CORPORATION_OFFICIALS: Officer[] = CORP_SEEDS.flatMap((seed) => {
  const body = LOCAL_BODIES.find((b) => b.id === seed.bodyId)!;
  const elected: Officer = {
    ...seed.elected,
    kind: 'elected',
    jurisdictionId: body.id,
    jurisdictionName: body.name,
    district: body.district,
  } as Officer;
  const deptOfficers = seed.officers.map((o) => ({
    ...o,
    jurisdictionId: body.id,
    jurisdictionName: body.name,
    district: body.district,
  }));
  return [elected, ...deptOfficers] as Officer[];
});

export const ALL_OFFICIALS: Officer[] = [
  ...CORPORATION_OFFICIALS,
  ...COLLECTORS,
  ...STATE_OFFICIALS,
  ...HELPLINES,
];

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestLocalBody(lat: number, lng: number): { body: LocalBody; distanceKm: number } {
  let best = LOCAL_BODIES[0];
  let bestD = Infinity;
  for (const body of LOCAL_BODIES) {
    const d = haversineKm({ lat, lng }, body.center);
    if (d < bestD) {
      bestD = d;
      best = body;
    }
  }
  return { body: best, distanceKm: Math.round(bestD * 10) / 10 };
}

export interface ResolvedAuthorities {
  body: LocalBody;
  distanceKm: number;
  departmentOfficer: Officer | null;
  elected: Officer | null;
  collector: Officer | null;
  stateContact: Officer | null;
}

export function resolveAuthorities(
  lat: number,
  lng: number,
  departmentId: string
): ResolvedAuthorities {
  const { body, distanceKm } = nearestLocalBody(lat, lng);
  const inBody = CORPORATION_OFFICIALS.filter((o) => o.jurisdictionId === body.id);
  const departmentOfficer =
    inBody.find((o) => o.departmentId === departmentId) ??
    inBody.find((o) => o.departmentId === 'elected') ??
    null;
  const elected = inBody.find((o) => o.kind === 'elected') ?? null;
  const collector = COLLECTORS.find((c) => c.id === body.collectorId) ?? null;
  const stateContact =
    STATE_OFFICIALS.find((s) => s.departmentId === departmentId) ??
    STATE_OFFICIALS.find((s) => s.departmentId === 'dma') ??
    null;
  return { body, distanceKm, departmentOfficer, elected, collector, stateContact };
}
