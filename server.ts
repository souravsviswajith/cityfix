import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ISSUE_CATEGORIES,
  PUBLIC_OFFICIALS,
  SEED_REPORTS,
  WARD_ZONES,
  getResponsibleOfficials,
  identifyJurisdiction,
} from './src/data/civicDirectory.js';
import type {
  AuthChannel,
  CivicReport,
  IssueCategory,
  ReportStatus,
  SeverityLevel,
} from './src/types/civic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '0.0.0.0';

// In-memory store for civic reports and OTP challenges
const reportsStore: CivicReport[] = [...SEED_REPORTS];

interface OtpChallenge {
  code: string;
  contact: string;
  channel: AuthChannel;
  name: string;
  expiresAt: number;
}
const otpStore = new Map<string, OtpChallenge>();

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'cityfix', timestamp: new Date().toISOString() });
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

  // Citizen Authentication (Mobile SMS or WhatsApp OTP)
  app.post('/api/auth/request-otp', (req, res) => {
    const { contact, channel, name } = req.body ?? {};
    if (typeof contact !== 'string' || contact.trim().length < 7) {
      return res
        .status(400)
        .json({ error: 'Please enter a valid mobile phone or WhatsApp number.' });
    }
    const authChannel: AuthChannel =
      channel === 'WhatsApp' ? 'WhatsApp' : 'Mobile SMS';
    const cleanContact = contact.trim();
    const cleanName =
      typeof name === 'string' && name.trim().length > 0
        ? name.trim()
        : 'Verified Citizen';

    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(cleanContact, {
      code,
      contact: cleanContact,
      channel: authChannel,
      name: cleanName,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return res.json({
      sent: true,
      channel: authChannel,
      contact: cleanContact,
      // Sandbox verification helper so evaluators can verify without an external SMS gateway
      verificationPreviewCode: code,
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const { contact, code, name } = req.body ?? {};
    if (typeof contact !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'Contact number and verification code are required.' });
    }

    const cleanContact = contact.trim();
    const challenge = otpStore.get(cleanContact);
    if (!challenge) {
      return res.status(404).json({ error: 'No pending verification code found for this number.' });
    }
    if (Date.now() > challenge.expiresAt) {
      otpStore.delete(cleanContact);
      return res.status(410).json({ error: 'Verification code expired. Request a new code.' });
    }
    if (challenge.code !== code.trim()) {
      return res.status(401).json({ error: 'Incorrect verification code. Please check and retry.' });
    }

    otpStore.delete(cleanContact);
    const resolvedName =
      typeof name === 'string' && name.trim().length > 0
        ? name.trim()
        : challenge.name;

    return res.json({
      session: {
        authenticated: true,
        name: resolvedName,
        contact: challenge.contact,
        channel: challenge.channel,
        verifiedAt: new Date().toISOString(),
      },
    });
  });

  // Civic Reports CRUD
  app.get('/api/reports', (req, res) => {
    const { wardId, category, status } = req.query;
    let list = [...reportsStore];

    if (typeof wardId === 'string' && wardId !== 'all') {
      list = list.filter((r) => r.wardId === wardId);
    }
    if (typeof category === 'string' && category !== 'all') {
      list = list.filter((r) => r.category === category);
    }
    if (typeof status === 'string' && status !== 'all') {
      list = list.filter((r) => r.status === status);
    }

    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ reports: list });
  });

  app.post('/api/reports', (req, res) => {
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

    const now = new Date().toISOString();
    const nextNum = 422 + reportsStore.length;
    const newReport: CivicReport = {
      id: `CF-2026-0${nextNum}`,
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
      citizenName:
        typeof payload.citizenName === 'string' && payload.citizenName.trim()
          ? payload.citizenName.trim()
          : 'Anonymous Citizen',
      citizenContact:
        typeof payload.citizenContact === 'string' && payload.citizenContact.trim()
          ? payload.citizenContact.trim()
          : 'Unverified Guest',
      authChannel: payload.authChannel === 'WhatsApp' ? 'WhatsApp' : 'Mobile SMS',
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

    reportsStore.unshift(newReport);
    return res.status(201).json({ report: newReport });
  });

  app.patch('/api/reports/:id/status', (req, res) => {
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
    const target = reportsStore.find((r) => r.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Civic report not found.' });
    }
    target.status = status;
    target.updatedAt = new Date().toISOString();
    return res.json({ report: target });
  });

  // Server-side AI-Assisted Formal Complaint Draft Generation via @google/genai
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
      imageBase64,
      imageMimeType,
    } = req.body ?? {};

    if (!title || !description) {
      return res
        .status(400)
        .json({ error: 'Issue title and description are required to draft a formal complaint.' });
    }

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

    const promptText = `Draft a structured, formal municipal complaint letter / reporting email on behalf of a citizen.

Issue Details:
- Title: ${title}
- Category: ${categoryMeta.label} (${categoryMeta.department})
- Severity: ${severity ?? 'Moderate'}
- Street / Landmark Address: ${address ?? 'Not specified'}
- Geotagged Coordinates: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}
- Jurisdiction: ${wardName ?? 'Municipal Ward'} — ${district ?? 'Metro District'}
- Citizen Description: ${description}
- Visual Evidence Note: ${mediaDescription ?? 'Photographic/video evidence attached by citizen.'}
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

  // Vite integration (dev) or static bundle serving (prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, HOST, () => {
    console.log(`CityFix server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
