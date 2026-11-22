# CityFix Architecture Diagrams

These Mermaid diagrams describe the intended system workflows. They are architecture documentation, not proof that every component is implemented or deployed.

## 1. System context and component flow

```mermaid
flowchart TB
    Citizen([Citizen])
    UI[CityFix Android App<br/>Jetpack Compose]
    Report[Report Workflow]
    Evidence[Photo / Video Evidence]
    Geo[Geo-tagging & Location]
    Authority[Authority Discovery]
    Verify[Identity & Jurisdiction Verification]
    Complaint[Complaint Preparation]
    Disaster[Disaster Management]
    Mesh[CEMN<br/>Android peer transport]
    Local[(Local Database / Queue)]
    API[Authenticated Backend API]
    GIS[GIS / Jurisdiction Provider]
    Sources[Official Authority Sources]
    AI[Server-side AI Drafting]
    Channel[Citizen-selected Share / Export]

    Citizen --> UI
    UI --> Report
    UI --> Disaster
    Report --> Evidence
    Report --> Geo
    Report --> Authority
    Authority --> GIS
    Authority --> Sources
    GIS --> Verify
    Sources --> Verify
    Evidence --> Local
    Geo --> Local
    Verify --> Complaint
    Report --> Complaint
    Complaint --> AI
    AI --> Complaint
    Complaint --> UI
    UI -->|Citizen reviews and approves| Channel
    Report <--> Local
    Disaster <--> Local
    Disaster -->|Internet available| API
    Disaster -->|Internet unavailable| Mesh
    Mesh <--> Local
    Mesh -->|Connectivity restored| API
    API --> GIS
    API --> Sources
```

## 2. Civic issue reporting flow

```mermaid
flowchart TD
    Start([Citizen starts a report]) --> Category[Select issue category and describe issue]
    Category --> Media{Add photo or video?}
    Media -->|Yes| Capture[Capture or select evidence with permission]
    Media -->|No| Location
    Capture --> Location[Request or manually set issue location]
    Location --> LocationState{Location usable?}
    LocationState -->|Fresh / approximate / manual| Tag[Attach coordinates, accuracy, timestamp and provenance]
    LocationState -->|Denied / unavailable| NoLocation[Continue without location and disclose limitation]
    Tag --> Save
    NoLocation --> Save[Persist report draft locally]
    Save --> Authority[Discover relevant authorities using issue + location]
    Authority --> Source{Attributable source data available?}
    Source -->|No| Unavailable[Mark authority/jurisdiction unavailable or unresolved]
    Source -->|Yes| Verify[Verify identity, role, jurisdiction and contact]
    Verify --> Verified{Verification supported?}
    Verified -->|Yes| VerifiedResult[Present verified record with source and freshness]
    Verified -->|No| Unverified[Present as unverified; do not assert as authoritative]
    Unavailable --> Draft
    VerifiedResult --> Draft[Prepare structured complaint draft]
    Unverified --> Draft
    Draft --> Review[Citizen reviews and edits]
    Review --> Approve{Citizen approves sharing?}
    Approve -->|No| Keep[Keep as local draft]
    Approve -->|Yes| Share[Share or export through selected channel]
    Share --> Receipt{Verifiable channel receipt?}
    Receipt -->|Yes| State[Record the confirmed receipt state]
    Receipt -->|No| Attempt[Record only send/handoff attempt]
```

## 3. Authority discovery and verification

```mermaid
flowchart LR
    Input[Issue category + coordinates] --> Jurisdiction[Resolve jurisdiction using versioned GIS boundaries]
    Jurisdiction --> Political[Discover political representatives]
    Jurisdiction --> Admin[Discover administrative department / officials]
    Political --> Sources[Fetch attributable official source records]
    Admin --> Sources
    Sources --> Validate[Validate identity, role, jurisdiction and contact]
    Validate --> Provenance[Attach source URL, retrieval time and verification status]
    Provenance --> Decision{Evidence sufficient?}
    Decision -->|Yes| Verified[Verified authority record]
    Decision -->|No| Unverified[Unverified / partial / unavailable record]
    Verified --> Citizen[Present with provenance]
    Unverified --> Citizen
```

## 4. Disaster incident and CEMN delivery flow

```mermaid
flowchart TD
    Start([SOS / incident created]) --> Location[Attach permitted location + accuracy + timestamp]
    Location --> ID[Create stable incident/message ID]
    ID --> Persist[(Persist locally)]
    Persist --> Internet{Internet available?}
    Internet -->|Yes| Backend[Authenticated backend sync]
    Internet -->|No| Discover[Discover nearby compatible Android peers]
    Discover --> Transport{BLE / Wi-Fi peer transport available?}
    Transport -->|No| Queue[Keep queued; show unavailable state]
    Transport -->|Yes| Validate[Validate schema, origin, integrity and expiry]
    Validate --> Relay[Relay structured incident message]
    Relay --> Dedup[Suppress duplicate message IDs]
    Dedup --> Ack[Track actual receive / acknowledgement state]
    Ack --> Persist
    Backend --> Sync[Idempotent synchronization]
    Queue --> Reconnect{Peer or internet becomes available?}
    Reconnect -->|Peer| Discover
    Reconnect -->|Internet| Backend
    Ack --> Reconnect
    Sync --> End([Update UI with confirmed state only])
```

## 5. Trust and authorization boundaries

```mermaid
flowchart TB
    subgraph Client["Android device trust boundary"]
      UI[Citizen / responder UI]
      Input[Citizen input and media]
      Location[Device location and radio observations]
      Queue[Encrypted local persistence and queue]
    end
    subgraph Service["Backend trust boundary"]
      Auth[Authentication]
      RBAC[Role and resource authorization]
      Validate[Schema and policy validation]
      Audit[Audit events and state transitions]
      Provider[Server-side provider adapters]
    end
    subgraph External["External systems / untrusted inputs"]
      Authority[Official authority sources]
      GIS[GIS boundary data]
      AI[AI model provider]
      Peer[Nearby peer devices]
      Share[Email / export / external channel]
    end
    UI --> Input
    UI --> Location
    Input --> Queue
    Location --> Queue
    Queue -->|Authenticated sync| Auth
    Auth --> RBAC
    RBAC --> Validate
    Validate --> Audit
    Validate --> Provider
    Provider <--> Authority
    Provider <--> GIS
    Provider <--> AI
    Peer -->|Untrusted until validated| Queue
    UI -->|Citizen-approved handoff| Share
```

## 6. Delivery-state semantics

| State | Meaning | Must not be interpreted as |
|---|---|---|
| Draft | Stored as an editable report/incident draft | Submitted |
| Queued | Persisted locally and waiting for a transport | Sent or received |
| Relayed | Forwarded by a peer or transport hop | Delivered to the final recipient |
| Received | A target device/service confirmed receipt | Read or acted upon |
| Acknowledged | An authorized recipient returned a verifiable acknowledgement | Resolved |
| Resolved | An authorized workflow recorded resolution with evidence | Automatically true after acknowledgement |

The UI and backend must use explicit state transitions and retain timestamps/provenance. Never infer a later state from an earlier one.
