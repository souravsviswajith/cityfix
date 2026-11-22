# Security and implementation status

This document records the fail-closed baseline introduced on the security remediation branch.

## Current API behavior

The following endpoints deliberately return HTTP 503 until their required infrastructure exists:

| Capability | Required before enabling |
|---|---|
| OTP request and verification | Real SMS/WhatsApp provider, persistent challenge store, secure OTP generation, attempt limits, expiry, and signed sessions |
| Authority directory | Live attributable government sources and source-level verification |
| Jurisdiction resolution | Validated coordinates and authoritative, versioned GIS boundaries |
| Report reads/writes | Durable database, authentication, ownership checks, input validation, and audit events |
| Report status transitions | Verified responder/agency roles, explicit transition policy, and immutable audit history |

A 503 is intentional. It prevents prototype behavior from being mistaken for a working secure service.

## Gemini drafting

Gemini drafting is server-side only. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` in the deployment environment. Never ship the key in the Android APK or browser bundle.

The endpoint accepts a bounded title and citizen description. It does not accept authority records, citizen identity claims, coordinates, or client-supplied severity as trusted facts. The model is instructed not to invent officials, contact details, response deadlines, or government submission states. Generated drafts require citizen review.

The in-process rate limiter is only a development safeguard. Production deployments must enforce shared rate limits at an API gateway or WAF and add authenticated quotas.

## Network and input controls

- Express JSON body size is limited to 256 KB.
- The Express identifying header is disabled.
- Responses set `nosniff`, `no-referrer`, and `no-store`.
- The server binds to loopback by default; set `HOST` explicitly when deploying behind a controlled reverse proxy.
- Vite development host access is restricted to loopback and explicitly configured `VITE_ALLOWED_HOSTS`.

## Android location

The Android location provider only accepts a last-known fix no older than two minutes and rejects invalid coordinates. This is not a fresh GPS acquisition guarantee. The UI must describe it as a recent cached location fix, not a live GPS lock.

## Not yet implemented

This baseline does not claim to deliver production authentication, persistence, live authority data, authoritative jurisdiction lookup, public SOS broadcasting, BLE/Wi-Fi mesh relay, responder verification, agency dispatch, or emergency-service acknowledgement.

Those capabilities require their own implementations, security reviews, and integration tests. Until then, dependent API routes remain disabled.

## Validation

CI runs TypeScript validation, the Vite production build, and Android debug assembly. A successful build does not constitute a security audit or prove physical-device BLE/Wi-Fi behavior.
