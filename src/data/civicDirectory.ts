import type {
  CivicReport,
  IssueCategory,
  PublicOfficial,
  VerificationStatus,
  VerifiedAuthority,
  WardZone,
} from '../types/civic';

export const ISSUE_CATEGORIES: {
  id: IssueCategory;
  label: string;
  department: string;
  summary: string;
}[] = [
  {
    id: 'roads',
    label: 'Damaged Roads & Potholes',
    department: 'Public Works & Highways',
    summary: 'Asphalt craters, sunken utility trenches, broken curbs, or lane hazards.',
  },
  {
    id: 'waste',
    label: 'Overflowing Waste & Sanitation',
    department: 'Solid Waste & Sanitation',
    summary: 'Uncollected garbage bins, illegal dumping, or overflowing street receptacles.',
  },
  {
    id: 'drainage',
    label: 'Poor Drainage & Flooding',
    department: 'Stormwater & Sewerage Board',
    summary: 'Blocked storm grates, standing sewage, or chronic street waterlogging.',
  },
  {
    id: 'water',
    label: 'Water Supply Disruptions',
    department: 'Municipal Water Authority',
    summary: 'Burst distribution mains, low pressure, or contaminated supply lines.',
  },
  {
    id: 'lighting',
    label: 'Broken Streetlights',
    department: 'Municipal Electrical Division',
    summary: 'Dark intersections, flickering lamps, or damaged pedestrian lighting poles.',
  },
  {
    id: 'safety',
    label: 'Unsafe Public Spaces',
    department: 'Civic Safety & Parks',
    summary: 'Broken crosswalk signals, collapsed fencing, or hazardous park equipment.',
  },
];

export const WARD_ZONES: WardZone[] = [
  {
    id: 'ward-01',
    code: 'W-01',
    name: 'Civic Center & Old Market',
    district: 'Central Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'Central Metro AC-14',
    parliamentaryConstituency: 'Metro Central PC-03',
    centerLat: 12.9716,
    centerLng: 77.5946,
    population: 68400,
    bounds: { minLat: 12.965, maxLat: 12.98, minLng: 77.585, maxLng: 77.605 },
    svgX: 18,
    svgY: 22,
    svgW: 112,
    svgH: 88,
  },
  {
    id: 'ward-02',
    code: 'W-02',
    name: 'Pinehurst & Transit Corridor',
    district: 'North Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'North Transit AC-15',
    parliamentaryConstituency: 'Metro North PC-01',
    centerLat: 12.9912,
    centerLng: 77.5985,
    population: 81200,
    bounds: { minLat: 12.98, maxLat: 13.005, minLng: 77.585, maxLng: 77.615 },
    svgX: 138,
    svgY: 22,
    svgW: 124,
    svgH: 88,
  },
  {
    id: 'ward-03',
    code: 'W-03',
    name: 'Eastwood Tech & Canal Belt',
    district: 'East Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'Eastwood AC-18',
    parliamentaryConstituency: 'Metro East PC-02',
    centerLat: 12.9742,
    centerLng: 77.6244,
    population: 94500,
    bounds: { minLat: 12.96, maxLat: 12.988, minLng: 77.605, maxLng: 77.645 },
    svgX: 270,
    svgY: 22,
    svgW: 112,
    svgH: 130,
  },
  {
    id: 'ward-04',
    code: 'W-04',
    name: 'Riverfront & Mill Quarter',
    district: 'West Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'West Riverfront AC-12',
    parliamentaryConstituency: 'Metro Central PC-03',
    centerLat: 12.9585,
    centerLng: 77.5752,
    population: 59300,
    bounds: { minLat: 12.945, maxLat: 12.97, minLng: 77.56, maxLng: 77.59 },
    svgX: 18,
    svgY: 118,
    svgW: 112,
    svgH: 110,
  },
  {
    id: 'ward-05',
    code: 'W-05',
    name: 'Southgate Gardens',
    district: 'South Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'Southgate AC-19',
    parliamentaryConstituency: 'Metro South PC-04',
    centerLat: 12.9462,
    centerLng: 77.6012,
    population: 74800,
    bounds: { minLat: 12.93, maxLat: 12.965, minLng: 77.59, maxLng: 77.62 },
    svgX: 138,
    svgY: 118,
    svgW: 124,
    svgH: 110,
  },
  {
    id: 'ward-06',
    code: 'W-06',
    name: 'Lakeview & Industrial Park',
    district: 'Southeast Metro District',
    localBodyType: 'Municipal Corporation',
    localBodyName: 'Metro City Corporation',
    assemblyConstituency: 'Lakeview AC-21',
    parliamentaryConstituency: 'Metro South PC-04',
    centerLat: 12.9488,
    centerLng: 77.6321,
    population: 63900,
    bounds: { minLat: 12.93, maxLat: 12.96, minLng: 77.62, maxLng: 77.65 },
    svgX: 270,
    svgY: 160,
    svgW: 112,
    svgH: 68,
  },
];

