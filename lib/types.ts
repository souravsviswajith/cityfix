export type Severity = 'low' | 'medium' | 'high' | 'emergency';
export type ReportStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'resolved';

export interface Officer {
  id: string;
  name: string;
  designation: string;
  department: string;
  departmentId: string;
  jurisdictionId: string;
  jurisdictionName: string;
  district: string;
  phone: string;
  email: string;
  kind: 'elected' | 'officer' | 'collector' | 'state' | 'helpline';
}

export interface ResolvedAuthority {
  official: Officer;
  role: 'department' | 'elected' | 'collector' | 'state';
}

export interface TimelineEntry {
  at: string;
  label: string;
  note?: string;
}

export interface Report {
  id: string;
  refNo: string;
  userId: string;
  category: string;
  title: string;
  description: string;
  severity: Severity;
  address: string;
  landmark?: string;
  lat: number;
  lng: number;
  jurisdictionId: string;
  jurisdictionName: string;
  departmentName: string;
  officials: Officer[];
  draftSubject: string;
  draftBody: string;
  channel: 'email' | 'whatsapp' | 'download';
  photo?: string;
  hasVideo?: boolean;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  upvotes: number;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface OtpEntry {
  phone: string;
  code: string;
  expiresAt: string;
  attempts: number;
}

export interface DBShape {
  users: User[];
  sessions: Session[];
  otps: OtpEntry[];
  reports: Report[];
  counters: { reportSeq: number };
}
