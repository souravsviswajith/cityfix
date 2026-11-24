import { ISSUE_CATEGORIES } from '../data/civicDirectory';
import type {
  CemnEventType,
  CemnIdentityTier,
  CemnPacket,
  RescueOperationStage,
  SeverityLevel,
} from '../types/civic';

export const ALLOWED_REPORT_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
]);

export const RESTRICTED_RESCUE_STAGES: readonly RescueOperationStage[] = [
  'RESPONDER_ACKNOWLEDGED',
  'OFFICIAL_AGENCY_ASSIGNED',
  'RESCUE_IN_PROGRESS',
  'RESOLVED_WITH_EVIDENCE',
];

const ALL_RESCUE_STAGES: readonly RescueOperationStage[] = [
  'CITIZEN_REPORTED',
  'VOLUNTEER_RESPONSE',
  ...RESTRICTED_RESCUE_STAGES,
];

const VALID_EVENT_TYPES: readonly CemnEventType[] = [
  'SOS',
  'MISSING_PERSON',
  'RESOURCE',
  'EVACUATION_ORDER',
];

const VALID_SEVERITIES: readonly SeverityLevel[] = [
  'Low',
  'Moderate',
  'Urgent',
  'Critical',
];

const VALID_COORD_SOURCES = ['GPS', 'CELL_WIFI', 'MANUAL_PIN'] as const;

const VALID_IDENTITY_TIERS: readonly CemnIdentityTier[] = [
  'UNVERIFIED_CITIZEN',
  'VERIFIED_CITIZEN',
  'COMMUNITY_VOLUNTEER',
  'VERIFIED_RESPONDER',
  'OFFICIAL_AGENCY',
];

const PRIVILEGED_IDENTITY_TIERS: readonly CemnIdentityTier[] = [
  'VERIFIED_RESPONDER',
  'OFFICIAL_AGENCY',
];

const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);
const BASE64_IMAGE_DATA_URL_RE =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i;
const BASE64_VIDEO_DATA_URL_RE =
  /^data:video\/mp4;base64,[A-Za-z0-9+/=\r\n]+$/i;
const BASE64_RAW_RE = /^[A-Za-z0-9+/=\r\n]+$/;

export function sanitizeExternalHref(rawUrl: unknown): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeSafeMediaUrl(rawUrl: unknown): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('data:')) {
    if (trimmed.length > 8_500_000) return undefined;
    return BASE64_IMAGE_DATA_URL_RE.test(trimmed) ? trimmed : undefined;
  }

  // Allow relative bundled asset paths (e.g. Vite /assets/... or /src/...)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (trimmed.length > 512 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }

  return sanitizeExternalHref(trimmed);
}

export function sanitizeSafeVideoDataUrl(rawUrl: unknown): string | undefined {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 35_000_000) return undefined;
  return BASE64_VIDEO_DATA_URL_RE.test(trimmed) ? trimmed : undefined;
}

export function validateReportMediaUrlInput(rawUrl: unknown): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  if (rawUrl === undefined || rawUrl === null || rawUrl === '') {
    return { valid: true, value: undefined };
  }
  if (typeof rawUrl !== 'string') {
    return { valid: false, error: 'Invalid mediaUrl format.' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }
  if (trimmed.startsWith('blob:')) {
    // Ephemeral browser blob URLs cannot persist across sessions
    return { valid: true, value: undefined };
  }
  if (trimmed.length > 8_500_000) {
    return { valid: false, error: 'Attached media payload exceeds maximum allowed size.' };
  }
  if (trimmed.startsWith('data:')) {
    if (!BASE64_IMAGE_DATA_URL_RE.test(trimmed)) {
      return {
        valid: false,
        error: 'Only JPEG, PNG, or WebP image data URLs are permitted.',
      };
    }
    return { valid: true, value: trimmed };
  }
  const safeExternal = sanitizeExternalHref(trimmed);
  if (!safeExternal) {
    return {
      valid: false,
      error: 'Media URL must use a valid http(s) address or supported image data URI.',
    };
  }
  return { valid: true, value: safeExternal };
}

export function validateEvidenceHash(rawHash: unknown): string | undefined {
  if (typeof rawHash !== 'string') return undefined;
  const trimmed = rawHash.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return undefined;
}