export const PUBLIC_OFFICIALS: PublicOfficial[] = [
  {
    id: 'off-01',
    name: 'Ananya Deshmukh',
    branch: 'POLITICAL',
    designation: 'Elected Ward Councillor (Ward 01)',
    roleType: 'Elected Representative',
    department: 'Municipal Council — Ward 01',
    categories: ['roads', 'waste', 'drainage', 'water', 'lighting', 'safety'],
    wardIds: ['ward-01'],
    email: 'ananya.deshmukh@citycouncil.gov',
    phone: '+1 (555) 204-8101',
    whatsapp: '+1 (555) 204-8101',
    officeAddress: 'Room 204, Civic Center Annex, Market Square',
    responseTargetHours: 24,
    sourceUrl: 'https://lsgd.citycouncil.gov/wards/w-01',
    lastVerifiedIso: '2026-11-18T10:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-02',
    name: 'Marcus Vance',
    branch: 'POLITICAL',
    designation: 'Elected Ward Councillor (Ward 02 & 03)',
    roleType: 'Elected Representative',
    department: 'Municipal Council — North & East',
    categories: ['roads', 'waste', 'drainage', 'water', 'lighting', 'safety'],
    wardIds: ['ward-02', 'ward-03'],
    email: 'marcus.vance@citycouncil.gov',
    phone: '+1 (555) 204-8102',
    whatsapp: '+1 (555) 204-8102',
    officeAddress: '118 Pinehurst Boulevard, Suite 3B',
    responseTargetHours: 24,
    sourceUrl: 'https://lsgd.citycouncil.gov/wards/w-02',
    lastVerifiedIso: '2026-11-19T08:30:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-03',
    name: 'Priya Nair',
    branch: 'POLITICAL',
    designation: 'Elected Ward Representative (Ward 04, 05 & 06)',
    roleType: 'Elected Representative',
    department: 'Municipal Council — South & West',
    categories: ['roads', 'waste', 'drainage', 'water', 'lighting', 'safety'],
    wardIds: ['ward-04', 'ward-05', 'ward-06'],
    email: 'priya.nair@citycouncil.gov',
    phone: '+1 (555) 204-8103',
    whatsapp: '+1 (555) 204-8103',
    officeAddress: '45 Southgate Terrace, Community Hall',
    responseTargetHours: 24,
    sourceUrl: 'https://lsgd.citycouncil.gov/wards/w-05',
    lastVerifiedIso: '2026-11-15T12:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-04',
    name: 'Eng. David Kowalski',
    branch: 'ADMINISTRATIVE',
    designation: 'Chief Municipal Road Engineer',
    roleType: 'Department Head',
    department: 'Public Works & Highways',
    categories: ['roads', 'safety'],
    wardIds: ['ward-01', 'ward-02', 'ward-03', 'ward-04', 'ward-05', 'ward-06'],
    email: 'd.kowalski@publicworks.gov',
    phone: '+1 (555) 310-4400',
    officeAddress: 'Public Works Yard, 88 Foundry Ave',
    responseTargetHours: 48,
    sourceUrl: 'https://publicworks.gov/directory/leadership',
    lastVerifiedIso: '2026-11-20T09:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-05',
    name: 'Elena Rostova',
    branch: 'ADMINISTRATIVE',
    designation: 'Executive Officer — Solid Waste',
    roleType: 'Civil Servant',
    department: 'Solid Waste & Sanitation',
    categories: ['waste'],
    wardIds: ['ward-01', 'ward-02', 'ward-04'],
    email: 'elena.rostova@sanitation.gov',
    phone: '+1 (555) 310-5512',
    whatsapp: '+1 (555) 310-5512',
    officeAddress: 'Sanitation Depot North, Bay 4',
    responseTargetHours: 12,
    sourceUrl: 'https://sanitation.gov/officers/north',
    lastVerifiedIso: '2026-11-16T14:20:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-06',
    name: 'Karthik Subramanian',
    branch: 'ADMINISTRATIVE',
    designation: 'Senior Sanitation Superintendent',
    roleType: 'Civil Servant',
    department: 'Solid Waste & Sanitation',
    categories: ['waste'],
    wardIds: ['ward-03', 'ward-05', 'ward-06'],
    email: 'k.subramanian@sanitation.gov',
    phone: '+1 (555) 310-5589',
    officeAddress: 'Sanitation Depot South, Sector 9',
    responseTargetHours: 12,
    sourceUrl: 'https://sanitation.gov/officers/south',
    lastVerifiedIso: '2026-11-14T11:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-07',
    name: 'Dr. Miriam Al-Mansoor',
    branch: 'ADMINISTRATIVE',
    designation: 'Director of Stormwater & Drainage',
    roleType: 'Department Head',
    department: 'Stormwater & Sewerage Board',
    categories: ['drainage', 'water'],
    wardIds: ['ward-01', 'ward-02', 'ward-03', 'ward-04', 'ward-05', 'ward-06'],
    email: 'm.almansoor@waterboard.gov',
    phone: '+1 (555) 310-6200',
    officeAddress: 'Hydrology Building, 14 Canal Road',
    responseTargetHours: 24,
    sourceUrl: 'https://waterboard.gov/leadership',
    lastVerifiedIso: '2026-11-10T10:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-08',
    name: 'Samuel Okafor',
    branch: 'ADMINISTRATIVE',
    designation: 'Water Distribution Zonal Engineer',
    roleType: 'Civil Servant',
    department: 'Municipal Water Authority',
    categories: ['water', 'drainage'],
    wardIds: ['ward-01', 'ward-02', 'ward-03', 'ward-04', 'ward-05', 'ward-06'],
    email: 's.okafor@waterboard.gov',
    phone: '+1 (555) 310-6245',
    whatsapp: '+1 (555) 310-6245',
    officeAddress: 'Reservoir Operations Desk, Ward 03',
    responseTargetHours: 18,
    sourceUrl: 'https://waterboard.gov/zonal-engineers',
    lastVerifiedIso: '2026-10-10T09:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-09',
    name: 'Nadia Lindqvist',
    branch: 'ADMINISTRATIVE',
    designation: 'Superintendent — Street Lighting Grid',
    roleType: 'Department Head',
    department: 'Municipal Electrical Division',
    categories: ['lighting', 'safety'],
    wardIds: ['ward-01', 'ward-02', 'ward-03', 'ward-04', 'ward-05', 'ward-06'],
    email: 'nadia.lindqvist@citypower.gov',
    phone: '+1 (555) 310-7720',
    officeAddress: 'Grid Control Center, 210 Substation Way',
    responseTargetHours: 24,
    sourceUrl: 'https://citypower.gov/streetlights/roster',
    lastVerifiedIso: '2026-11-19T16:45:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-10',
    name: 'Thomas Gallagher',
    branch: 'ADMINISTRATIVE',
    designation: 'Deputy Commissioner of Civic Infrastructure',
    roleType: 'Civil Servant',
    department: 'Office of the Municipal Commissioner',
    categories: ['roads', 'waste', 'drainage', 'water', 'lighting', 'safety'],
    wardIds: ['ward-01', 'ward-02', 'ward-03', 'ward-04', 'ward-05', 'ward-06'],
    email: 't.gallagher@cityhall.gov',
    phone: '+1 (555) 200-0100',
    officeAddress: 'City Hall, 3rd Floor, Central Wing',
    responseTargetHours: 36,
    sourceUrl: 'https://cityhall.gov/commissioner-office',
    lastVerifiedIso: '2026-11-21T06:00:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: true,
  },
  {
    id: 'off-11',
    name: 'Sofia Morales',
    branch: 'ADMINISTRATIVE',
    designation: 'Public Space & Pedestrian Safety Officer',
    roleType: 'Civil Servant',
    department: 'Civic Safety & Parks',
    categories: ['safety', 'lighting', 'roads'],
    wardIds: ['ward-01', 'ward-02', 'ward-04', 'ward-05'],
    email: 's.morales@civicsafety.gov',
    phone: '+1 (555) 310-8834',
    officeAddress: 'Municipal Safety Annex, 72 Elm Street',
    responseTargetHours: 24,
    sourceUrl: 'https://civicsafety.gov/officers',
    lastVerifiedIso: '2026-11-12T13:15:00Z',
    isCurrentTermConfirmed: true,
    isContactFromOfficialDomain: false,
  },
];

