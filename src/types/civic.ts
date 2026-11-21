export type IssueCategory =
  | 'roads'
  | 'waste'
  | 'drainage'
  | 'water'
  | 'lighting'
  | 'safety';

export type SeverityLevel = 'Low' | 'Moderate' | 'Urgent' | 'Critical';

export type ReportStatus =
  | 'Submitted'
  | 'Acknowledged'
  | 'Dispatched'
  | 'Resolved';

export type AuthChannel = 'Mobile SMS' | 'WhatsApp';

export type AuthorityBranch = 'POLITICAL' | 'ADMINISTRATIVE';

export type VerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'STALE'
  | 'UNAVAILABLE';

export type ComplaintFormat =
  | 'FORMAL_LETTER'
  | 'OFFICIAL_EMAIL'
  | 'CIVIC_CONCERN_REPORT';

export interface WardZone {
  id: string;
  code: string;
  name: string;
  district: string;
  localBodyType: string;
  localBodyName: string;
  assemblyConstituency: string;
  parliamentaryConstituency: string;
  centerLat: number;
  centerLng: number;
  population: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  svgX: number;
  svgY: number;
  svgW: number;
  svgH: number;
}

export interface PublicOfficial {
  id: string;
  name: string;
  branch: AuthorityBranch;
  designation: string;
  roleType: 'Elected Representative' | 'Civil Servant' | 'Department Head';
  department: string;
  categories: IssueCategory[];
  wardIds: string[];
  email: string | null;
  phone: string | null;
  whatsapp?: string;
  officeAddress: string;
  responseTargetHours: number;
  sourceUrl: string | null;
  lastVerifiedIso: string | null;
  isCurrentTermConfirmed: boolean;
  isContactFromOfficialDomain: boolean;
}

export interface VerifiedAuthority {
  official: PublicOfficial;
  status: VerificationStatus;
  verificationReasons: string[];
  freshnessLabel: string;
}

export interface CivicReport {
  id: string;
  title: string;
  category: IssueCategory;
  severity: SeverityLevel;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  wardId: string;
  wardName: string;
  district: string;
  mediaType: 'image' | 'video' | 'none';
  mediaUrl?: string;
  seedImageKey?: 'pothole' | 'streetlight' | 'waste';
  evidenceHash?: string;
  complaintFormat?: ComplaintFormat;
  citizenName: string;
  citizenContact: string;
  authChannel: AuthChannel;
  assignedOfficialIds: string[];
  draftSubject: string;
  draftBody: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalDraftReport {
  localId: string;
  title: string;
  category: IssueCategory;
  severity: SeverityLevel;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  wardId: string;
  complaintFormat: ComplaintFormat;
  draftSubject: string;
  draftBody: string;
  evidenceHash?: string;
  savedAt: string;
}

export interface CitizenSession {
  authenticated: boolean;
  name: string;
  contact: string;
  channel: AuthChannel;
  verifiedAt: string;
}

export interface GeneratedDraftResponse {
  subject: string;
  body: string;
  recommendedChannel: string;
  urgencySummary: string;
}

export type DisasterScale = 'LOCAL_EMERGENCY' | 'LARGE_SCALE_DISASTER';

export interface DisasterCategoryMeta {
  id: string;
  title: string;
  scale: DisasterScale;
  immediateActions: string[];
  strictDoNots: string[];
  sourceAgency: string;
  sourceUrl: string;
}

export interface EmergencyHelpline {
  serviceName: string;
  phoneNumber: string;
  scope: string;
  isVerifiedOfficial: boolean;
  sourceCitation: string;
}
