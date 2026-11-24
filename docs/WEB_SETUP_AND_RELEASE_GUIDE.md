# CityFix Web Build and Release Guide

CityFix is an open-source community project with a React/Vite web client and a native Kotlin/Jetpack Compose Android client. The web build is a frontend artifact, not a replacement for the Express API/backend.

## Local development

Requirements: Node.js 22, pnpm 10.10.0, and Git.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run dev
```

`VITE_ALLOWED_HOSTS` is a comma-separated allowlist for additional Vite development hostnames. It is not a credential. Keep it narrow; never use `*` or disable host checks as a workaround.

Example:

```dotenv
VITE_ALLOWED_HOSTS=localhost,127.0.0.1
```

For a development tunnel, add only the exact hostname supplied by that provider.

## Production web build

```bash
pnpm run check
```

Vite writes the static frontend to `dist/`. This directory can be hosted by a static web host.

**Backend boundary:** API-backed features call same-origin `/api` routes and the app uses a WebSocket endpoint. A static deployment must therefore route those requests to the Express backend using a same-origin reverse proxy/API rewrite, or deploy the Express server with the frontend. Uploading `dist/` alone does not deploy the API, WebSocket endpoint, PostgreSQL, Firebase authentication, or server-side AI integrations.

Configure server runtime variables separately. Copy `.env.example` to `.env` for local development. Never commit `.env` and never put server secrets in `VITE_*` variables. Browser-exposed API keys must be restricted using provider-supported referrer and API restrictions.

## CI artifacts

The CityFix CI workflow validates the TypeScript project, builds the Vite frontend, and uploads `cityfix-web-dist` as a temporary workflow artifact. It also builds an Android debug APK for community testing. CI artifacts are short-lived review/test outputs, not permanent versioned releases.

## Versioned community releases

After the release commit is reviewed and merged, create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The tag-triggered workflow installs dependencies using the committed pnpm lockfile, runs the web typecheck/build, packages `dist/`, assembles the Android debug APK, creates checksums, and publishes the files to the matching GitHub Release.

Expected release assets:
- `cityfix-web-dist.zip`
- `cityfix-android-debug.apk`
- `SHA256SUMS.txt`

## Android signing limitation

The community workflow publishes a debug APK for contributor testing. It is not a Play Store package and is not signed using a persistent maintainer-controlled release key. Debug builds from separate runners may be signed with different ephemeral debug keys; installing a new artifact may require uninstalling the previous build and losing its local app data.

A stable Android release requires a maintainer-controlled signing key stored in protected CI secrets or an equivalent secure signing system. Never commit keystores, passwords, or private signing material.

## Downloading and verifying

Download the ZIP, APK, and checksum file from the GitHub Release. Verify with:

```bash
sha256sum --check SHA256SUMS.txt
```

On Windows, use `Get-FileHash -Algorithm SHA256` and compare with the published checksum entries.

A matching checksum confirms artifact integrity relative to the checksum file. It does not prove that the software is secure or independently audited.