const MAX_FRESHNESS_DAYS = 30;

export function evaluateAuthorityVerification(
  official: PublicOfficial,
  wardId?: string,
  category?: IssueCategory,
  now: Date = new Date('2026-11-21T15:00:00Z')
): VerifiedAuthority {
  if (!official.sourceUrl || !official.name) {
    return {
      official,
      status: 'UNAVAILABLE',
      verificationReasons: [
        'No authoritative government source confirmed an incumbent for this role.',
      ],
      freshnessLabel: 'Unavailable',
    };
  }

  const verifiedTime = official.lastVerifiedIso
    ? Date.parse(official.lastVerifiedIso)
    : NaN;
  const daysOld = Number.isNaN(verifiedTime)
    ? Infinity
    : Math.max(0, Math.floor((now.getTime() - verifiedTime) / (1000 * 60 * 60 * 24)));
  const isFresh = daysOld <= MAX_FRESHNESS_DAYS;

  const freshnessLabel = Number.isNaN(verifiedTime)
    ? 'Verification date unknown'
    : daysOld === 0
    ? 'Verified today'
    : daysOld === 1
    ? 'Verified yesterday'
    : `Verified ${daysOld} days ago`;

  const matchesJurisdiction = wardId ? official.wardIds.includes(wardId) : true;
  const matchesDepartment = category ? official.categories.includes(category) : true;

  const reasons: string[] = [
    official.isCurrentTermConfirmed
      ? 'Current term/posting confirmed'
      : 'Current term status unconfirmed',
    matchesJurisdiction
      ? 'Jurisdiction matches detected location'
      : 'Jurisdiction boundary overlap uncertain',
    matchesDepartment
      ? 'Department aligns with reported issue'
      : 'General administrative oversight',
    official.isContactFromOfficialDomain
      ? 'Contact published on official source'
      : 'Direct contact details not published on official portal',
  ];

  let status: VerificationStatus = 'PARTIALLY_VERIFIED';
  if (!isFresh) {
    status = 'STALE';
  } else if (
    official.isCurrentTermConfirmed &&
    matchesJurisdiction &&
    matchesDepartment &&
    official.isContactFromOfficialDomain
  ) {
    status = 'VERIFIED';
  }

  return {
    official,
    status,
    verificationReasons: reasons,
    freshnessLabel,
  };
}

