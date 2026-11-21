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

export interface WardZone {
  id: string;
  code: string;
  name: string;
  district: string;
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
  designation: string;
  roleType: 'Elected Representative' | 'Civil Servant' | 'Department Head';
  department: string;
  categories: IssueCategory[];
  wardIds: string[];
  email: string;
  phone: string;
  whatsapp?: string;
  officeAddress: string;
  responseTargetHours: number;
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
