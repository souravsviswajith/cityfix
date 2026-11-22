# Security and implementation status

This document describes the security controls currently present in the application. It is not a claim of production certification.

## API access controls

- Firebase ID-token authentication is required for report reads and writes.
- Citizen report reads are scoped to the authenticated user's UID. Users with an administrator-assigned `responder` or `coordinator` database role can read the responder report feed.
- Report status transitions require an administrator-assigned responder or coordinator role.
- CEMN event and audit-log reads require an administrator-assigned responder or coordinator role.
- Responder privileges are not granted from an email address. Newly synchronized users receive the `citizen` role; elevated roles must be assigned through a trusted administrative database process.
- The authority directory and jurisdiction-resolution endpoints return HTTP 503 until authoritative government sources and versioned GIS boundaries are configured.
- New reports retain submitted coordinates but are marked with an unresolved jurisdiction and no assigned officials until authoritative GIS and directory integrations are available.

These controls do not replace a complete authorization review, audit logging, or deployment-level rate limiting.

## Gemini drafting and other AI endpoints

Gemini calls are server-side. Configure `GEMINI_API_KEY` in the deployment environment. Never ship the key in the Android APK or browser bundle.

AI-generated complaint drafts require citizen review. Model output must not be treated as government acknowledgement, dispatch, or resolution. The AI endpoints still require authenticated quotas, shared rate limiting, strict input validation, and abuse monitoring before production exposure.

## Network and input controls

- Express JSON body size is currently limited by the server configuration.
- The Live API WebSocket bridge must not be treated as an authenticated user session.
- Production deployments must use HTTPS/WSS, origin controls, shared rate limits, and appropriate API gateway protections.
- Never expose service-account credentials or server-side API keys to clients.

## Android location

A cached location fix is not equivalent to a fresh GPS acquisition. The UI must communicate location age and accuracy and must not imply a live GPS lock unless the device has obtained a current fix.

## Not yet implemented or not yet verified

This repository does not establish production readiness for:
- OTP request and verification with a real SMS/WhatsApp provider.
- Live government authority data and authoritative, versioned GIS boundaries.
- Public SOS broadcasting, BLE/Wi-Fi mesh relay, cryptographic packet-signature verification, or responder identity verification.
- Government agency dispatch, official acknowledgement, or incident resolution.
- Production-grade AI quotas, rate limiting, and abuse controls.

These capabilities require dedicated implementations, security reviews, and integration tests. A successful TypeScript check or build does not prove these controls or physical-device BLE/Wi-Fi behavior.

## Validation

The project scripts currently provide TypeScript validation and a Vite production build. These checks are not substitutes for unit, integration, authorization, or end-to-end security tests.
