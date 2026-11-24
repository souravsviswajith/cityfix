# CityFix Web Build and Release Guide

CityFix maintains a React/Vite web client and a native Kotlin/Jetpack Compose Android client. The web build is a frontend artifact; it is not a replacement for the Express API/backend.

## Local development

Requirements:
- Node.js 22
- pnpm 10.10.0
- Git

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run dev
```

The development server uses the Vite configuration in `vite.config.ts`. `VITE_ALLOWED_HOSTS` is a comma-separated allowlist for additional development hostnames. It is not a credential and must not contain secrets. Keep the list as narrow as practical.

Example for local development:

```dotenv
VITE_ALLOWED_HOSTS=localhost,127.0.0.1
```

If using a development tunnel, add only the exact hostname assigned by that provider. Do not use `*` or disable host checking as a convenience workaround.

## Production web build

```bash
pnpm run check
```

Vite writes the static frontend files to `dist/`. The generated directory can be packaged as a static frontend artifact.

**Deployment requirement:** the web client calls the CityFix Express API using same-origin `/api` routes. A static-host deployment therefore needs a reverse proxy/API rewrite to the backend, or the frontend and backend must be served together behind the same origin. Uploading `dist/` alone does not deploy the Express API, WebSocket endpoint, database, Firebase authentication, or server-side AI integrations.

The server requires runtime configuration separately. Copy `.env.example` to `.env` for local development and provide only the integrations you have configured. Never commit `.env` or put server secrets in `VITE_*` variables.

## CI artifacts

The CityFix CI workflow validates the web TypeScript project, builds the Vite frontend, and uploads `cityfix-web-dist` as a temporary workflow artifact. It also builds and uploads an Android debug APK. CI artifacts are intended for review and testing; they are not permanent versioned releases.

## Versioned community releases

Create and push a version tag after the release commit has been reviewed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The community release workflow:
1. Installs dependencies from the committed pnpm lockfile.
2. Runs TypeScript checks and builds the web client.
3. Packages `dist/` as `cityfix-web-dist.zip`.
4. Builds the Android debug APK.
5. Generates SHA-256 checksums.
6. Publishes the files to the matching GitHub Release.

### Android signing limitation

The current workflow publishes an Android **debug APK** so contributors can install and test the app without maintainer signing secrets. GitHub's ephemeral debug signing key is not a stable release identity; users may need to uninstall an earlier debug build before installing a build signed by a different runner. This APK is not a Play Store release and must not be presented as a stable signed production build.

A stable Android release requires a maintainer-controlled signing key stored in GitHub Actions secrets or another protected signing system. Do not commit keystores, passwords, or private signing material. The release workflow intentionally does not invent or generate a persistent signing identity.

## Downloading and verifying

Download the web ZIP, Android debug APK, and `SHA256SUMS.txt` from the GitHub Release page. Verify an artifact before use:

```bash
sha256sum --check SHA256SUMS.txt
```

On Windows PowerShell, compare the output of:

```powershell
Get-FileHash .\cityfix-android-debug.apk -Algorithm SHA256
Get-FileHash .\cityfix-web-dist.zip -Algorithm SHA256
```

with the corresponding entries in `SHA256SUMS.txt`.

A matching checksum confirms file integrity relative to the published checksum file. It does not prove that the software is secure or independently audited.
