# CityFix System Architecture

## 1. Purpose and scope

CityFix is an Android-first civic reporting and disaster-awareness platform. Its primary civic workflow helps a citizen document an issue, attach its geographic context, discover the public authorities relevant to that location and issue, verify the returned identity and jurisdiction records, and prepare an evidence-backed report.

The Disaster Management module is a distinct operational capability. It uses location services and the CityFix Emergency Mesh Network (CEMN) to support incident awareness and structured coordination when internet connectivity is degraded or unavailable.

**Product boundary:** CityFix supports reporting, information discovery, and coordination. It does not independently dispatch emergency services, guarantee government action or rescue, or claim that a complaint was officially registered unless a real external integration confirms that state.

## 2. Architectural principles

- **Android-first:** the native client is the target product; browser-based UI is a prototype/reference unless explicitly promoted to a supported client.
- **Offline-first capture:** issue and incident capture must remain usable when backend connectivity is unavailable; synchronization is deferred.
- **Evidence before escalation:** media, location, timestamp, and citizen-provided details form the report evidence package.
- **Live authority discovery:** public authority data is retrieved from attributable sources, not assumed to be a permanently correct static directory.
- **Verification before assertion:** identity, role, jurisdiction, and contact records carry provenance and verification status.
- **Human review:** citizens review and approve complaint content before sharing.
- **Fail closed:** missing providers, permissions, or verification evidence must produce explicit unavailable/unverified states, not fabricated success.
- **Separation of concerns:** UI, domain workflows, platform capabilities, persistence, external data providers, and transport implementations remain independently testable.
- **Least privilege and data minimization:** collect and disclose only what is necessary for the selected workflow.

## 3. Functional modules

### 3.1 Photo and evidence capture
- Capture a photo/video or select existing media with user permission.
- Associate media with a report draft and preserve capture metadata where available.
- Support preview, removal, and explicit inclusion before submission.
- Keep media references and upload state distinct from report submission state.

### 3.2 Geo-tagging and jurisdiction context
- Request location only when the workflow requires it.
- Attach latitude/longitude, accuracy, capture time, provider, and manual-adjustment state.
- Resolve coordinates against authoritative, versioned jurisdiction boundaries when configured.
- Distinguish fresh, stale, approximate, manually adjusted, denied, and unavailable location states.
- Never silently substitute default coordinates or infer a jurisdiction without evidence.

### 3.3 Authority identity discovery
Resolve the relevant public authority records for the issue and location. Keep two dimensions distinct:
- **Political representation:** elected representatives for the location.
- **Administrative responsibility:** department, office, or public official responsible for the issue category and jurisdiction.

A discovery result is a candidate record, not automatically a verified identity.

### 3.4 Verification and provenance
Verify each authority record against reliable attributable sources. Track canonical identity/name and designation, role validity where available, jurisdiction and issue/department responsibility, official contact information, source URL/identifier, retrieval/verification timestamp, and verification outcome with limitations.

If a record cannot be verified, label it unverified or unavailable and expose the source/limitation. Do not present inferred contact details as official.

### 3.5 Complaint preparation and citizen-controlled sharing
- Combine citizen-provided description, issue category, media references, location, and verified authority context.
- Generate a structured complaint draft where the AI provider is configured.
- Treat model output as a draft, not a factual authority source.
- Require citizen review and explicit approval before sharing or exporting.
- Track draft, approved, shared, and externally acknowledged states separately.
- Never equate a generated draft or an email handoff with official registration.

### 3.6 Disaster Management and CEMN
Disaster Management is separate from ordinary civic complaint submission. It includes SOS/incident capture, situational maps, official alerts, emergency resources, field coordination, and connectivity/delivery status.

CEMN is an Android-phone-to-Android-phone structured-message transport layer. BLE supports discovery and small payloads; Wi-Fi Direct or Wi-Fi Aware may provide higher-throughput peer links where supported. Application-level components implement durable queues, routing, store-and-forward, duplicate suppression, expiry, acknowledgements, authentication, and synchronization. Android radio APIs alone do not constitute a multi-hop mesh.

CEMN must not become a general-purpose chat or social messaging product. Relay only typed disaster-management records attached to incidents or authorized coordination workflows.

## 4. Logical architecture

| Layer | Responsibilities |
|---|---|
| Presentation | Jetpack Compose screens, navigation, accessibility, permission rationale, visible status |
| Feature workflows | Evidence capture, geo-tagging, authority discovery, verification, complaint preparation, disaster management |
| Domain | Use cases, validation, state transitions, policy rules, repository interfaces |
| Core platform | Location, media, local database, network state, security, mesh transport |
| Data | Local persistence, synchronization, report storage, audit/event records |
| Integrations | GIS/jurisdiction provider, official authority sources, AI drafting provider, external sharing channels |
| Backend | Existing Express/TypeScript API; intended modular-monolith organization for authenticated APIs, provider orchestration, server-side secrets, authorization, rate limits, audit and synchronization |

The Android application currently has a single app module with internal package boundaries. The current server implementation is Express/TypeScript; modular monolith describes its intended internal organization, not a separate service fleet. This table describes the target logical architecture; it is not a claim that every layer is already a separate Gradle module or that every provider is configured.

## 5. Primary civic-report workflow

