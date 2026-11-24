# Security Summary

**Reviewed Files**: 51
**Issues Resolved**: 9

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Mesh Sync Role & Schema Bypass | `server.ts`, `src/db/repository.ts` | 366, 330 | `POST /api/cemn/sync` only filtered out `EVACUATION_ORDER` packets, letting signed-in citizens submit responder-only rescue stages, `OFFICIAL_AGENCY` identity tiers, unbounded batches, invalid timestamps, or force `ACKNOWLEDGED` status. | High | Fixed | Capped batch size at 50 packets, validated every packet with `sanitizeCemnSyncPacket` (`src/lib/securityValidation.ts:259`), blocked citizen spoofing of privileged stages/tiers, and stored server-verified `deliveryStatus`. |
| Stored Media & External Link Validation | `server.ts`, `src/data/civicMedia.ts`, `src/components/ReportComposer.tsx`, `src/components/CivicAiStudioView.tsx`, `src/components/CivicLedgerView.tsx`, `src/components/WorkspaceDocsView.tsx`, `src/components/OfficialsDirectory.tsx`, `src/components/DisasterManagementView.tsx` | 230, 14, 663, 751 | `POST /api/reports` saved unvalidated `mediaUrl` strings (including `javascript:`, `data:image/svg+xml`, or ephemeral `blob:` URLs) and dynamic external links rendered directly in `<a href>` and `<img>`. | High | Fixed | Enforced `validateReportMediaUrlInput` and `validateEvidenceHash` on report submission, filtered `blob:` preview URLs out of saved reports, and gated dynamic links/media through `sanitizeExternalHref`, `sanitizeSafeMediaUrl`, and `sanitizeSafeVideoDataUrl`. |
| Cross-Site WebSocket & Unbounded Live Bridge | `server.ts` | 950 | `/ws/live` accepted WebSocket upgrades from any foreign `Origin` with no payload cap, no connection limit, no rate limit, and no inactivity timeout before opening a Gemini Live session. | High | Fixed | Added `isSameOriginWebSocketRequest` origin validation on HTTP upgrade (returning `403`), enforced `maxPayload: 256 * 1024`, capped concurrent sessions at 5, added per-IP upgrade rate limiting, and added a 5-minute inactivity timeout. |
| AI Upload MIME Validation & Error Sanitization | `server.ts` | 479, 683, 805, 868 | `/api/draft`, `/api/chat`, `/api/transcribe`, and `/api/animate-video` lacked rate limits, accepted unsafe MIME types like `image/svg+xml` or `text/html`, accepted unbounded chat histories, and echoed raw upstream errors. | High | Fixed | Added `optionalAuth` + `SlidingWindowRateLimiter`, enforced strict image/audio MIME allowlists (`validateBase64Media`) and size caps, validated coordinates and message bounds, and returned safe error summaries while logging details server-side. |
| Global Large Body Limit | `server.ts` | 115 | A global `25mb` JSON parser applied to all routes, allowing oversized request bodies against lightweight text/JSON endpoints. | Medium | Fixed | Restricted default `express.json` limit to `1mb` globally and scoped the `12mb` JSON parser strictly to `POST` media endpoints (`/api/reports`, `/api/draft`, `/api/transcribe`, `/api/animate-video`). |
| Report ID Collision & Input Bounds | `server.ts` | 178, 212, 321 | Report IDs used `Date.now().slice(-4)` (high collision risk), `PATCH /api/reports/:id/status` did not validate `:id` format, and `GET /api/reports` filters lacked validation. | Medium | Fixed | Switched report IDs to cryptographically random 3-byte hex suffixes (`randomBytes(3)`), validated `:id` with `isValidReportId`, and enforced length/allowlist checks across report query filters and text fields. |
| Cross-Tab Mesh Relay & Optimistic Rollback | `src/services/cemnMeshEngine.ts`, `src/components/EmergencyMeshPanel.tsx`, `src/components/MeshMessageQueue.tsx` | 339, 107, 220 | `EmergencyMeshPanel` called `/api/cemn/events` without an auth header, failed to roll back optimistic stage updates on `403` rejections, hardcoded `ACKNOWLEDGED` after citizen syncs, and accepted unvalidated `BroadcastChannel` relays. | Medium | Fixed | Scoped `/api/cemn/events` calls to authorized responders with Bearer auth, added optimistic state/`localStorage` rollback on failed stage updates, reconciled exact server-accepted packet IDs, and strictly validated `BroadcastChannel` relays. |
| Missing HTTP Security Headers | `server.ts` | 104 | Express exposed `X-Powered-By` and omitted `X-Content-Type-Options` and `Referrer-Policy` headers (while keeping iframe embedding intact without `X-Frame-Options`). | Low | Fixed | Disabled `x-powered-by`, configured `trust proxy`, and set `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. |
| Incomplete Environment Variable Template | `.env.example` | 1 | Database and allowed-host variables referenced in `src/db/index.ts` and `vite.config.ts` were omitted from `.env.example`. | Low | Fixed | Documented empty `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, and `VITE_ALLOWED_HOSTS` placeholders without any secret values. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Database Queries | `src/db/repository.ts`, `src/db/schema.ts` | All PostgreSQL reads and writes use Drizzle ORM query builders with bound parameters; zero raw SQL string interpolation exists. |
| Firebase Auth & Firestore Rules | `firestore.rules`, `src/middleware/auth.ts`, `src/lib/firebase-admin.ts` | Backend protected routes verify Firebase ID tokens via Admin SDK; Firestore enforces default-deny, verified email auth, owner `uid` checks, and field allowlists. |
| Google Workspace OAuth Tokens | `src/context/AuthContext.tsx`, `src/lib/workspaceClient.ts` | Drive/Docs OAuth access tokens remain strictly in JS memory (never persisted to browser storage) and support explicit session disconnection and 401 expiry clearing. |
| Android Mobile Hardening | `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/com/cityfix/android/data/IncidentDao.kt` | Disables device backup (`allowBackup="false"`) and cleartext HTTP (`usesCleartextTraffic="false"`), enforces runtime permissions, and binds Room SQL parameters cleanly. |
| Dependencies & Supply Chain | `package.json`, `bun.lock` | `bun audit` verified that direct dependencies (`firebase@13.4.0`, `firebase-admin@14.5.1`, `vite@8.3.8`, `tsx@4.23.15`, `drizzle-kit@0.31.11`) are on latest releases with patched `esbuild@0.28.2` and `@grpc/grpc-js@1.14.7` where available; legacy unpatched transitive pins live inside upstream meta-packages without reachable custom servers. |

