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

export type AuthChannel = 'Google Sign-In' | 'Mobile SMS' | 'WhatsApp';

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
  userUid?: string | null;
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
  uid?: string;
  email?: string;
  role?: 'citizen' | 'responder' | 'coordinator';
  idToken?: string;
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

// === CityFix Emergency Mesh Network (CEMN) Domain Types ===

export type MeshOperatingMode = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';

export type MeshRadioType =
  | 'BLE'
  | 'WIFI_DIRECT'
  | 'WIFI_MESH_NODE'
  | 'LORA_GATEWAY'
  | 'SATELLITE_BACKHAUL';

export type MeshDeliveryStatus =
  | 'QUEUED'
  | 'RELAYED'
  | 'RECEIVED'
  | 'ACKNOWLEDGED';

export type CemnIdentityTier =
  | 'UNVERIFIED_CITIZEN'
  | 'VERIFIED_CITIZEN'
  | 'COMMUNITY_VOLUNTEER'
  | 'VERIFIED_RESPONDER'
  | 'OFFICIAL_AGENCY';

export type RescueOperationStage =
  | 'CITIZEN_REPORTED'
  | 'VOLUNTEER_RESPONSE'
  | 'RESPONDER_ACKNOWLEDGED'
  | 'OFFICIAL_AGENCY_ASSIGNED'
  | 'RESCUE_IN_PROGRESS'
  | 'RESOLVED_WITH_EVIDENCE';

export type CemnEventType = 'SOS' | 'MISSING_PERSON' | 'RESOURCE' | 'EVACUATION_ORDER';

export interface CemnNode {
  nodeId: string;
  label: string;
  radioType: MeshRadioType;
  wardId: string;
  lat: number;
  lng: number;
  batteryPct: number;
  rssiDbm: number;
  hopDistance: number;
  verifiedResponderNode: boolean;
  status: 'ACTIVE' | 'INTERMITTENT' | 'OFFLINE';
  lastSeenIso: string;
}

export interface CemnPacket {
  messageId: string;
  eventType: CemnEventType;
  title: string;
  summary: string;
  wardId: string;
  latitude: number;
  longitude: number;
  coordSource: 'GPS' | 'CELL_WIFI' | 'MANUAL_PIN';
  coordAccuracyM: number;
  severity: SeverityLevel;
  identityTier: CemnIdentityTier;
  authorUid?: string | null;
  authorLabel: string;
  publicKeyFingerprint: string;
  signature: string;
  deliveryStatus: MeshDeliveryStatus;
  rescueStage: RescueOperationStage;
  hopCount: number;
  relayPath: string[];
  transportMode: string;
  payload: Record<string, unknown>;
  ttlExpiresAt: string;
  createdAt: string;
  syncedToCloud: boolean;
  syncedAt?: string | null;
}

export interface CemnAuditEntry {
  id: number;
  eventMessageId: string;
  actorUid: string;
  actorTier: string;
  action: string;
  previousStage?: string | null;
  nextStage?: string | null;
  note: string;
  createdAt: string;
}
