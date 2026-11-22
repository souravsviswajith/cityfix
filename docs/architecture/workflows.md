# CityFix — Feature and Workflow Reference

This document separates currently implemented workflows from intended workflows. Mermaid diagrams are included as editable source and render on supported GitHub Markdown surfaces.

## 1. Civic report lifecycle

### Target workflow

```mermaid
flowchart TD
    A[Citizen opens report form]
    B[Capture photo or video]
    C[Request location permission]
    D[Attach available coordinates]
    E[Citizen selects category and describes issue]
    F[Backend or local rules validate input]
    G[Retrieve attributable authority information]
    H{Authority and jurisdiction verified?}
    I[Show verified source, timestamp and scope]
    J[Show unavailable or partial verification]
    K[Generate complaint draft]
    L[Citizen reviews and edits draft]
    M{Citizen approves sharing?}
    N[Export or share through supported channel]
    O[Keep draft local / do not submit]
    P[Track only confirmed external status]

    A --> B --> C --> D --> E --> F --> G --> H
    H -- Yes --> I --> K
    H -- No --> J --> K
    K --> L --> M
    M -- Yes --> N --> P
    M -- No --> O
```

### Current boundary

This is the product workflow target. The current repository does not establish a verified government ERP submission or acknowledgement integration. A generated draft or exported document is not proof of official submission.

## 2. Current Android SOS local-capture workflow

```mermaid
flowchart TD
    A[Citizen opens Android app]
    B[Compose renders SOS screen]
    C[Citizen selects Create SOS]
    D[Citizen selects category and enters description]
    E{Location permission available?}
    F[Read recent cached location if available]
    G[Continue without coordinates]
    H[Create incident record]
    I[(Room local database)]
    J[Display incident in local history]
    K[App restarts]
    L[Reload incidents from Room]

    A --> B --> C --> D --> E
    E -- Yes --> F --> H
    E -- No --> G --> H
    H --> I --> J --> K --> L
```

**What this proves:** local incident persistence on the device.

**What this does not prove:** network delivery, BLE broadcast, peer discovery, multi-hop relay, responder receipt, emergency dispatch, or agency acknowledgement.

## 3. Intended CEMN offline relay workflow

<badge>Target architecture — not yet end-to-end implemented</badge>

```mermaid
flowchart TD
    A[Phone A creates SOS]
    B[Validate payload and assign message ID]
    C[Persist encrypted packet in local queue]
    D[Discover nearby participating devices]
    E{Transport available?}
    F[BLE discovery / low-bandwidth exchange]
    G[Wi-Fi Direct or Wi-Fi Aware session]
    H[Transfer packet]
    I[Phone B authenticates sender and validates integrity]
    J{Duplicate or expired?}
    K[Reject packet]
    L[Persist accepted packet]
    M[Relay to eligible peer]
    N[Phone C receives packet]
    O[Record confirmed receipt event]
    P{Internet restored?}
    Q[Queue server synchronization]
    R[Server authenticates and deduplicates]
    S[Persist accepted event]
    T[Return server sync acknowledgement]

    A --> B --> C --> D --> E
    E -- BLE --> F --> H
    E -- Wi-Fi --> G --> H
    H --> I --> J
    J -- Yes --> K
    J -- No --> L --> M --> N --> O --> P
    P -- No --> D
    P -- Yes --> Q --> R --> S --> T
```

### Protocol requirements

- Globally unique message identifier.
- Sender/device identity bound to a cryptographic key.
- Message integrity verification and authenticated origin.
- Encryption for sensitive content and coordinates.
- Expiry / time-to-live (TTL).
- Duplicate suppression and replay protection.
- Durable local queue and bounded retry/backoff.
- Delivery acknowledgements tied to actual receiver events.
- Server-side authorization before trusted status changes.
- Data minimization and retention limits.
- Android background-execution and battery constraints.

BLE and Wi-Fi provide transport capabilities. They do not supply application-level multi-hop routing, store-and-forward, trust, deduplication, or acknowledgements automatically.

## 4. Delivery state machine

```mermaid
stateDiagram-v2
    [*] --> Queued
    Queued --> Relayed: peer confirms forwarding
    Queued --> Received: destination directly confirms receipt
    Relayed --> Received: destination confirms receipt
    Received --> Acknowledged: authorized recipient acknowledges
    Acknowledged --> ResponseInProgress: authorized responder starts work
    ResponseInProgress --> Resolved: authorized workflow records resolution
```

| State | Exact meaning |
|---|---|
| Queued | Persisted locally and waiting for an attempt |
| Relayed | A participating peer confirmed forwarding |
| Received | Destination confirmed packet receipt |
| Acknowledged | Authorized recipient explicitly acknowledged |
| Response in progress | Authorized responder recorded work started |
| Resolved | Authorized workflow recorded resolution with evidence |

A relay is not receipt. Receipt is not acknowledgement. Acknowledgement is not dispatch. Resolution must not be inferred from inactivity or an AI-generated statement.

## 5. Data trust and source status

```mermaid
flowchart TD
    A[Request authority or jurisdiction]
    B[Select configured authoritative source]
    C[Fetch source record and metadata]
    D[Validate source identity and jurisdiction]
    E[Record retrieval time and provenance]
    F{Evidence sufficient and current?}
    G[Return verified result with source]
    H[Return partial or unavailable status]
    I[Do not invent a substitute record]

    A --> B --> C --> D --> E --> F
    F -- Yes --> G
    F -- No --> H --> I
```

A cached result is not automatically current or authoritative. Preserve source, retrieval time, geographic scope, and verification status.

## 6. Acceptance tests

### Local incident persistence

1. Install the Android app on a supported device.
2. Create a clearly labelled synthetic SOS.
3. Save it locally.
4. Force-stop and reopen the app.
5. Verify the incident remains visible.
6. Repeat with location permission denied.
7. Verify the app can save without coordinates and does not fabricate a location.

### CEMN three-device acceptance scenario — future

1. Use three physical Android phones A, B, and C.
2. Disable internet on all three.
3. Create an SOS on A.
4. Verify B receives and relays it.
5. Verify C receives it through B.
6. Replay the same packet and verify deduplication.
7. Submit an expired packet and verify rejection.
8. Restore internet and synchronize queued data.
9. Verify server deduplication and truthful acknowledgement states.

Do not mark CEMN operational until this scenario and relevant negative tests pass on physical devices.
