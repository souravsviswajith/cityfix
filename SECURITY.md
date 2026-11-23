# CityFix Security Policy

CityFix handles sensitive civic reports, location data, media evidence, identity information, and emergency incident records. Security reports must be handled privately and must not expose affected users or operational details.

## Supported versions

CityFix has not declared a production release or a formal long-term support policy. Until versioned releases are published, security fixes are applied to the maintained default branch (`main`). Do not interpret prototype or debug builds as supported production releases.

| Release channel | Security support |
|---|---|
| Default branch (`main`) | Maintained development line; fixes are applied as appropriate |
| Tagged GitHub Releases | Support status will be stated in each release |
| Unreleased branches / local builds | No support commitment |

## Reporting a vulnerability

**Do not report exploitable vulnerabilities in public GitHub issues, discussions, social posts, or pull requests.**

Use GitHub's private vulnerability reporting / security advisory feature for this repository if it is enabled. If private reporting is unavailable, contact the repository maintainer privately through a verified channel associated with the repository. Do not include secrets or real citizen data in the report.

Include, where safe:
- A concise description and affected component.
- Reproduction steps or a minimal proof of concept.
- Impact and realistic attack prerequisites.
- Affected commit, release, device/Android version, or deployment configuration.
- Suggested mitigation, if known.

Do not access, modify, or disclose another person's data while validating a suspected issue. Stop testing if further exploitation could affect real users or services.

## Response expectations

The maintainer will review the report, attempt to reproduce it safely, assess severity and affected versions, and coordinate a fix or mitigation. A response timeline is not guaranteed until a formal security response SLA is published. Do not publicly disclose details before coordinated resolution.

## Security-sensitive areas

Please pay particular attention to:
- Authentication, authorization, responder role assignment, and report ownership.
- Location, media, and personal-data exposure.
- Authority source integrity and jurisdiction resolution.
- SOS authenticity, replay/deduplication, CEMN transport, and delivery-state forgery.
- AI prompt injection, data disclosure, and unsupported claims.
- Build/release signing, credentials, dependency integrity, and artifact provenance.

See [the implementation baseline](docs/security/implementation-baseline.md) for current controls and known gaps.
