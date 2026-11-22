import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import {
  ISSUE_CATEGORIES,
  PUBLIC_OFFICIALS,
  WARD_ZONES,
  evaluateAuthorityVerification,
  getResponsibleOfficials,
  identifyJurisdiction,
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

const PORT = 3000;
const HOST = '0.0.0.0';

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

const RESTRICTED_RESCUE_STAGES: RescueOperationStage[] = [
  'RESPONDER_ACKNOWLEDGED',
  'OFFICIAL_AGENCY_ASSIGNED',
  'RESCUE_IN_PROGRESS',
  'RESOLVED_WITH_EVIDENCE',
];

async function isAuthorizedResponder(req: AuthRequest): Promise<{
  allowed: boolean;
  tier: string;
}> {
  if (!req.user) return { allowed: false, tier: 'UNVERIFIED_CITIZEN' };
  const email = (req.user.email ?? '').toLowerCase();
  if (email === 'souravsviswajith@gmail.com' && req.user.email_verified) {
    return { allowed: true, tier: 'OFFICIAL_AGENCY' };
  }
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
  app.use(express.json({ limit: '25mb' }));

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
      const name =
        typeof req.user!.name === 'string' && req.user!.name.trim()
          ? req.user!.name
          : typeof req.body?.displayName === 'string'
          ? req.body.displayName
          : 'Verified Citizen';
      const user = await getOrCreateUser(uid, email, name);
      return res.json({ user });
    } catch (error) {
      console.error('Failed to sync user:', error);
      return res.status(500).json({ error: 'Unable to sync authenticated user account.' });
    }
  });

  // Directory & jurisdiction lookup
  app.get('/api/directory', (req, res) => {
    const wardId = typeof req.query.wardId === 'string' ? req.query.wardId : undefined;
    const category =
      typeof req.query.category === 'string'
        ? (req.query.category as IssueCategory)
        : undefined;

    let officials = PUBLIC_OFFICIALS;
    if (wardId) {
      officials = officials.filter((o) => o.wardIds.includes(wardId));
    }
    if (category) {
      officials = officials.filter((o) => o.categories.includes(category));
    }

    res.json({
      wards: WARD_ZONES,
      categories: ISSUE_CATEGORIES,
      officials,
    });
  });

  app.post('/api/jurisdiction/resolve', (req, res) => {
    const { latitude, longitude, category, wardId } = req.body ?? {};
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    const ward = identifyJurisdiction(lat, lng, wardId);
    const validCategory: IssueCategory = ISSUE_CATEGORIES.some((c) => c.id === category)
      ? category
      : 'roads';
    const officials = getResponsibleOfficials(ward.id, validCategory);

    return res.json({ ward, officials });
  });

  app.get('/api/v1/authorities/resolve', (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const category =
      typeof req.query.category === 'string'
        ? (req.query.category as IssueCategory)
        : 'roads';

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res
        .status(400)
        .json({ error: 'Valid latitude and longitude required.' });
    }

    const ward = identifyJurisdiction(lat, lon);
    const validCategory: IssueCategory = ISSUE_CATEGORIES.some((c) => c.id === category)
      ? category
      : 'roads';
    const officials = getResponsibleOfficials(ward.id, validCategory).map((official) =>
      evaluateAuthorityVerification(official, ward.id, validCategory)
    );

    return res.json({
      jurisdiction: {
        state: 'Metro State',
        district: ward.district,
        localBodyType: ward.localBodyType,
        localBodyName: ward.localBodyName,
        wardNumber: ward.code,
        wardName: ward.name,
        assemblyConstituency: ward.assemblyConstituency,
        parliamentaryConstituency: ward.parliamentaryConstituency,
        formattedAddress: `${ward.name}, ${ward.district}`,
      },
      authorities: officials,
      dataAvailabilityNotice:
        officials.length === 0
          ? `No machine-readable government directory is currently connected for ${ward.localBodyName}.`
          : null,
    });
  });

  // Civic Reports CRUD backed by Cloud SQL PostgreSQL
  app.get('/api/reports', async (req, res) => {
    try {
      const wardId = typeof req.query.wardId === 'string' ? req.query.wardId : undefined;
      const category =
        typeof req.query.category === 'string' ? req.query.category : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const reports = await listCivicReports({ wardId, category, status });
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
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const description =
      typeof payload.description === 'string' ? payload.description.trim() : '';

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Issue title and description are required to submit a report.' });
    }

    const lat = Number(payload.latitude) || 12.9716;
    const lng = Number(payload.longitude) || 77.5946;
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

    const ward = identifyJurisdiction(lat, lng, payload.wardId);
    const officials = getResponsibleOfficials(ward.id, category);

    try {
      const uid = req.user!.uid;
      const email = req.user!.email ?? `${uid}@citizen.cityfix`;
      const displayName =
        typeof req.user!.name === 'string' && req.user!.name.trim()
          ? req.user!.name
          : typeof payload.citizenName === 'string' && payload.citizenName.trim()
          ? payload.citizenName.trim()
          : 'Verified Citizen';

      await getOrCreateUser(uid, email, displayName);

      const now = new Date().toISOString();
      const shortCode = String(Date.now()).slice(-4);
      const newReport: CivicReport = {
        id: `CF-2026-${shortCode}`,
        userUid: uid,
        title,
        category,
        severity,
        description,
        address:
          typeof payload.address === 'string' && payload.address.trim()
            ? payload.address.trim()
            : `${ward.name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        latitude: lat,
        longitude: lng,
        wardId: ward.id,
        wardName: ward.name,
        district: ward.district,
        mediaType:
          payload.mediaType === 'image' || payload.mediaType === 'video'
            ? payload.mediaType
            : 'none',
        mediaUrl: typeof payload.mediaUrl === 'string' ? payload.mediaUrl : undefined,
        seedImageKey:
          payload.seedImageKey === 'pothole' ||
          payload.seedImageKey === 'streetlight' ||
          payload.seedImageKey === 'waste'
            ? payload.seedImageKey
            : undefined,
        evidenceHash:
          typeof payload.evidenceHash === 'string' && payload.evidenceHash.trim()
            ? payload.evidenceHash.trim()
            : undefined,
        complaintFormat: (
          ['FORMAL_LETTER', 'OFFICIAL_EMAIL', 'CIVIC_CONCERN_REPORT'] as ComplaintFormat[]
        ).includes(payload.complaintFormat)
          ? payload.complaintFormat
          : 'FORMAL_LETTER',
        citizenName: displayName,
        citizenContact: email,
        authChannel: 'Google Sign-In' as AuthChannel,
        assignedOfficialIds: officials.map((o) => o.id),
        draftSubject:
          typeof payload.draftSubject === 'string' && payload.draftSubject.trim()
            ? payload.draftSubject.trim()
            : `[${severity.toUpperCase()}] Civic Report: ${title} (${ward.code})`,
        draftBody:
          typeof payload.draftBody === 'string' && payload.draftBody.trim()
            ? payload.draftBody.trim()
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
      const updated = await updateCivicReportStatusRecord(String(id), status);
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
  app.get('/api/cemn/events', async (_req, res) => {
    try {
      const data = await listCemnSyncedEvents();
      return res.json(data);
    } catch (error) {
      console.error('GET /api/cemn/events failed:', error);
      return res.status(500).json({ error: 'Unable to load CEMN recovery records.' });
    }
  });

  app.post('/api/cemn/sync', requireAuth, async (req: AuthRequest, res) => {
    const packets = Array.isArray(req.body?.packets)
      ? (req.body.packets as CemnPacket[])
      : [];
    if (packets.length === 0) {
      return res.json({ syncedCount: 0, duplicateSkippedCount: 0 });
    }

    try {
      const authz = await isAuthorizedResponder(req);
      // Enforce zero privilege escalation: unverified/citizen devices cannot sync official evacuation orders
      const safePackets = packets.filter((p) => {
        if (p.eventType === 'EVACUATION_ORDER' && !authz.allowed) {
          return false;
        }
        return true;
      });

      const result = await syncCemnPacketsToDb(
        safePackets,
        req.user!.uid,
        authz.tier
      );
      return res.json({
        ...result,
        rejectedUnauthorized: packets.length - safePackets.length,
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
    if (typeof messageId !== 'string' || !validStages.includes(nextStage)) {
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
        note: typeof note === 'string' && note.trim() ? note.trim() : `Stage updated to ${nextStage}`,
      });
      return res.json({ ok: true, messageId, nextStage, actorTier: authz.tier });
    } catch (error) {
      console.error('POST /api/cemn/advance-stage failed:', error);
      return res.status(500).json({ error: 'Failed to record rescue operation update.' });
    }
  });

  // Server-side AI-Assisted Formal Complaint Draft Generation
  app.post('/api/draft', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Settings > Secrets. Add a Gemini API key to enable AI-assisted complaint drafting.',
      });
    }

    const {
      title,
      category,
      severity,
      description,
      address,
      latitude,
      longitude,
      wardName,
      district,
      officials,
      citizenName,
      citizenContact,
      mediaDescription,
      evidenceHash,
      format,
      imageBase64,
      imageMimeType,
    } = req.body ?? {};

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Issue title and description are required to draft a formal complaint.' });
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
          .map(
            (o: { name?: string; designation?: string; department?: string; email?: string }) =>
              `- ${o.name ?? 'Official'} (${o.designation ?? ''}, ${o.department ?? ''}, ${o.email ?? ''})`
          )
          .join('\n')
      : 'Municipal Department Officials';

    const promptText = `Draft a structured ${formatLabel} on behalf of a citizen.

Issue Details:
- Format Requested: ${formatLabel}
- Title: ${title}
- Category: ${categoryMeta.label} (${categoryMeta.department})
- Severity: ${severity ?? 'Moderate'}
- Street / Landmark Address: ${address ?? 'Not specified'}
- Geotagged Coordinates: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}
- Jurisdiction: ${wardName ?? 'Municipal Ward'} — ${district ?? 'Metro District'}
- Citizen Description: ${description}
- Visual Evidence Note: ${mediaDescription ?? 'Photographic/video evidence attached by citizen.'}${
      evidenceHash ? `\n- Evidence Integrity SHA-256 Digest: ${evidenceHash}` : ''
    }
- Reporting Citizen: ${citizenName ?? 'Verified Resident'} (${citizenContact ?? 'On file'})

Responsible Authorities Addressed:
${officialLines}

Requirements:
1. Write a concise, authoritative email subject line including severity, location, and ward.
2. Write a formal, respectful, evidence-driven complaint body addressed to the named officials above, citing the exact coordinates, ward jurisdiction, public safety or infrastructure impact, and clear action requested with a 24-48 hour inspection timeline.
3. Recommend the best primary submission channel (e.g., Official Email + Ward WhatsApp Desk).
4. Provide a 1-sentence urgency summary.`;

    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (
        typeof imageBase64 === 'string' &&
        imageBase64.length > 0 &&
        typeof imageMimeType === 'string' &&
        imageMimeType.startsWith('image/')
      ) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
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
      const message =
        err instanceof Error ? err.message : 'Failed to generate AI complaint draft.';
      console.error('[CityFix AI Draft Error]', err);
      return res.status(502).json({
        error: `AI Draft generation failed: ${message}`,
      });
    }
  });

  // === Multi-turn Gemini Chatbot with Search & Maps Grounding ===
  app.post('/api/chat', optionalAuth, async (req, res) => {
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
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text ?? '') }],
      }));

    const config: Record<string, unknown> = {
      systemInstruction:
        'You are CityFix Civic Assistant, helping citizens navigate municipal infrastructure grievances, ward jurisdiction responsibilities, verified disaster preparedness protocols, and emergency mesh readiness. Be factual, concise, and never invent official agency dispatches.',
    };

    if (groundingMode === 'search') {
      config.tools = [{ googleSearch: {} }];
    } else if (groundingMode === 'maps') {
      config.tools = [{ googleMaps: {} }];
      if (
        latLng &&
        typeof latLng.latitude === 'number' &&
        typeof latLng.longitude === 'number'
      ) {
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
      const message = err instanceof Error ? err.message : 'Chat generation failed.';
      console.error('[CityFix Chat Error]', err);
      return res.status(502).json({ error: message });
    }
  });

  // === Audio Transcription (gemini-3.5-transcribe) ===
  app.post('/api/transcribe', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in Settings > Secrets.',
      });
    }

    const { audioBase64, mimeType } = req.body ?? {};
    if (typeof audioBase64 !== 'string' || !audioBase64) {
      return res.status(400).json({ error: 'Audio payload is required for transcription.' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this citizen audio report accurately with proper punctuation.',
            },
          ],
        },
      });
      return res.json({ transcript: (response.text ?? '').trim() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transcription failed.';
      console.error('[CityFix Transcribe Error]', err);
      return res.status(502).json({ error: `Audio transcription failed: ${message}` });
    }
  });

  // === Animate Civic Evidence Image into Video (gemini-omni-1.2-flash Interactions API) ===
  app.post('/api/animate-video', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing in Settings > Secrets.',
      });
    }

    const { imageBase64, mimeType, prompt, aspectRatio } = req.body ?? {};
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return res.status(400).json({ error: 'Base64 evidence image is required.' });
    }

    const validAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
    const motionPrompt =
      typeof prompt === 'string' && prompt.trim()
        ? prompt.trim()
        : 'Subtle documentary inspection camera pan revealing the civic infrastructure condition and surrounding street context clearly.';

    try {
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type:
                typeof mimeType === 'string' && mimeType ? mimeType : 'image/jpeg',
              data: imageBase64,
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
      const message = err instanceof Error ? err.message : 'Video generation failed.';
      console.error('[CityFix Animate Video Error]', err);
      return res.status(502).json({
        error: `Video animation failed (${message}). Note: gemini-omni-1.2-flash requires a paid Gemini API key in Settings > Secrets.`,
      });
    }
  });

  // Vite integration (dev) or static bundle serving (prod)
  const server = http.createServer(app);

  // Real-Time Voice Live API WebSocket Bridge (/ws/live)
  const liveWss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/ws/live') {
      liveWss.handleUpgrade(request, socket, head, (ws) => {
        liveWss.emit('connection', ws, request);
      });
    }
  });

  liveWss.on('connection', async (clientWs) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
      clientWs.close();
      return;
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are CityFix Live Civic & Emergency Dispatcher Assistant. Help citizens report urban infrastructure hazards clearly, explain ward escalation paths, and summarize immediate NDMA safety steps during emergencies without claiming to dispatch government vehicles.',
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
          },
          onerror: (err) => {
            if (clientWs.readyState === 1) {
              clientWs.send(
                JSON.stringify({
                  error: err instanceof Error ? err.message : 'Live session error',
                })
              );
            }
          },
        },
      });

      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ ready: true }));
      }
    } catch (err) {
      clientWs.send(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Unable to connect to Gemini Live.',
        })
      );
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (typeof msg.audio === 'string' && msg.audio.length > 0) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          liveSession.sendRealtimeInput({ text: msg.text.trim() });
        }
      } catch {
        // Ignore malformed websocket frames
      }
    });

    clientWs.on('close', () => {
      try {
        liveSession?.close();
      } catch {
        // Ignore close errors
      }
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
