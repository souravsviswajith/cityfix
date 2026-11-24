import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import {
  ISSUE_CATEGORIES,
} from './src/data/civicDirectory.js';
import {
  createCivicReportRecord,
  getOrCreateUser,
  getUserByUid,
  listCemnSyncedEvents,
  listCivicReports,
  syncCemnPacketsToDb,
  updateCemnRescueStageInDb,
  updateCivicReportStatusRecord,
} from './src/db/repository.ts';
import {
  ALLOWED_AUDIO_MIMES,
  ALLOWED_REPORT_IMAGE_MIMES,
  RESTRICTED_RESCUE_STAGES,
  SlidingWindowRateLimiter,
  isSameOriginWebSocketRequest,
  isValidCoordinatePair,
  isValidReportId,
  sanitizeCemnSyncPacket,
  validateBase64Media,
  validateEvidenceHash,
  validateReportCategoryFilter,
  validateReportMediaUrlInput,
} from './src/lib/securityValidation.ts';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import type {
  AuthChannel,
  CemnPacket,
  CivicReport,
  ComplaintFormat,
  IssueCategory,
  ReportStatus,
  RescueOperationStage,
  SeverityLevel,
} from './src/types/civic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST?.trim() || '0.0.0.0';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const aiTextRateLimiter = new SlidingWindowRateLimiter(30, 60_000);
const aiVideoRateLimiter = new SlidingWindowRateLimiter(6, 60_000);
const liveWsRateLimiter = new SlidingWindowRateLimiter(10, 60_000);
const MAX_ACTIVE_LIVE_SESSIONS = 5;

