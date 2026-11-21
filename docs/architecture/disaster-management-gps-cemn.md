# CityFix Disaster Management, GPS & CEMN Architecture

## 1. Product intent

GPS and mesh communication are supporting infrastructure for CityFix's **Disaster Management module**. Their purpose is to improve emergency situational awareness and field coordination when cellular or internet connectivity is degraded or unavailable.

**CEMN (CityFix Emergency Mesh Network) is not a chat room, social network, anonymous messaging system, or general-purpose peer messenger.** Do not build public chat rooms, unrestricted peer-to-peer conversations, social feeds, presence lists, or arbitrary user messaging. The user-facing experience remains a disaster-management interface: incident map, SOS reporting, hazard and official-alert information, emergency resources, and operational coordination.

The current scope is **Android phones communicating with Android phones**. It excludes LoRa gateways, dedicated mesh radios, and other external mesh hardware.

## 2. GPS and location services

Location services provide the spatial context required by disaster workflows:

- Capture incident coordinates and reported location.
- Display the user's current location when permission is granted.
- Map citizen-reported incidents and verified official alerts.
- Locate mapped emergency resources such as hospitals, shelters, and designated safe areas when authoritative data is available.
- Support location-aware field coordination when participants explicitly enable location sharing.
- Support offline maps using previously downloaded or cached map data.

A location record should include latitude/longitude, horizontal accuracy in metres, capture timestamp, provider/source, and whether the location was manually adjusted.

Do not silently substitute default coordinates when GPS is unavailable. Distinguish current, stale, approximate, manually adjusted, permission-denied, and unavailable location states. Share precise location only for an explicit emergency action, with clear disclosure of recipients and purpose. Continuous background tracking is not the default.

**GPS provides positioning, not communication.** Location availability and network/mesh availability must be represented as separate states.

## 3. Android-only communication transports

CEMN uses supported Android device radios without external hardware:

- **Bluetooth Low Energy (BLE):** discovery and small, low-bandwidth emergency messages over short range.
- **Wi-Fi Direct:** peer-to-peer data transfer where supported by the device and Android version.
- **Wi-Fi Aware (Neighbor Awareness Networking):** optional peer discovery/data path only when device capability and runtime conditions permit it.

Transport selection must be capability-driven. Do not assume every Android device supports Wi-Fi Aware or that BLE provides high-bandwidth transfer. Provide fallbacks and report unavailable capabilities accurately.

These Android APIs provide peer links; they do not automatically create a resilient multi-hop mesh. Multi-hop behavior must be implemented at the application layer.

## 4. Application-level store-and-forward

The mesh layer relays only structured disaster-related messages required by the Disaster Management module:

- SOS and incident reports.
- Incident status changes.
- Safety-critical operational updates.
- Verified responder acknowledgements and coordination records.
- Official alerts, retaining original source and authenticity metadata.

Each message should include a stable unique ID, message type, creation time, expiry/TTL, origin metadata, payload schema version, integrity/authentication metadata, and delivery state.

Implement:
- Durable local queueing.
- Store-and-forward relay when a peer becomes reachable.
- Duplicate suppression by stable message ID.
- TTL/expiry enforcement and bounded relay/storage policies.
- Acknowledgement tracking.
- Authentication, integrity protection, and encryption in transit and at rest as appropriate.
- Idempotent backend synchronization when internet connectivity returns.

The UI must distinguish **Queued → Relayed → Received → Acknowledged**. These states are not interchangeable. A successful local broadcast does not prove delivery to a responder, emergency service, or government agency.

## 5. Disaster-management experience

The primary interface is an operational disaster-management experience, not a messaging interface. Organize it around:

1. **Situational map:** user location, incident markers, affected areas, verified shelters/hospitals, and official hazard information.
2. **SOS and incident reporting:** incident category, location, timestamp, optional photo/video, and explicit submit action.
3. **Alerts and safety information:** official alerts clearly separated from citizen-reported incidents; show source, issue time, validity period, and freshness.
4. **Connectivity and delivery status:** internet, GPS, BLE discovery, Wi-Fi peer transport, active relay capability, and message delivery state shown as separate signals.
5. **Field coordination:** incident updates, assignment/acknowledgement records, and status transitions for authorized participants.