---

## PoC Verification

### Unverified Citizen Escalating Rescue Stage or Authority Tier via Offline Mesh Sync

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Role & Input Validation in Offline Sync |
| Impact | High |
| Affected File | `server.ts:366`, `src/lib/securityValidation.ts:259`, `src/db/repository.ts:330` |
| Test Scenario | Authenticated standard citizen posts `{ packets: [{ messageId: "CEMN-SOS-9991", eventType: "SOS", rescueStage: "RESOLVED_WITH_EVIDENCE", identityTier: "OFFICIAL_AGENCY", deliveryStatus: "ACKNOWLEDGED", ... }] }` to `POST /api/cemn/sync`. |

#### How It Was Fixed
Every incoming packet in `/api/cemn/sync` now passes through `sanitizeCemnSyncPacket(rawPkt, req.user!.uid, authz.allowed)` before any database write. Standard citizen accounts cannot synchronize `EVACUATION_ORDER`, responder-only `RESTRICTED_RESCUE_STAGES`, or `VERIFIED_RESPONDER` / `OFFICIAL_AGENCY` identity tiers, and `syncCemnPacketsToDb` persists the sanitized `pkt.deliveryStatus` (`RECEIVED` for citizens) instead of forcing `ACKNOWLEDGED`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Sync payload enters `POST /api/cemn/sync` at `server.ts:366` (unauthenticated requests are rejected at `401` by `requireAuth`). | Auth verified, enters batch loop |
| 2 | Batch count check at `server.ts:380` enforces max 50 packets; `isAuthorizedResponder(req)` determines `authz.allowed === false` for citizen accounts (`server.ts:387`). | Role resolved server-side |
| 3 | `sanitizeCemnSyncPacket` at `src/lib/securityValidation.ts:289-307` detects `RESTRICTED_RESCUE_STAGES` / `OFFICIAL_AGENCY` when `isResponder === false` and returns `{ ok: false, unauthorized: true }`. | Packet rejected |
| 4 | At `server.ts:404-418`, since `safePackets.length === 0` and `rejectedUnauthorized > 0`, the endpoint returns HTTP `403` with `syncedCount: 0`. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Citizen accounts cannot forge official agency identity tiers, close rescue incidents, or inject evacuation orders during offline-to-cloud reconciliation.