function getClientRateKey(req: AuthRequest): string {
  if (req.user?.uid) {
    return `uid:${req.user.uid}`;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp =
    typeof forwarded === 'string' && forwarded.trim()
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${clientIp}`;
}

async function isAuthorizedResponder(req: AuthRequest): Promise<{
  allowed: boolean;
  tier: string;
}> {
  if (!req.user) return { allowed: false, tier: 'UNVERIFIED_CITIZEN' };
  const dbUser = await getUserByUid(req.user.uid);
  if (dbUser && (dbUser.role === 'coordinator' || dbUser.role === 'responder')) {
    return {
      allowed: true,
      tier: dbUser.role === 'coordinator' ? 'OFFICIAL_AGENCY' : 'VERIFIED_RESPONDER',
    };
  }
  return { allowed: false, tier: 'VERIFIED_CITIZEN' };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (never set X-Frame-Options so iframe preview remains functional)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Strict 1MB default JSON cap; 12MB cap only on explicit media upload routes
  const defaultJsonParser = express.json({ limit: '1mb' });
  const mediaJsonParser = express.json({ limit: '12mb' });
  const mediaPostPaths = new Set([
    '/api/reports',
    '/api/draft',
    '/api/transcribe',
    '/api/animate-video',
  ]);
  app.use((req, res, next) => {
    if (req.method === 'POST' && mediaPostPaths.has(req.path)) {
      return mediaJsonParser(req, res, next);
    }
    return defaultJsonParser(req, res, next);
  });

  // Public runtime config (exposes only public browser Maps API key, never private secrets)
  app.get('/api/public-config', (_req, res) => {
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({
      mapsApiKey,
      hasGemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    });
  });

  // Health check (no eager DB probes on startup per Cloud SQL guidelines)
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'cityfix', timestamp: new Date().toISOString() });
  });

  // Sync Firebase authenticated user to Cloud SQL
  app.post('/api/auth/sync-user', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email ?? `${uid}@citizen.cityfix`;
      const rawName =
        typeof req.user!.name === 'string' && req.user!.name.trim()
          ? req.user!.name
          : typeof req.body?.displayName === 'string'
          ? req.body.displayName
          : 'Verified Citizen';
      const name = rawName.trim().slice(0, 100) || 'Verified Citizen';
      const user = await getOrCreateUser(uid, email, name);
      return res.json({ user });
    } catch (error) {
      console.error('Failed to sync user:', error);
      return res.status(500).json({ error: 'Unable to sync authenticated user account.' });
    }
  });

  // Authority and jurisdiction data are disabled until connected to attributable,
  // authoritative government sources and versioned GIS boundaries.
  app.get('/api/directory', (_req, res) =>
    res.status(503).json({ status: 'UNAVAILABLE', error: 'Authoritative government directory is not configured.' })
  );
  app.post('/api/jurisdiction/resolve', (_req, res) =>
    res.status(503).json({ status: 'UNAVAILABLE', error: 'Authoritative GIS jurisdiction data is not configured.' })
  );
  app.get('/api/v1/authorities/resolve', (_req, res) =>
    res.status(503).json({ status: 'UNAVAILABLE', error: 'Authoritative government directory and GIS data are not configured.' })
  );

  // Civic Reports CRUD backed by Cloud SQL PostgreSQL
  app.get('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawWardId = typeof req.query.wardId === 'string' ? req.query.wardId.trim() : undefined;
      const wardId = rawWardId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawWardId) ? rawWardId : undefined;
      const category = validateReportCategoryFilter(req.query.category);
      const allowedStatusFilters: readonly ReportStatus[] = [
        'Submitted',
        'Acknowledged',
        'Dispatched',
        'Resolved',
      ];
      const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
      const status =
        rawStatus && (allowedStatusFilters as readonly string[]).includes(rawStatus)
          ? rawStatus
          : undefined;

      const dbUser = await getUserByUid(req.user!.uid);
      const isResponder = dbUser?.role === 'responder' || dbUser?.role === 'coordinator';
      const reports = await listCivicReports({
        wardId,
        category,
        status,
        userUid: isResponder ? undefined : req.user!.uid,
      });
      return res.json({ reports });
    } catch (error) {
      console.error('GET /api/reports failed:', error);
      return res
        .status(500)
        .json({ error: 'Failed to load civic reports from PostgreSQL database.' });
    }
  });

  app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    const payload = req.body ?? {};
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 180) : '';
    const description =
      typeof payload.description === 'string' ? payload.description.trim().slice(0, 4000) : '';

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Issue title and description are required to submit a report.' });
    }

    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    if (!isValidCoordinatePair(lat, lng)) {
      return res.status(400).json({ error: 'Valid incident coordinates are required.' });
    }

    const mediaValidation = validateReportMediaUrlInput(payload.mediaUrl);
    if (!mediaValidation.valid) {
      return res.status(400).json({ error: mediaValidation.error });
    }

    const category: IssueCategory = ISSUE_CATEGORIES.some(
      (c) => c.id === payload.category
    )
      ? payload.category
      : 'roads';
    const severity: SeverityLevel = ['Low', 'Moderate', 'Urgent', 'Critical'].includes(
      payload.severity
    )
      ? payload.severity
      : 'Moderate';

    try {
      const uid = req.user!.uid;
      const email = req.user!.email ?? `${uid}@citizen.cityfix`;
      const rawDisplayName =
        typeof req.user!.name === 'string' && req.user!.name.trim()
          ? req.user!.name
          : typeof payload.citizenName === 'string' && payload.citizenName.trim()
          ? payload.citizenName.trim()
          : 'Verified Citizen';
      const displayName = rawDisplayName.slice(0, 100);

      await getOrCreateUser(uid, email, displayName);

      const now = new Date().toISOString();
      const shortCode = randomBytes(3).toString('hex').toUpperCase();
      const newReport: CivicReport = {
        id: `CF-2026-${shortCode}`,
        userUid: uid,
        title,
        category,
        severity,
        description,
        address:
          typeof payload.address === 'string' && payload.address.trim()
            ? payload.address.trim().slice(0, 280)
            : `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        latitude: lat,
        longitude: lng,
        wardId: 'UNRESOLVED',
        wardName: 'Jurisdiction not verified',
        district: 'Not verified',
        mediaType:
          payload.mediaType === 'image' || payload.mediaType === 'video'
            ? payload.mediaType
            : 'none',
        mediaUrl: mediaValidation.value,
        seedImageKey:
          payload.seedImageKey === 'pothole' ||
          payload.seedImageKey === 'streetlight' ||
          payload.seedImageKey === 'waste'
            ? payload.seedImageKey
            : undefined,
        evidenceHash: validateEvidenceHash(payload.evidenceHash),
        complaintFormat: (
          ['FORMAL_LETTER', 'OFFICIAL_EMAIL', 'CIVIC_CONCERN_REPORT'] as ComplaintFormat[]
        ).includes(payload.complaintFormat)
          ? payload.complaintFormat
          : 'FORMAL_LETTER',
        citizenName: displayName,
        citizenContact: email,
        authChannel: 'Google Sign-In' as AuthChannel,
        assignedOfficialIds: [],
        draftSubject:
          typeof payload.draftSubject === 'string' && payload.draftSubject.trim()
            ? payload.draftSubject.trim().slice(0, 240)
            : `[${severity.toUpperCase()}] Civic Report: ${title} (jurisdiction unverified)`.slice(0, 240),
        draftBody:
          typeof payload.draftBody === 'string' && payload.draftBody.trim()
            ? payload.draftBody.trim().slice(0, 12000)
            : description,
        status: 'Submitted',
        createdAt: now,
        updatedAt: now,
      };

      const saved = await createCivicReportRecord(newReport);
      return res.status(201).json({ report: saved });
    } catch (error) {
      console.error('POST /api/reports failed:', error);
      return res.status(500).json({ error: 'Failed to store civic report.' });
    }
  });

  app.patch('/api/reports/:id/status', requireAuth, async (req: AuthRequest, res) => {
    const { id } = req.params;
    if (!isValidReportId(id)) {
      return res.status(400).json({ error: 'Invalid civic report ID format.' });
    }
    const { status } = req.body ?? {};
    const allowedStatuses: ReportStatus[] = [
      'Submitted',
      'Acknowledged',
      'Dispatched',
      'Resolved',
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid report status value.' });
    }

    try {
      const authz = await isAuthorizedResponder(req);
      if (!authz.allowed) {
        return res.status(403).json({ error: 'Only an administrator-assigned responder or coordinator may change report status.' });
      }
      const updated = await updateCivicReportStatusRecord(id, status);
      if (!updated) {
        return res.status(404).json({ error: 'Civic report not found.' });
      }
      return res.json({ report: updated });
    } catch (error) {
      console.error('PATCH /api/reports/:id/status failed:', error);
      return res.status(500).json({ error: 'Failed to update civic report status.' });
    }
  });

  // === CityFix Emergency Mesh Network (CEMN) Recovery & Coordination Routes ===
  app.get('/api/cemn/events', requireAuth, async (req: AuthRequest, res) => {
    try {
      const authz = await isAuthorizedResponder(req);
      if (!authz.allowed) {
        return res.status(403).json({ error: 'CEMN event and audit records are restricted to verified responders and coordinators.' });
      }
      const data = await listCemnSyncedEvents();
      return res.json(data);
    } catch (error) {
      console.error('GET /api/cemn/events failed:', error);
      return res.status(500).json({ error: 'Unable to load CEMN recovery records.' });
    }
  });

  app.post('/api/cemn/sync', requireAuth, async (req: AuthRequest, res) => {
    const packets = Array.isArray(req.body?.packets)
      ? (req.body.packets as unknown[])
      : [];
    if (packets.length === 0) {
      return res.json({
        syncedCount: 0,
        duplicateSkippedCount: 0,
        acceptedMessageIds: [],
        rejectedUnauthorized: 0,
        rejectedInvalid: 0,
      });
    }
    if (packets.length > 50) {
      return res.status(400).json({
        error: 'CEMN sync batch exceeds maximum limit of 50 packets per request.',
      });
    }

    try {
      const authz = await isAuthorizedResponder(req);
      const safePackets: CemnPacket[] = [];
      let rejectedUnauthorized = 0;
      let rejectedInvalid = 0;

      for (const rawPkt of packets) {
        const sanitized = sanitizeCemnSyncPacket(rawPkt, req.user!.uid, authz.allowed);
        if (sanitized.ok) {
          safePackets.push(sanitized.packet);
        } else if (sanitized.unauthorized) {
          rejectedUnauthorized += 1;
        } else {
          rejectedInvalid += 1;
        }
      }

      if (safePackets.length === 0) {
        const status = rejectedUnauthorized > 0 && rejectedInvalid === 0 ? 403 : 400;
        return res.status(status).json({
          error:
            rejectedUnauthorized > 0
              ? 'Security Policy: Standard citizen accounts cannot synchronize privileged responder stages, authority tiers, or evacuation orders.'
              : 'All CEMN sync packets failed schema validation.',
          syncedCount: 0,
          duplicateSkippedCount: 0,
          acceptedMessageIds: [],
          rejectedUnauthorized,
          rejectedInvalid,
        });
      }

      const result = await syncCemnPacketsToDb(
        safePackets,
        req.user!.uid,
        authz.tier
      );
      return res.json({
        ...result,
        acceptedMessageIds: safePackets.map((p) => p.messageId),
        rejectedUnauthorized,
        rejectedInvalid,
      });
    } catch (error) {
      console.error('POST /api/cemn/sync failed:', error);
      return res.status(500).json({ error: 'Failed to synchronize CEMN packets.' });
    }
  });

  app.post('/api/cemn/advance-stage', requireAuth, async (req: AuthRequest, res) => {
    const { messageId, nextStage, note } = req.body ?? {};
    const validStages: RescueOperationStage[] = [
      'CITIZEN_REPORTED',
      'VOLUNTEER_RESPONSE',
      'RESPONDER_ACKNOWLEDGED',
      'OFFICIAL_AGENCY_ASSIGNED',
      'RESCUE_IN_PROGRESS',
      'RESOLVED_WITH_EVIDENCE',
    ];
    if (
      typeof messageId !== 'string' ||
      !/^[A-Za-z0-9_-]{4,64}$/.test(messageId) ||
      !validStages.includes(nextStage)
    ) {
      return res.status(400).json({ error: 'Valid messageId and nextStage are required.' });
    }

    try {
      const authz = await isAuthorizedResponder(req);
      if (RESTRICTED_RESCUE_STAGES.includes(nextStage) && !authz.allowed) {
        return res.status(403).json({
          error:
            'Security Policy: Only verified responders or authorized agency coordinators can acknowledge, assign official teams, or close an emergency incident.',
        });
      }

      await updateCemnRescueStageInDb({
        messageId,
        nextStage,
        actorUid: req.user!.uid,
        actorTier: authz.tier,
        note:
          typeof note === 'string' && note.trim()
            ? note.trim().slice(0, 500)
            : `Stage updated to ${nextStage}`,
      });
      return res.json({ ok: true, messageId, nextStage, actorTier: authz.tier });
    } catch (error) {
      console.error('POST /api/cemn/advance-stage failed:', error);
      return res.status(500).json({ error: 'Failed to record rescue operation update.' });
    }
  });

  // Server-side AI-Assisted Formal Complaint Draft Generation
  app.post('/api/draft', optionalAuth, async (req: AuthRequest, res) => {
    const limitCheck = aiTextRateLimiter.consume(getClientRateKey(req));
    if (!limitCheck.allowed) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        error: `Too many AI requests. Retry in ${limitCheck.retryAfterSec}s.`,
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add a Gemini API key to enable AI-assisted complaint drafting.',
      });
    }

    const {
      title: rawTitle,
      category,
      severity,
      description: rawDescription,
      address: rawAddress,
      latitude,
      longitude,
      wardName: rawWardName,
      district: rawDistrict,
      officials,
      citizenName: rawCitizenName,
      citizenContact: rawCitizenContact,
      mediaDescription: rawMediaDesc,
      evidenceHash: rawEvidenceHash,
      format,
      imageBase64,
      imageMimeType,
    } = req.body ?? {};

    const title = typeof rawTitle === 'string' ? rawTitle.trim().slice(0, 200) : '';
    const description =
      typeof rawDescription === 'string' ? rawDescription.trim().slice(0, 4000) : '';

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Issue title and description are required to draft a formal complaint.' });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const coordsText = isValidCoordinatePair(latNum, lngNum)
      ? `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`
      : 'Not specified';

    let validatedImage: { data: string; mimeType: string } | null = null;
    if (typeof imageBase64 === 'string' && imageBase64.trim().length > 0) {
      const check = validateBase64Media(
        imageBase64,
        imageMimeType,
        ALLOWED_REPORT_IMAGE_MIMES,
        10_000_000
      );
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      validatedImage = { data: check.data, mimeType: check.mimeType };
    }

    const formatLabel =
      format === 'OFFICIAL_EMAIL'
        ? 'Official Email'
        : format === 'CIVIC_CONCERN_REPORT'
        ? 'Civic Concern Field Report'
        : 'Formal Municipal Letter';

    const categoryMeta =
      ISSUE_CATEGORIES.find((c) => c.id === category) ?? ISSUE_CATEGORIES[0];
    const officialLines = Array.isArray(officials)
      ? officials
          .slice(0, 12)
          .map(
            (o: { name?: unknown; designation?: unknown; department?: unknown; email?: unknown }) =>
              `- ${String(o?.name ?? 'Official').slice(0, 100)} (${String(o?.designation ?? '').slice(0, 100)}, ${String(o?.department ?? '').slice(0, 100)}, ${String(o?.email ?? '').slice(0, 120)})`
          )
          .join('\n')
      : 'Municipal Department Officials';

    const safeSeverity = ['Low', 'Moderate', 'Urgent', 'Critical'].includes(String(severity))
      ? String(severity)
      : 'Moderate';
    const safeAddress =
      typeof rawAddress === 'string' && rawAddress.trim()
        ? rawAddress.trim().slice(0, 280)
        : 'Not specified';
    const safeWard =
      typeof rawWardName === 'string' && rawWardName.trim()
        ? rawWardName.trim().slice(0, 120)
        : 'Municipal Ward';
    const safeDistrict =
      typeof rawDistrict === 'string' && rawDistrict.trim()
        ? rawDistrict.trim().slice(0, 120)
        : 'Metro District';
    const safeMediaDesc =
      typeof rawMediaDesc === 'string' && rawMediaDesc.trim()
        ? rawMediaDesc.trim().slice(0, 300)
        : 'Photographic/video evidence attached by citizen.';
    const safeHash = validateEvidenceHash(rawEvidenceHash);
    const safeCitizenName =
      typeof rawCitizenName === 'string' && rawCitizenName.trim()
        ? rawCitizenName.trim().slice(0, 100)
        : 'Verified Resident';
    const safeCitizenContact =
      typeof rawCitizenContact === 'string' && rawCitizenContact.trim()
        ? rawCitizenContact.trim().slice(0, 120)
        : 'On file';

    const promptText = `Draft a structured ${formatLabel} on behalf of a citizen.

Issue Details:
- Format Requested: ${formatLabel}
- Title: ${title}
- Category: ${categoryMeta.label} (${categoryMeta.department})
- Severity: ${safeSeverity}
- Street / Landmark Address: ${safeAddress}
- Geotagged Coordinates: ${coordsText}
- Jurisdiction: ${safeWard} — ${safeDistrict}
- Citizen Description: ${description}
- Visual Evidence Note: ${safeMediaDesc}${
      safeHash ? `\n- Evidence Integrity SHA-256 Digest: ${safeHash}` : ''
    }
- Reporting Citizen: ${safeCitizenName} (${safeCitizenContact})

Responsible Authorities Addressed:
${officialLines}

Requirements:
1. Write a concise, authoritative email subject line including severity, location, and ward.
2. Write a formal, respectful, evidence-driven complaint body addressed to the named officials above, citing the exact coordinates, ward jurisdiction, public safety or infrastructure impact, and clear action requested with a 24-48 hour inspection timeline.
3. Recommend the best primary submission channel (e.g., Official Email + Ward WhatsApp Desk).
4. Provide a 1-sentence urgency summary.`;

    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (validatedImage) {
        parts.push({
          inlineData: {
            mimeType: validatedImage.mimeType,
            data: validatedImage.data,
          },
        });
        parts.push({
          text:
            promptText +
            '\n\nAlso inspect the attached evidence photograph and incorporate accurate visual observations (such as surface condition, obstruction, or hazard details) into the formal complaint body.',
        });
      } else {
        parts.push({ text: promptText });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are a civic accountability drafting specialist helping citizens write clear, factual, formal municipal complaints addressed to elected representatives and civil servants.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: 'Formal email subject line for the civic complaint.',
              },
              body: {
                type: Type.STRING,
                description:
                  'Complete formal complaint letter with salutation, structured issue & location summary, evidence reference, requested action, and citizen sign-off.',
              },
              recommendedChannel: {
                type: Type.STRING,
                description: 'Recommended communication channel (e.g. Official Email & Ward WhatsApp Desk).',
              },
              urgencySummary: {
                type: Type.STRING,
                description: 'One-sentence operational urgency assessment.',
              },
            },
            required: ['subject', 'body', 'recommendedChannel', 'urgencySummary'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);
      return res.json({ draft: parsed });
    } catch (err: unknown) {
      console.error('[CityFix AI Draft Error]', err);
      return res.status(502).json({
        error: 'AI Draft generation failed. Please try again shortly.',
      });
    }
  });

  // === Multi-turn Gemini Chatbot with Search & Maps Grounding ===
  app.post('/api/chat', optionalAuth, async (req: AuthRequest, res) => {
    const limitCheck = aiTextRateLimiter.consume(getClientRateKey(req));
    if (!limitCheck.allowed) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        error: `Too many chat requests. Retry in ${limitCheck.retryAfterSec}s.`,
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in Settings > Secrets.',
      });
    }

    const { messages, model, groundingMode, latLng } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Conversation messages array is required.' });
    }
    if (messages.length > 30) {
      return res.status(400).json({ error: 'Conversation history exceeds maximum turn limit.' });
    }

    const allowedModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-4-neon',
      'gemini-4-carbon',
    ];
    let selectedModel = allowedModels.includes(model) ? model : 'gemini-4-hydrogen';

    // Grounding tools require gemini-4-hydrogen
    if (groundingMode === 'search' || groundingMode === 'maps') {
      selectedModel = 'gemini-4-hydrogen';
    }

    const contents = messages
      .slice(-20)
      .map((m: { role?: string; text?: string }) => ({
        role: m?.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m?.text ?? '').slice(0, 4000) }],
      }));

    const config: Record<string, unknown> = {
      systemInstruction:
        'You are CityFix Civic Assistant, helping citizens navigate municipal infrastructure grievances, ward jurisdiction responsibilities, verified disaster preparedness protocols, and emergency mesh readiness. Be factual, concise, and never invent official agency dispatches.',
    };

    if (groundingMode === 'search') {
      config.tools = [{ googleSearch: {} }];
    } else if (groundingMode === 'maps') {
      config.tools = [{ googleMaps: {} }];
      if (latLng && isValidCoordinatePair(latLng.latitude, latLng.longitude)) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: latLng.latitude,
              longitude: latLng.longitude,
            },
          },
        };
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      });

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const webSources: Array<{ title: string; uri: string }> = [];
      const mapsSources: Array<{
        title: string;
        uri: string;
        snippets: string[];
      }> = [];

      for (const chunk of groundingChunks) {
        if (chunk.web?.uri) {
          webSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
        if (chunk.maps?.uri) {
          const snippets: string[] = [];
          const reviewSnippets = chunk.maps.placeAnswerSources?.reviewSnippets;
          if (Array.isArray(reviewSnippets)) {
            for (const s of reviewSnippets) {
              const snippetObj = s as { content?: string; title?: string; googleMapsUri?: string };
              const snippetText = snippetObj.content || snippetObj.title;
              if (snippetText) snippets.push(snippetText);
            }
          }
          mapsSources.push({
            title: chunk.maps.title || 'Google Maps Place',
            uri: chunk.maps.uri,
            snippets,
          });
        }
      }

      return res.json({
        reply: response.text ?? '',
        modelUsed: selectedModel,
        webSources,
        mapsSources,
      });
    } catch (err: unknown) {
      console.error('[CityFix Chat Error]', err);
      return res.status(502).json({
        error: 'Unable to generate civic assistant response right now.',
      });
    }
  });

  // === Audio Transcription (gemini-3.5-transcribe) ===
  app.post('/api/transcribe', optionalAuth, async (req: AuthRequest, res) => {
    const limitCheck = aiTextRateLimiter.consume(getClientRateKey(req));
    if (!limitCheck.allowed) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        error: `Too many transcription requests. Retry in ${limitCheck.retryAfterSec}s.`,
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in Settings > Secrets.',
      });
    }

    const { audioBase64, mimeType, prompt } = req.body ?? {};
    const rawMime = typeof mimeType === 'string' && mimeType.trim() ? mimeType : 'audio/webm';
    const mediaCheck = validateBase64Media(
      audioBase64,
      rawMime,
      ALLOWED_AUDIO_MIMES,
      10_000_000
    );
    if (!mediaCheck.ok) {
      return res.status(400).json({ error: mediaCheck.error });
    }

    const instruction =
      typeof prompt === 'string' && prompt.trim()
        ? prompt.trim().slice(0, 500)
        : 'Transcribe this audio accurately with proper punctuation.';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mediaCheck.mimeType,
                data: mediaCheck.data,
              },
            },
            {
              text: instruction,
            },
          ],
        },
      });
      return res.json({
        transcript: (response.text ?? '').trim(),
        modelUsed: 'gemini-3.5-transcribe',
      });
    } catch (err: unknown) {
      console.error('[CityFix Transcribe Error]', err);
      return res.status(502).json({
        error: 'Audio transcription failed. Please verify the audio clip and try again.',
      });
    }
  });

  // === Animate Civic Evidence Image into Video (gemini-omni-1.2-flash Interactions API) ===
  app.post('/api/animate-video', optionalAuth, async (req: AuthRequest, res) => {
    const limitCheck = aiVideoRateLimiter.consume(getClientRateKey(req));
    if (!limitCheck.allowed) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSec));
      return res.status(429).json({
        error: `Video animation rate limit reached. Retry in ${limitCheck.retryAfterSec}s.`,
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in Settings > Secrets.',
      });
    }

    const { imageBase64, mimeType, prompt, aspectRatio } = req.body ?? {};
    const mediaCheck = validateBase64Media(
      imageBase64,
      typeof mimeType === 'string' && mimeType.trim() ? mimeType : 'image/jpeg',
      ALLOWED_REPORT_IMAGE_MIMES,
      10_000_000
    );
    if (!mediaCheck.ok) {
      return res.status(400).json({ error: mediaCheck.error });
    }

    const validAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
    const motionPrompt =
      typeof prompt === 'string' && prompt.trim()
        ? prompt.trim().slice(0, 1000)
        : 'Subtle documentary inspection camera pan revealing the civic infrastructure condition and surrounding street context clearly.';

    try {
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mediaCheck.mimeType,
              data: mediaCheck.data,
            },
            {
              type: 'text',
              text: motionPrompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspect,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart?.data) {
        return res.status(502).json({ error: 'No video output returned by model.' });
      }

      return res.json({
        videoBase64: videoPart.data,
        mimeType: videoPart.mime_type || 'video/mp4',
      });
    } catch (err: unknown) {
      console.error('[CityFix Animate Video Error]', err);
      return res.status(502).json({
        error:
          'Video animation failed. Note: gemini-omni-1.2-flash requires a paid Gemini API key in Settings > Secrets.',
      });
    }
  });

  // Vite integration (dev) or static bundle serving (prod)
  const server = http.createServer(app);

  // Real-Time Voice Live API WebSocket Bridge (/ws/live)
  let activeLiveSessions = 0;
  const liveWss = new WebSocketServer({
    noServer: true,
    maxPayload: 256 * 1024,
  });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/ws/live') {
      return;
    }

    const forwardedHost = Array.isArray(request.headers['x-forwarded-host'])
      ? request.headers['x-forwarded-host'][0]
      : request.headers['x-forwarded-host'];
    if (
      !isSameOriginWebSocketRequest(
        request.headers.origin,
        request.headers.host,
        forwardedHost
      )
    ) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const forwardedFor = Array.isArray(request.headers['x-forwarded-for'])
      ? request.headers['x-forwarded-for'][0]
      : request.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwardedFor === 'string' && forwardedFor.split(',')[0].trim()) ||
      request.socket.remoteAddress ||
      'unknown';
    const wsRate = liveWsRateLimiter.consume(`ws:${clientIp}`);
    if (!wsRate.allowed) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (activeLiveSessions >= MAX_ACTIVE_LIVE_SESSIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    liveWss.handleUpgrade(request, socket, head, (ws) => {
      liveWss.emit('connection', ws, request);
    });
  });

  liveWss.on('connection', (clientWs, request) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
      clientWs.close();
      return;
    }

    activeLiveSessions += 1;
    let cleanedUp = false;

    const reqUrl = new URL(request.url ?? '/ws/live', 'http://localhost');
    const requestedVoice = reqUrl.searchParams.get('voice') ?? 'Zephyr';
    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
    const voiceName = (allowedVoices as readonly string[]).includes(requestedVoice)
      ? requestedVoice
      : 'Zephyr';

    let clientClosed = false;

    const sessionPromise = ai.live
      .connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are CityFix Live Civic & Emergency Dispatcher Assistant. Help citizens report urban infrastructure hazards clearly, explain ward escalation paths, and summarize immediate NDMA safety steps during emergencies without claiming to dispatch government vehicles. Keep spoken responses clear, calm, and concise.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err) => {
            console.error('[CityFix Live Session Error]', err);
            if (clientWs.readyState === 1) {
              clientWs.send(
                JSON.stringify({
                  error: 'Live voice session encountered an upstream error.',
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ closed: true }));
              clientWs.close();
            }
          },
        },
      })
      .then((session) => {
        if (clientClosed || clientWs.readyState !== 1) {
          try {
            session.close();
          } catch {
            // Ignore close error
          }
          return null;
        }
        clientWs.send(JSON.stringify({ ready: true, model: 'gemini-3.8-live', voice: voiceName }));
        return session;
      })
      .catch((err) => {
        console.error('[CityFix Live Connect Error]', err);
        if (clientWs.readyState === 1) {
          clientWs.send(
            JSON.stringify({
              error: 'Unable to connect to Gemini Live service.',
            })
          );
          clientWs.close();
        }
        return null;
      });

    let idleTimer: NodeJS.Timeout | null = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ error: 'Live session closed due to inactivity.' }));
          clientWs.close();
        }
      }, 5 * 60_000);
    };
    resetIdleTimer();

    clientWs.on('message', (raw) => {
      resetIdleTimer();
      sessionPromise.then((liveSession) => {
        if (!liveSession || clientClosed) return;
        try {
          const msg = JSON.parse(raw.toString());
          if (typeof msg.audio === 'string' && msg.audio.length > 0 && msg.audio.length <= 160_000) {
            liveSession.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (typeof msg.text === 'string' && msg.text.trim()) {
            liveSession.sendRealtimeInput({ text: msg.text.trim().slice(0, 2000) });
          }
        } catch {
          // Ignore malformed websocket frames
        }
      });
    });

    clientWs.on('close', () => {
      clientClosed = true;
      if (!cleanedUp) {
        cleanedUp = true;
        activeLiveSessions = Math.max(0, activeLiveSessions - 1);
      }
      if (idleTimer) clearTimeout(idleTimer);
      sessionPromise.then((liveSession) => {
        try {
          liveSession?.close();
        } catch {
          // Ignore close errors
        }
      });
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`CityFix server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