1. Citizen starts a report and selects an issue category.
2. Evidence module captures or imports photo/video evidence with permission.
3. Geo-tagging module obtains or accepts a location and records accuracy, timestamp, and provenance.
4. Report draft is persisted locally so capture is not lost if connectivity drops.
5. Authority discovery uses issue category and location/jurisdiction to identify relevant political representatives and administrative authorities.
6. Verification checks identity, role, jurisdiction, and contact data against attributable sources.
7. Application presents verified, unverified, or unavailable results with source and freshness information.
8. Complaint preparation assembles evidence and relevant authority context into a draft.
9. Citizen reviews and edits the draft, then explicitly chooses whether to share/export it.
10. System records only the delivery/acknowledgement state that can actually be proven by the selected channel.

Authority lookup and verification are independent from media capture. If authority data is unavailable, the citizen's report evidence can still be retained as a draft; the system must not invent an authority to complete the flow.

## 6. Disaster-management workflow

1. Citizen or authorized participant creates a structured SOS/incident record.
2. Application attaches a location fix only when permission and device capability allow it; freshness and accuracy remain visible.
3. Record is stored locally and assigned a stable message/incident identifier.
4. If internet is available, the authorized backend synchronization path is used.
5. If internet is unavailable, CEMN discovers nearby compatible Android peers and relays eligible structured messages.
6. Each relay applies authentication/integrity checks, TTL, deduplication, and queue limits.
7. Delivery states progress only when supported by evidence: Queued → Relayed → Received → Acknowledged.
8. When internet returns, queued records synchronize idempotently; stale updates must not overwrite newer state.

A nearby device is not automatically a verified responder. Privileged responder actions require authenticated, authorized roles. Citizen reports, volunteer offers, verified responder acknowledgements, and official agency actions must remain distinct.

## 7. Data and trust boundaries

- **Citizen input:** issue descriptions, media, and citizen-reported incident details are untrusted input.
- **Device signals:** GPS, BLE, Wi-Fi, and connectivity state are device observations with accuracy/freshness limits.
- **External authority sources:** records retain source attribution, retrieval time, jurisdiction, and verification status.
- **AI output:** complaint text is assistive content requiring citizen review; it is not evidence of official facts or agency action.
- **Backend:** authenticates users, enforces authorization, protects secrets, validates payloads, applies quotas/rate limits, and records auditable state changes.
- **Mesh peers:** peer messages are untrusted until schema, origin/authenticity, integrity, expiry, and authorization checks pass.
- **External sharing channel:** a handoff or send attempt is not an official acknowledgement.

Do not expose API keys or service-account credentials in the APK or browser bundle. Precise location and media must be shared only through explicit, purpose-bound user actions or a clearly disclosed authorized emergency workflow.

## 8. Current implementation status

Status below reflects the repository documentation and implementation baseline; planned architecture is not proof of operational behavior.

| Capability | Current documented status |
|---|---|
| Native Android foundation | Kotlin/Jetpack Compose foundation exists |
| Local SOS capture | Implemented with local persistence |
| Location permission/capability inspection | Implemented in the Android foundation; freshness must be represented accurately |
| Photo/video evidence workflow | Product capability; verify implementation before claiming complete |
| Live authority discovery | Not configured; authority endpoint fails closed until authoritative sources are configured |
| Jurisdiction/GIS resolution | Not configured; unresolved jurisdiction is retained rather than guessed |
| Authority identity verification | Target workflow; live source integration remains incomplete |
| Complaint/report backend | Authenticated API baseline exists; production readiness and provider integration are not established |
| Gemini drafting | Server-side only when configured; output requires citizen review |
| BLE/Wi-Fi mesh discovery and relay | Not yet implemented/verified as an operational end-to-end capability |
| CEMN cryptographic packet verification | Not yet implemented/verified |
| Agency dispatch/acknowledgement | Not implemented; do not claim dispatch or official receipt |

Update this table whenever implementation changes. A build passing is not evidence that radio behavior, provider integration, authorization, or agency delivery works.

## 9. Suggested Android package boundaries

The following is a target decomposition, not a statement that these are all existing Gradle modules. The backend currently remains the Express/TypeScript server; the module names below are logical boundaries, not separately deployed services:

```text
:app
:feature:report
  :evidence
  :geotagging
  :authority-discovery
  :authority-verification
  :complaint
:feature:disaster
  :incident
  :sos
  :situational-map
  :alerts
  :emergency-resources
  :field-coordination
:core:domain
:core:database
:core:media
:core:location
:core:network
:core:security
:core:mesh
  :discovery
  :ble-transport
  :wifi-direct-transport
  :wifi-aware-transport
  :routing
  :message-queue
  :deduplication
  :acknowledgements
  :sync-gateway
:data
:integrations
  :gis-provider
  :authority-sources
  :ai-drafting
```

Feature modules depend on domain interfaces. Platform and provider implementations are injected behind those interfaces. Transport-specific and provider-specific details must not leak into UI code.

## 10. Related documentation
- [Architecture diagrams and flowcharts](DIAGRAMS.md)
- [Disaster Management, GPS, and CEMN architecture](architecture/disaster-management-gps-cemn.md)
- [Security and implementation baseline](security/implementation-baseline.md)
- [Project README](../README.md)
