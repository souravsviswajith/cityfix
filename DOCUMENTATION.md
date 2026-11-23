# CityFix Documentation

**See the problem. Report it. Reach the responsible authority.**

This is the documentation index for contributors, reviewers, testers, and project evaluators. It separates product behavior, implementation details, setup instructions, and planned architecture so that readers can distinguish verified functionality from design intent.

## Start here

| Audience | Read |
|---|---|
| New Android contributor | [Complete Android Setup, Build & Artifact Guide](docs/ANDROID_SETUP_AND_RELEASE_GUIDE.md) |
| New teammate / contributor | [Team Setup & Contributor Guide](docs/TEAM_SETUP_GUIDE.md) |
| Developer / architect | [Architecture Overview](docs/architecture/overview.md) |
| Contributor | [Contribution Workflow](docs/CONTRIBUTING.md) |
| QA / evaluator | [Feature & Workflow Reference](docs/architecture/workflows.md) |
| Security reviewer | [Security Implementation Baseline](docs/security/implementation-baseline.md) |

## Documentation map

```text
CityFix/
├── README.md
├── DOCUMENTATION.md
└── docs/
    ├── ANDROID_SETUP_AND_RELEASE_GUIDE.md # Android SDK → local build → CI artifact → release
    ├── TEAM_SETUP_GUIDE.md                # Windows-first contributor onboarding
    ├── CONTRIBUTING.md
    ├── architecture/
    │   ├── overview.md
    │   ├── workflows.md
    │   └── disaster-management-gps-cemn.md
    └── security/
        └── implementation-baseline.md
```

## Documentation conventions

- **Implemented** means the behavior exists in the repository and can be inspected or tested.
- **Partial** means only a subset of the intended behavior exists.
- **Planned** means design intent; it must not be presented as an operational feature.
- **Unavailable** means a required data source, provider, or integration is not configured or cannot be verified.
- Diagrams labelled **target** describe intended behavior, not current runtime behavior.
- Examples and screenshots must use synthetic data unless explicit consent and authorization exist.
- Debug APK artifacts are for development/testing. They are not production releases.
- Production signing and automated production release must be documented only after they are implemented and verified.

## Maintenance

Update documentation in the same pull request as a behavior or architecture change. Include the test evidence and explicitly record any new limitation. Do not silently convert a planned capability into a completed claim.