---

### Unsafe SVG / Script Media Payloads on Report Submission & Media Rendering

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe Media & External URL Handling |
| Impact | High |
| Affected File | `server.ts:230`, `src/lib/securityValidation.ts:78-165`, `src/data/civicMedia.ts:14` |
| Test Scenario | Authenticated user submits `{ title: "Hazard", description: "Detail", latitude: 12.97, longitude: 77.59, mediaUrl: "data:image/svg+xml;base64,PHN2Zz4=" }` to `POST /api/reports`, or `/api/draft` receives `imageMimeType: "image/svg+xml"`. |

#### How It Was Fixed
`POST /api/reports` validates `payload.mediaUrl` with `validateReportMediaUrlInput` allowing only `http(s):` URLs or `image/jpeg`, `image/png`, `image/webp` base64 data URIs (`image/svg+xml` and `javascript:` are blocked). `POST /api/draft` and `POST /api/animate-video` validate uploaded base64 media against `ALLOWED_REPORT_IMAGE_MIMES`. On the frontend, `resolveReportMediaUrl`, `sanitizeExternalHref`, and `sanitizeSafeVideoDataUrl` validate rendered `src` and `href` bindings.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `POST /api/reports` receives the request at `server.ts:212`; `validateReportMediaUrlInput(payload.mediaUrl)` runs at `server.ts:230`. | Enters media URL validator |
| 2 | `src/lib/securityValidation.ts:148-154` checks `data:` URIs against `BASE64_IMAGE_DATA_URL_RE` (`jpeg|jpg|png|webp`), rejects `image/svg+xml`, and `server.ts:232` returns HTTP `400`. | Malicious SVG rejected before storage |
| 3 | For `/api/draft` (`server.ts:520`), `validateBase64Media` rejects `image/svg+xml` with HTTP `400` (`Unsupported media MIME type "image/svg+xml".` — verified live against running server). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Neither persistent civic reports nor AI image processing endpoints accept executable SVG, script URI schemes, or malformed external links.

---

### Cross-Site WebSocket Connection & Unbounded AI Streaming on `/ws/live`

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Origin WebSocket Upgrade & Missing Connection Limits |
| Impact | High |
| Affected File | `server.ts:950-1126`, `src/lib/securityValidation.ts:410` |
| Test Scenario | An untrusted website initiates a WebSocket handshake to `ws://127.0.0.1:3000/ws/live` with `Origin: https://evil.example`. |

#### How It Was Fixed
HTTP upgrade handling on `/ws/live` enforces `isSameOriginWebSocketRequest(request.headers.origin, request.headers.host, forwardedHost)` and immediately writes `HTTP/1.1 403 Forbidden` and destroys the socket on mismatched or missing origins. Valid same-origin upgrades are bounded by per-IP rate limiting (`liveWsRateLimiter`), `maxPayload: 256 * 1024`, a cap of 5 concurrent active sessions, frame payload slicing, and a 5-minute inactivity timeout.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Upgrade request with `Origin: https://evil.example` arrives at `server.on('upgrade')` (`server.ts:954`). | Matched `/ws/live` path |
| 2 | `isSameOriginWebSocketRequest` at `server.ts:964` compares parsed origin host against `Host` / `X-Forwarded-Host` and returns `false`. | Origin mismatch detected |
| 3 | `server.ts:970-972` writes `HTTP/1.1 403 Forbidden` and destroys the TCP socket without calling `handleUpgrade` or opening Gemini Live (verified live returning `403`). | **Handled Safely** |

#### Conclusion
**Fix Verified** - Third-party origins cannot hijack `/ws/live` WebSocket connections or trigger unauthenticated upstream Gemini Live sessions.