export function validateBase64Media(
  rawData: unknown,
  rawMime: unknown,
  allowedMimes: Set<string>,
  maxBase64Length: number
): { ok: true; data: string; mimeType: string } | { ok: false; error: string } {
  if (typeof rawData !== 'string' || !rawData.trim()) {
    return { ok: false, error: 'Media payload is required.' };
  }
  const compact = rawData.trim();
  if (compact.length > maxBase64Length) {
    return { ok: false, error: 'Media payload exceeds the server size limit.' };
  }
  if (!BASE64_RAW_RE.test(compact)) {
    return { ok: false, error: 'Media payload must be valid base64 data.' };
  }
  const normalizedMime =
    typeof rawMime === 'string' ? rawMime.split(';')[0].trim().toLowerCase() : '';
  if (!allowedMimes.has(normalizedMime)) {
    return {
      ok: false,
      error: `Unsupported media MIME type "${normalizedMime || 'unknown'}".`,
    };
  }
  return { ok: true, data: compact, mimeType: normalizedMime };
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function isValidReportId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(id);
}

export function validateReportCategoryFilter(val: unknown): string | undefined {
  if (typeof val !== 'string' || !val || val === 'all') return undefined;
  return ISSUE_CATEGORIES.some((c) => c.id === val) ? val : undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeJsonRecord(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const clean: Record<string, unknown> = {};
  const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (forbidden.has(k) || k.length > 64) continue;
    if (count >= 25) break;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v === null
    ) {
      clean[k] = typeof v === 'string' ? v.slice(0, 500) : v;
      count += 1;
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 20).map((item) =>
        typeof item === 'string' ? item.slice(0, 120) : typeof item === 'number' || typeof item === 'boolean' ? item : String(item).slice(0, 120)
      );
      count += 1;
    }
  }
  return clean;
}

export function sanitizeCemnSyncPacket(
  raw: unknown,
  actorUid: string,
  isResponder: boolean
): { ok: true; packet: CemnPacket } | { ok: false; reason: string; unauthorized?: boolean } {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'Packet must be a structured object.' };
  }

  const messageId = typeof raw.messageId === 'string' ? raw.messageId.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(messageId)) {
    return { ok: false, reason: 'Invalid packet messageId format.' };
  }

  const eventType = raw.eventType as CemnEventType;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return { ok: false, reason: 'Invalid CEMN eventType.' };
  }
  if (eventType === 'EVACUATION_ORDER' && !isResponder) {
    return {
      ok: false,
      reason: 'Only verified responders or coordinators can sync evacuation orders.',
      unauthorized: true,
    };
  }

  const rescueStage = (raw.rescueStage ?? 'CITIZEN_REPORTED') as RescueOperationStage;
  if (!ALL_RESCUE_STAGES.includes(rescueStage)) {
    return { ok: false, reason: 'Invalid rescueStage value.' };
  }
  if (RESTRICTED_RESCUE_STAGES.includes(rescueStage) && !isResponder) {
    return {
      ok: false,
      reason: 'Unverified citizen accounts cannot sync responder-acknowledged or closed rescue stages.',
      unauthorized: true,
    };
  }

  const identityTier = (raw.identityTier ?? 'VERIFIED_CITIZEN') as CemnIdentityTier;
  if (!VALID_IDENTITY_TIERS.includes(identityTier)) {
    return { ok: false, reason: 'Invalid identityTier value.' };
  }
  if (PRIVILEGED_IDENTITY_TIERS.includes(identityTier) && !isResponder) {
    return {
      ok: false,
      reason: 'Unverified citizen accounts cannot claim responder or official agency tier.',
      unauthorized: true,
    };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 180) : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 1000) : '';
  const wardId = typeof raw.wardId === 'string' ? raw.wardId.trim().slice(0, 64) : '';
  if (!title || !summary || !wardId) {
    return { ok: false, reason: 'Packet title, summary, and wardId are required.' };
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!isValidCoordinatePair(latitude, longitude)) {
    return { ok: false, reason: 'Packet coordinates must be finite valid lat/lng.' };
  }

  const coordAccuracyM = Number(raw.coordAccuracyM ?? 15);
  if (!Number.isFinite(coordAccuracyM) || coordAccuracyM < 0 || coordAccuracyM > 50_000) {
    return { ok: false, reason: 'Invalid coordAccuracyM value.' };
  }

  const hopCount = Number(raw.hopCount ?? 1);
  if (!Number.isInteger(hopCount) || hopCount < 0 || hopCount > 64) {
    return { ok: false, reason: 'Invalid hopCount value.' };
  }

  const severity = VALID_SEVERITIES.includes(raw.severity as SeverityLevel)
    ? (raw.severity as SeverityLevel)
    : 'Urgent';

  const coordSource = (VALID_COORD_SOURCES as readonly string[]).includes(
    String(raw.coordSource)
  )
    ? (raw.coordSource as CemnPacket['coordSource'])
    : 'GPS';

  const createdAtDate = new Date(String(raw.createdAt ?? ''));
  const ttlDate = new Date(String(raw.ttlExpiresAt ?? ''));
  if (Number.isNaN(createdAtDate.getTime()) || Number.isNaN(ttlDate.getTime())) {
    return { ok: false, reason: 'Invalid createdAt or ttlExpiresAt timestamp.' };
  }

  const relayPath = Array.isArray(raw.relayPath)
    ? raw.relayPath
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .slice(0, 16)
        .map((x) => x.trim().slice(0, 64))
    : [];

  const signature =
    typeof raw.signature === 'string' && raw.signature.trim()
      ? raw.signature.trim().slice(0, 256)
      : 'unsigned-local-device';

  const publicKeyFingerprint =
    typeof raw.publicKeyFingerprint === 'string' && raw.publicKeyFingerprint.trim()
      ? raw.publicKeyFingerprint.trim().slice(0, 128)
      : 'LOCAL-DEVICE';

  const authorLabel =
    typeof raw.authorLabel === 'string' && raw.authorLabel.trim()
      ? raw.authorLabel.trim().slice(0, 120)
      : 'Verified Citizen';

  const transportMode =
    typeof raw.transportMode === 'string' && raw.transportMode.trim()
      ? raw.transportMode.trim().slice(0, 160)
      : 'BLE_WIFI_HYBRID';

  const deliveryStatus: CemnPacket['deliveryStatus'] =
    isResponder && raw.deliveryStatus === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'RECEIVED';

  return {
    ok: true,
    packet: {
      messageId,
      eventType,
      title,
      summary,
      wardId,
      latitude,
      longitude,
      coordSource,
      coordAccuracyM,
      severity,
      identityTier,
      authorUid: actorUid,
      authorLabel,
      publicKeyFingerprint,
      signature,
      deliveryStatus,
      rescueStage,
      hopCount,
      relayPath,
      transportMode,
      payload: sanitizeJsonRecord(raw.payload),
      ttlExpiresAt: ttlDate.toISOString(),
      createdAt: createdAtDate.toISOString(),
      syncedToCloud: true,
      syncedAt: new Date().toISOString(),
    },
  };
}