Do not surface generic chat rooms, open-ended direct messaging, or social features. Any operational note must be attached to a specific incident or coordination record, use a defined schema and authorization policy, and must not become a general conversation channel.

## 6. Trust, roles, and incident state

A nearby device is not automatically a verified responder. Keep these concepts distinct:

- Citizen-submitted incident.
- Volunteer or community assistance offer.
- Verified responder acknowledgement.
- Official agency assignment.
- Response operation in progress.
- Incident resolved, with supporting evidence where available.

Only authenticated and appropriately authorized roles may perform privileged responder or agency actions. An unverified peer must not claim official responder status, close an incident, or issue an authoritative evacuation order. Citizen-generated alerts must never be presented as official government alerts.

CityFix provides reporting, information, and coordination support. It does **not** independently dispatch emergency services, guarantee rescue, or represent that a government agency has received an incident unless a verifiable acknowledgement exists.

## 7. Connectivity and runtime truthfulness

Represent connectivity as independent dimensions:

| Dimension | Example states |
|---|---|
| Internet | Connected / degraded / unavailable |
| GPS | Available / approximate / stale / permission denied / unavailable |
| BLE | Supported / permission denied / scanning or advertising active / unavailable |
| Wi-Fi peer transport | Supported / available / connected / unavailable |
| Mesh routing | Inactive / discovering / peer connected / relaying / queued messages / degraded |

Do not display static or fabricated peer counts, link quality, map cache sizes, delivery confirmations, encryption claims, or responder activity. Every displayed metric must come from actual runtime telemetry. Show the timestamp of the last successful location fix and relevant freshness indicators.

Android background execution, battery optimization, permission changes, radio availability, and process termination can interrupt discovery or relay. Do not promise continuous background mesh coverage. For an active emergency session, use Android-compliant foreground execution and clearly explain required notification/permissions. WorkManager may handle deferred backend synchronization; it is not a real-time mesh transport.

## 8. Suggested Android module structure

```text
:feature:disaster
    :incident
    :sos
    :situational-map
    :emergency-resources
    :alerts
    :field-coordination

:core:location
    :gps-provider
    :location-permissions
    :location-freshness

:core:mesh
    :discovery
    :ble-transport
    :wifi-direct-transport
    :wifi-aware-transport
    :routing
    :message-queue
    :deduplication
    :acknowledgements
    :security
    :sync-gateway

:core:database
:core:network
:core:security
```

The Disaster Management feature consumes location and mesh APIs through domain interfaces. Transport-specific implementation details must not leak into the UI layer.

## 9. Minimum acceptance tests

### Three-device offline relay test

1. Prepare three Android phones with required permissions and compatible transport capabilities.
2. Disable internet connectivity on all three devices.
3. Phone A creates a structured SOS incident with a location fix.
4. Phone B receives and relays the incident to Phone C using the application-level relay path.
5. Verify the same message ID is preserved and duplicate copies are suppressed.
6. Verify each device reports only the delivery state it can actually prove.
7. Restore internet connectivity and synchronize queued records with the backend.
8. Verify idempotency: synchronization must not create duplicate incidents or overwrite newer state with stale data.

Also test permission denial, GPS unavailable/stale, unsupported Wi-Fi Aware, BLE-only fallback, radio interruption, process death, battery restrictions, expired messages, malformed payloads, unauthorized actions, and reconnect/retry behavior.

## 10. Explicit non-goals

- No hacker-themed interface or terminology.
- No anonymous/public chat rooms or general-purpose messaging.
- No social feed, follower graph, or user presence product.
- No LoRa, external mesh gateway, or dedicated radio hardware in this Android-only scope.
- No claim of guaranteed multi-hop coverage or uninterrupted background operation.
- No fabricated responder identities, peer telemetry, delivery receipts, official alerts, or rescue outcomes.
- No automatic emergency-service dispatch claim.

**Design rule:** GPS establishes *where* an incident or resource is. CEMN helps structured emergency information move between nearby Android devices when infrastructure is unavailable. The Disaster Management module turns that location and communication capability into situational awareness and accountable coordination.
