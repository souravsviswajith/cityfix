# CityFix

**See the problem. Report it. Reach the responsible authority.**

CityFix is an Android-first civic reporting and disaster-awareness platform. It helps citizens document local problems, identify the public authority responsible for an issue, and prepare evidence-backed complaints. A separate disaster-management module supports location-aware emergency reporting and offline coordination when internet connectivity is unreliable or unavailable.

> **Product boundary:** CityFix helps citizens report and coordinate. It does not independently dispatch emergency services, guarantee government action, or confirm that a complaint has been officially registered.

## The problem

Reporting a civic issue often requires citizens to know which department, office, or public representative is responsible for a particular location and problem. That information can be fragmented, difficult to verify, or out of date. During emergencies, unreliable connectivity can make it harder to share incident information and coordinate locally.

CityFix aims to reduce these barriers through location-aware reporting, authority discovery, structured complaint preparation, and resilient emergency communication.

## Core capabilities

### 1. Civic issue reporting

- Capture or select photographs and videos documenting an issue.
- Attach geographic coordinates with the citizen's permission.
- Record the issue category, description, time, and supporting evidence.
- Keep the citizen in control of the report and its sharing.

### 2. Responsible authority discovery

CityFix distinguishes two questions:

- **Political representation:** Who represents this area?
- **Administrative responsibility:** Which department, office, or official is responsible for this issue?

Authority information is intended to be retrieved from live, attributable sources rather than treated as a permanently static directory. Each result should retain source provenance, retrieval time, jurisdiction, and verification status.

A name, designation, jurisdiction, or contact detail must not be presented as verified unless the underlying source supports it. If reliable official data is unavailable, CityFix should say so and provide the relevant official source or portal where possible.

### 3. Complaint preparation

- Generate a structured complaint or reporting draft from citizen-provided details.
- Include the issue description, location, evidence references, and relevant authority information.
- Allow the citizen to review and edit the draft before sharing.
- Support appropriate channels such as email or document export where available.

Draft generation is not the same as official submission. CityFix must not claim that a government system has received, registered, acknowledged, or resolved a complaint unless a real integration confirms that state.

### 4. Disaster management

Disaster management is a dedicated operational module—not a chat room or social feed. It brings together:

- Location-aware incident reporting and situational awareness.
- Clear separation of citizen-reported incidents and official alerts.
- Verified emergency contact information and reviewed safety guidance.
- Preparedness information and location-relevant guidance.
- Local incident coordination when internet access is degraded or unavailable.

Emergency numbers and safety instructions must be checked against current authoritative sources. CityFix does not replace emergency services, medical professionals, or official disaster-management agencies.

## CityFix Emergency Mesh Network (CEMN)

CEMN is the Android-phone-to-Android-phone communication layer supporting local disaster coordination when normal connectivity is disrupted.

**Transport scope**
- Bluetooth Low Energy (BLE) for nearby device discovery and suitable low-bandwidth exchanges.
- Wi-Fi Direct or Wi-Fi Aware for peer communication where the device supports it.
- Application-level routing and store-and-forward delivery across participating phones.
- Local persistence so messages can be retried or synchronized when connectivity returns.

BLE and Wi-Fi APIs provide communication links; they do not create a complete multi-hop mesh by themselves. CEMN must implement message identity, duplicate suppression, expiry (TTL), routing, delivery acknowledgements, and appropriate authentication and encryption.

**Platform constraints**
- Android devices only; no dedicated LoRa gateway or external mesh hardware is required.
- Wi-Fi Aware support varies by device and must be capability-checked.
- Android background-execution and battery restrictions can interrupt discovery or relay. Continuous availability cannot be guaranteed.
- Internet connectivity and mesh availability are separate states and must be displayed independently.

A message moving through the system should have an explicit delivery state, such as **Queued → Relayed → Received → Acknowledged**. Sending or relaying a message does not prove that a responder or emergency service received it.

## Trust, privacy, and safety principles

- Request location and media permissions only when needed and explain their use.
- Share precise location only through an explicit user action or an authorized emergency workflow.
- Keep citizen reports distinct from official agency alerts and verified responder updates.
- Do not allow an unverified device or user to claim official responder status, issue authoritative evacuation orders, or mark an incident resolved.
- Preserve source attribution and freshness metadata for authority records, alerts, and emergency guidance.
- Label synthetic, demonstration, stale, partial, or unverified data clearly.
- Minimize collection and retention of personal data and protect locally stored incident information.

## Intended Android architecture

The product target is a native Android application built with Kotlin and Jetpack Compose. The architecture is organized around feature modules and reusable core services.

```text
:app
:core:database
:core:location
:core:network
:core:security
:core:mesh
  :discovery
  :transport
  :routing
  :message-queue
  :synchronization
:feature:auth
:feature:media
:feature:authority
:feature:complaint
:feature:disaster
  :incident
  :sos
  :offline-map
  :rescue-coordination
```

The local data layer supports offline incident handling. A backend may provide account services, live authority-source connectors, and synchronization, but it must not be a prerequisite for local peer communication.

## Implementation status

This repository has evolved from an early interface prototype toward the Android product described above. The existing browser-based interface is a prototype/reference and is **not** the target production client. The native Android application, live authority integrations, and CEMN transport/routing must be treated as incomplete until implemented and verified.

Do not interpret prototype screens, sample records, peer counts, connection indicators, alert feeds, or delivery states as live operational data. A feature is complete only when its implementation and acceptance tests demonstrate the claimed behavior.

## Initial CEMN acceptance scenario

A minimum offline-relay test uses three Android phones:

1. Phone A creates an SOS incident.
2. Phone B receives and relays the message.
3. Phone C receives it while all three phones have internet disabled.
4. The UI reports the actual message state at each device.
5. Internet is restored and queued data synchronizes without creating duplicate incidents.

The test must also cover expired messages, duplicate delivery, unavailable permissions, unsupported transports, process termination, and reconnection.

## Development principles

- Android-only product scope.
- Offline-first behavior for incident capture and local coordination.
- Live, source-attributed authority data; no invented officials or contact details.
- Political representation and administrative responsibility remain distinct.
- Explicit verification and delivery states; no simulated operational claims.
- Citizen review before complaint sharing.
- Security, privacy, accessibility, and graceful degradation by design.

## Documentation

- [Disaster management, GPS, and CEMN architecture](docs/architecture/disaster-management-gps-cemn.md)

## Project

**CityFix**  
*See the problem. Report it. Reach the responsible authority.*

This project is being developed for the Tutedude Buildathon. Demonstrations must clearly distinguish implemented functionality from prototypes, simulations, and planned integrations.
