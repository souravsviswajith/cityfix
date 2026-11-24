import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_AUDIO_MIMES,
  ALLOWED_REPORT_IMAGE_MIMES,
  SlidingWindowRateLimiter,
  isSameOriginWebSocketRequest,
  sanitizeCemnSyncPacket,
  sanitizeExternalHref,
  sanitizeSafeMediaUrl,
  sanitizeSafeVideoDataUrl,
  validateBase64Media,
  validateEvidenceHash,
  validateReportMediaUrlInput,
} from './securityValidation';

test('sanitizeExternalHref blocks javascript, data, and credentials URLs', () => {
  assert.equal(sanitizeExternalHref('javascript:alert(1)'), undefined);
  assert.equal(sanitizeExternalHref('JAVASCRIPT:alert(1)'), undefined);
  assert.equal(sanitizeExternalHref('data:text/html,<script>alert(1)</script>'), undefined);
  assert.equal(sanitizeExternalHref('https://user:pass@example.com'), undefined);
  assert.equal(
    sanitizeExternalHref('https://docs.google.com/document/d/abc123/edit'),
    'https://docs.google.com/document/d/abc123/edit'
  );
  assert.equal(sanitizeExternalHref('http://localhost:3000/test'), 'http://localhost:3000/test');
});

test('validateReportMediaUrlInput blocks XSS/SVG payloads and allows safe images', () => {
  const xss = validateReportMediaUrlInput('javascript:alert(document.cookie)');
  assert.equal(xss.valid, false);

  const svg = validateReportMediaUrlInput('data:image/svg+xml;base64,PHN2Zz4=');
  assert.equal(svg.valid, false);

  const html = validateReportMediaUrlInput('data:text/html;base64,PHNjcmlwdD4=');
  assert.equal(html.valid, false);

  const validPng = validateReportMediaUrlInput('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(validPng.valid, true);
  assert.equal(validPng.value, 'data:image/png;base64,iVBORw0KGgo=');

  const ephemeralBlob = validateReportMediaUrlInput('blob:http://localhost:3000/123');
  assert.equal(ephemeralBlob.valid, true);
  assert.equal(ephemeralBlob.value, undefined);

  assert.equal(sanitizeSafeMediaUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeSafeMediaUrl('data:image/svg+xml;base64,PHN2Zz4='), undefined);
  assert.equal(sanitizeSafeMediaUrl('/assets/pothole.jpg'), '/assets/pothole.jpg');
  assert.equal(sanitizeSafeVideoDataUrl('data:video/mp4;base64,AAAA'), 'data:video/mp4;base64,AAAA');
  assert.equal(sanitizeSafeVideoDataUrl('javascript:alert(1)'), undefined);
});

test('validateEvidenceHash accepts only 64-char SHA-256 hex strings', () => {
  const valid = 'a'.repeat(64);
  assert.equal(validateEvidenceHash(valid), valid);
  assert.equal(validateEvidenceHash('short-hash'), undefined);
  assert.equal(validateEvidenceHash('z'.repeat(64)), undefined);
});

test('validateBase64Media enforces MIME allowlists and size caps', () => {
  const svgCheck = validateBase64Media('PHN2Zz4=', 'image/svg+xml', ALLOWED_REPORT_IMAGE_MIMES, 1000);
  assert.equal(svgCheck.ok, false);

  const okAudio = validateBase64Media('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibQ==', 'audio/webm;codecs=opus', ALLOWED_AUDIO_MIMES, 1000);
  assert.equal(okAudio.ok, true);
  if (okAudio.ok) {
    assert.equal(okAudio.mimeType, 'audio/webm');
  }
});

test('sanitizeCemnSyncPacket blocks privilege escalation by citizen users', () => {
  const basePacket = {
    messageId: 'CEMN-SOS-1234',
    eventType: 'SOS',
    title: 'Flooded junction',
    summary: 'Water rising rapidly.',
    wardId: 'ward-04',
    latitude: 12.95,
    longitude: 77.61,
    coordSource: 'GPS',
    coordAccuracyM: 8,
    severity: 'Critical',
    identityTier: 'VERIFIED_CITIZEN',
    authorLabel: 'Citizen A',
    rescueStage: 'CITIZEN_REPORTED',
    hopCount: 1,
    relayPath: ['AND-BLE-104'],
    transportMode: 'BLE',
    payload: { peopleAffected: 2 },
    ttlExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  // Unprivileged user trying to spoof rescueStage = RESOLVED_WITH_EVIDENCE
  const forgedStage = sanitizeCemnSyncPacket(
    { ...basePacket, rescueStage: 'RESOLVED_WITH_EVIDENCE' },
    'uid-citizen-1',
    false
  );
  assert.equal(forgedStage.ok, false);

  // Unprivileged user trying to spoof identityTier = OFFICIAL_AGENCY
  const forgedTier = sanitizeCemnSyncPacket(
    { ...basePacket, identityTier: 'OFFICIAL_AGENCY' },
    'uid-citizen-1',
    false
  );
  assert.equal(forgedTier.ok, false);

  // Unprivileged user trying to sync EVACUATION_ORDER
  const forgedEvac = sanitizeCemnSyncPacket(
    { ...basePacket, eventType: 'EVACUATION_ORDER' },
    'uid-citizen-1',
    false
  );
  assert.equal(forgedEvac.ok, false);

  // Legitimate citizen packet gets deliveryStatus = RECEIVED (never forged ACKNOWLEDGED)
  const validCitizen = sanitizeCemnSyncPacket(
    { ...basePacket, deliveryStatus: 'ACKNOWLEDGED' },
    'uid-citizen-1',
    false
  );
  assert.equal(validCitizen.ok, true);
  if (validCitizen.ok) {
    assert.equal(validCitizen.packet.deliveryStatus, 'RECEIVED');
    assert.equal(validCitizen.packet.authorUid, 'uid-citizen-1');
  }

  // Invalid date rejected safely instead of throwing on Date serialization
  const badDate = sanitizeCemnSyncPacket(
    { ...basePacket, ttlExpiresAt: 'not-a-date' },
    'uid-citizen-1',
    false
  );
  assert.equal(badDate.ok, false);
});

test('isSameOriginWebSocketRequest enforces same-origin on WS upgrades', () => {
  assert.equal(isSameOriginWebSocketRequest(undefined, 'localhost:3000', undefined), false);
  assert.equal(isSameOriginWebSocketRequest('https://evil.example', 'localhost:3000', undefined), false);
  assert.equal(isSameOriginWebSocketRequest('http://localhost:3000', '127.0.0.1:3000', undefined), true);
  assert.equal(
    isSameOriginWebSocketRequest('https://app.run.app', '127.0.0.1:3000', 'app.run.app'),
    true
  );
});

test('SlidingWindowRateLimiter enforces window bounds and resets after expiry', () => {
  const limiter = new SlidingWindowRateLimiter(2, 1000);
  assert.equal(limiter.consume('ip:1', 100).allowed, true);
  assert.equal(limiter.consume('ip:1', 200).allowed, true);
  const blocked = limiter.consume('ip:1', 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limiter.consume('ip:1', 1200).allowed, true);
});
