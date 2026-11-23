# CityFix Documentation

**See the problem. Report it. Reach the responsible authority.**

This index is the entry point for contributors, developers, testers, reviewers, and project evaluators. The repository README is the concise product and implementation overview; the documents below provide deeper operational detail.

## Start here

| Audience | Read |
|---|---|
| First-time reader / evaluator | [Project README](README.md) |
| New teammate | [Team Setup Guide](docs/TEAM_SETUP_GUIDE.md) |
| Developer / architect | [System Architecture](docs/ARCHITECTURE.md), then [Architecture Overview](docs/architecture/overview.md) |
| Contributor | [Contribution Workflow](docs/CONTRIBUTING.md) |
| QA / evaluator | [Feature and Workflow Reference](docs/architecture/workflows.md) |
| Disaster-management / CEMN work | [Disaster Management, GPS and CEMN](docs/architecture/disaster-management-gps-cemn.md) |
| Security reviewer | [Security Implementation Baseline](docs/security/implementation-baseline.md) and [Security Policy](SECURITY.md) |

## Documentation map

```text
CityFix/
├── README.md                         # Product overview, current status and release options
├── DOCUMENTATION.md                  # This documentation index
├── SECURITY.md                       # Vulnerability reporting policy
├── android/                          # Native Android application foundation
├── .github/workflows/                # CI and build workflows
└── docs/
    ├── ARCHITECTURE.md                # Canonical detailed architecture and status
    ├── DIAGRAMS.md                    # Consolidated system and workflow diagrams
    ├── CONTRIBUTING.md                # Branch, commit, PR and review workflow
    ├── TEAM_SETUP_GUIDE.md            # Windows-first onboarding and setup
    ├── architecture/
    │   ├── overview.md                # Architecture summary and current implementation boundaries
    │   ├── workflows.md               # Civic report, SOS and CEMN workflows
    │   └── disaster-management-gps-cemn.md
    └── security/
        └── implementation-baseline.md # Current controls, limitations and hardening gaps
```

## Source-of-truth and conflict-resolution rules

To avoid contradictory claims, use this precedence:

1. **Code and executable configuration** establish what is currently implemented and how it is built.
2. **Security implementation baseline** records current security controls and known gaps.
3. **System Architecture** is the canonical detailed description of intended boundaries and current capability status.
4. **Architecture Overview, Workflow Reference, Disaster/CEMN document and DIAGRAMS** provide focused views; they must agree with the canonical architecture.
5. **README** is the public-facing summary and must not claim more than the implementation and status records support.

When a document conflicts with code, correct the document or explicitly record an implementation gap. Do not make code behavior appear complete by changing wording alone.

## Status vocabulary

- **Implemented:** behavior exists in the repository and has suitable test or inspection evidence.
- **Partial:** only part of the intended behavior exists.
- **Planned:** design intent; not an operational feature.
- **Unavailable:** a required provider, source, permission, or integration is not configured or cannot be verified.
- **Not verified:** implementation may exist, but the relevant acceptance test has not demonstrated the behavior.

A successful compile or CI build is not proof of hardware radio behavior, authoritative government data, emergency agency delivery, or production security.

## Backend and client terminology

- The primary product client is the native Android application in `android/`.
- The React/TypeScript browser application is a prototype/reference surface, not a supported CityFix web client.
- The current server implementation is Express/TypeScript. Its target deployment organization is a modular monolith; Ktor is not the current backend implementation.
- CEMN is an application-level Android peer communication design. BLE/Wi-Fi capability checks alone are not mesh discovery, routing, or message delivery.

## Artifact and release terminology

- A **CI artifact** is a build output retained by a workflow run for inspection/testing; it is not automatically a public release.
- A **GitHub Release asset** is a versioned file attached to a tagged GitHub Release, for example a validated Android APK.
- A **production distribution** requires signing, release validation, provenance, and a deliberate distribution channel. A debug APK is not a production release.
- Artifact upload and GitHub Release publication are optional distribution paths; do not imply they are configured until a workflow and release have been verified.

See the [README release options](README.md#build-artifacts-and-release-options).

## Maintenance

Update documentation in the same pull request as a behavior or architecture change. Keep implementation status, diagrams, setup commands, and release instructions synchronized. Include actual test evidence and limitations. Do not silently convert a planned capability into a completed claim.