export function identifyJurisdiction(
  latitude: number,
  longitude: number,
  explicitWardId?: string
): WardZone {
  if (explicitWardId) {
    const found = WARD_ZONES.find((w) => w.id === explicitWardId);
    if (found) return found;
  }

  const bounded = WARD_ZONES.find(
    (w) =>
      latitude >= w.bounds.minLat &&
      latitude <= w.bounds.maxLat &&
      longitude >= w.bounds.minLng &&
      longitude <= w.bounds.maxLng
  );
  if (bounded) return bounded;

  let closest = WARD_ZONES[0];
  let bestDist = Infinity;
  for (const ward of WARD_ZONES) {
    const dLat = latitude - ward.centerLat;
    const dLng = longitude - ward.centerLng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      closest = ward;
    }
  }
  return closest;
}

export function getResponsibleOfficials(
  wardId: string,
  category: IssueCategory
): PublicOfficial[] {
  const matched = PUBLIC_OFFICIALS.filter(
    (official) =>
      official.wardIds.includes(wardId) &&
      official.categories.includes(category)
  );

  return matched.sort((a, b) => {
    const rank = {
      'Department Head': 0,
      'Civil Servant': 1,
      'Elected Representative': 2,
    };
    return rank[a.roleType] - rank[b.roleType];
  });
}