export function isSameOriginWebSocketRequest(
  originHeader: string | undefined,
  hostHeader: string | undefined,
  forwardedHostHeader: string | undefined
): boolean {
  if (!originHeader || !originHeader.trim()) {
    return false;
  }
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader.trim());
  } catch {
    return false;
  }
  if (!SAFE_EXTERNAL_PROTOCOLS.has(parsedOrigin.protocol)) {
    return false;
  }

  const candidateHosts = [forwardedHostHeader, hostHeader]
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .flatMap((h) => h.split(',').map((part) => part.trim().toLowerCase()))
    .filter(Boolean);

  if (candidateHosts.length === 0) {
    return false;
  }

  const originHost = parsedOrigin.host.toLowerCase();
  const originHostname = parsedOrigin.hostname.toLowerCase();
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

  return candidateHosts.some((expectedHost) => {
    if (originHost === expectedHost) return true;
    const expectedHostname = expectedHost.split(':')[0];
    return loopbackHosts.has(originHostname) && loopbackHosts.has(expectedHostname);
  });
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  consume(key: string, nowMs = Date.now()): {
    allowed: boolean;
    retryAfterSec: number;
    remaining: number;
  } {
    const cutoff = nowMs - this.windowMs;
    const existing = this.buckets.get(key) ?? [];
    const recent = existing.filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      this.buckets.set(key, recent);
      return { allowed: false, retryAfterSec, remaining: 0 };
    }

    recent.push(nowMs);
    this.buckets.set(key, recent);

    if (this.buckets.size > 5000) {
      for (const [k, list] of this.buckets.entries()) {
        if (list.length === 0 || list[list.length - 1] <= cutoff) {
          this.buckets.delete(k);
        }
      }
    }

    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, this.maxRequests - recent.length),
    };
  }
}