export const SEED_REPORTS: CivicReport[] = [
  {
    id: 'CF-2026-0412',
    title: 'Deep water-filled pothole along eastbound curb lane',
    category: 'roads',
    severity: 'Urgent',
    description:
      'Asphalt sub-base has collapsed roughly 1.2 meters wide adjacent to the storm grate on Market Street. Standing rainwater obscures the depth, causing cyclists and sedans to swerve into oncoming traffic.',
    address: '214 Market Street, Civic Center',
    latitude: 12.9724,
    longitude: 77.5951,
    wardId: 'ward-01',
    wardName: 'Civic Center & Old Market',
    district: 'Central Metro District',
    mediaType: 'image',
    seedImageKey: 'pothole',
    evidenceHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    complaintFormat: 'FORMAL_LETTER',
    citizenName: 'Rohan Kulkarni',
    citizenContact: '+1 (555) 482-1930',
    authChannel: 'WhatsApp',
    assignedOfficialIds: ['off-04', 'off-10', 'off-01'],
    draftSubject:
      '[URGENT] Road Surface Collapse & Cyclist Hazard at 214 Market Street (Ward 01)',
    draftBody:
      'To Chief Municipal Road Engineer David Kowalski and Ward 01 Councillor Ananya Deshmukh,\n\nI am formally reporting a severe asphalt collapse at 214 Market Street (12.9724, 77.5951) in Civic Center & Old Market. Standing water conceals a deep pothole adjacent to the curb, creating an immediate hazard for two-wheelers and commuters.\n\nGeotagged photographic evidence is attached (SHA-256: e3b0c44298fc1c14...). Please dispatch a Public Works patching crew and place reflective warning cones at the earliest.',
    status: 'Dispatched',
    createdAt: '2026-11-20T09:15:00Z',
    updatedAt: '2026-11-20T14:40:00Z',
  },
  {
    id: 'CF-2026-0418',
    title: 'Unlit crosswalk streetlight pole at Pine St & 4th Ave',
    category: 'lighting',
    severity: 'Urgent',
    description:
      'Municipal lamp standard #P-408 at the busy Pine Street pedestrian crossing has remained completely dark for five consecutive evenings, leaving pedestrians barely visible to turning vehicles after 18:00.',
    address: 'Corner of Pine Street & 4th Ave, Pinehurst',
    latitude: 12.9908,
    longitude: 77.5991,
    wardId: 'ward-02',
    wardName: 'Pinehurst & Transit Corridor',
    district: 'North Metro District',
    mediaType: 'image',
    seedImageKey: 'streetlight',
    evidenceHash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    complaintFormat: 'OFFICIAL_EMAIL',
    citizenName: 'Claire Bennett',
    citizenContact: '+1 (555) 731-9044',
    authChannel: 'Mobile SMS',
    assignedOfficialIds: ['off-09', 'off-11', 'off-02'],
    draftSubject:
      '[URGENT] Non-Functioning Crosswalk Streetlight #P-408 at Pine St & 4th Ave (Ward 02)',
    draftBody:
      'To Superintendent Nadia Lindqvist and Ward 02 Councillor Marcus Vance,\n\nStreetlight pole #P-408 at the Pine Street & 4th Avenue pedestrian crosswalk (12.9908, 77.5991) has been out of service for five nights. Evening transit commuters face severe visibility risks.\n\nKindly prioritize ballast and wiring inspection under the 24-hour electrical maintenance SLA.',
    status: 'Acknowledged',
    createdAt: '2026-11-20T18:45:00Z',
    updatedAt: '2026-11-21T06:10:00Z',
  },
  {
    id: 'CF-2026-0421',
    title: 'Overflowing dual waste & recycling bin blocking sidewalk',
    category: 'waste',
    severity: 'Moderate',
    description:
      'Dual street-corner waste and recycling receptacles have not been cleared in 72 hours. Loose refuse bags and cardboard are spilling across the tactile paving beside the transit stop.',
    address: '88 Station Plaza, Eastwood Canal Belt',
    latitude: 12.9746,
    longitude: 77.6238,
    wardId: 'ward-03',
    wardName: 'Eastwood Tech & Canal Belt',
    district: 'East Metro District',
    mediaType: 'image',
    seedImageKey: 'waste',
    evidenceHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    complaintFormat: 'CIVIC_CONCERN_REPORT',
    citizenName: 'Vikram Menon',
    citizenContact: '+1 (555) 619-3302',
    authChannel: 'WhatsApp',
    assignedOfficialIds: ['off-06', 'off-10', 'off-02'],
    draftSubject:
      'Sanitation Clearance Request: Overflowing Corner Receptacles at 88 Station Plaza (Ward 03)',
    draftBody:
      'To Senior Sanitation Superintendent Karthik Subramanian and Councillor Marcus Vance,\n\nThe dual waste and recycling station at 88 Station Plaza (12.9746, 77.6238) is overflowing onto the pedestrian walkway, obstructing tactile paving and attracting pests.\n\nPlease schedule an immediate collection sweep and evaluate increasing pickup frequency on this transit corridor.',
    status: 'Submitted',
    createdAt: '2026-11-21T04:30:00Z',
    updatedAt: '2026-11-21T04:30:00Z',
  },
];
