# CityFix Android — Complete Setup, Build & Artifact Guide

> **Who this guide is for:** contributors who are new to programming, Git, Android Studio, Kotlin, and GitHub Actions.
>
> **Follow the steps in order.** Do not skip ahead because a later step assumes the earlier one worked. If a step fails, stop at that step, copy the complete error, and ask the maintainer. Do not randomly change Gradle, Kotlin, SDK, or plugin versions.

## 0. What you are setting up

You are setting up the **native Android CityFix application**. The Android app is written in Kotlin and Jetpack Compose.

You will install:

1. Git — downloads the project and manages your code changes.
2. Android Studio — the editor and Android development environment.
3. JDK 17 — runs the Android build tools.
4. Android SDK Platform 35 and Build Tools 35.0.0 — compile the app.
5. Android Platform Tools — includes ADB, which connects to phones and emulators.
6. Gradle 8.9 — builds the Android project.
7. An Android emulator or a physical Android phone — runs the app.

**You do not need Flutter, Node.js, Python, Docker, or a separate Kotlin compiler to build the native Android module.** Those tools are for other project areas or unrelated workflows.

### Current Android project configuration

These values are controlled by the repository. Do not change them just to make your machine work.

| Setting | Current value |
|---|---|
| App name | CityFix |
| Application ID | `com.cityfix.android` |
| Android project folder | `android/` |
| Minimum Android version | API 26 (Android 8.0) |
| Compile SDK | API 35 |
| Target SDK | API 35 |
| Android Gradle Plugin | 8.7.3 |
| Kotlin | 2.0.21 |
| Gradle | 8.9 |
| Java/JVM target | 17 |
| Build variant currently used | Debug |

The project currently has **no committed Gradle Wrapper** (`gradlew` / `gradlew.bat`). This guide therefore installs Gradle 8.9 on Windows. Do not run wrapper commands until the maintainer adds the wrapper files.

## 1. Prepare your Windows computer

### 1.1 Minimum computer requirements

- Windows 10 or Windows 11, 64-bit.
- 8 GB RAM minimum; 16 GB recommended.
- At least 20 GB free disk space for Android Studio, SDK packages, emulator images, and Gradle caches.
- Stable internet connection for first-time downloads.
- Administrator access for software installation.

If your computer has 8 GB RAM, use a physical Android phone instead of running an emulator.

### 1.2 Create a workspace folder

1. Open File Explorer.
2. Open the drive where you keep development projects.
3. Create a folder named `Workspace`.

Example project location:

```text
D:\Workspace\cityfix
```

Avoid putting the repository inside Downloads, OneDrive-synced folders, or a folder with unusual characters in its path.

### 1.3 Open PowerShell

1. Press the Windows key.
2. Type **PowerShell**.
3. Open Windows PowerShell or Terminal.
4. Run:

```powershell
$PSVersionTable.PSVersion
```

A version number should appear. Keep this PowerShell window available.

## 2. Install Git

Git downloads the source code and lets you submit changes safely.

1. Open: https://git-scm.com/download/win
2. Download Git for Windows.
3. Run the installer.
4. Keep the recommended defaults.
5. Ensure the installer option that adds Git to the command-line PATH remains enabled.
6. Finish installation.
7. Close every open PowerShell window.
8. Open PowerShell again.

Verify:

```powershell
git --version
```

Expected: a Git version such as `git version 2.x.x.windows.x`.

If PowerShell says `git is not recognized`, restart the terminal first. If it still fails, reinstall Git and ensure command-line PATH integration is enabled.

## 3. Install JDK 17

Android's current project configuration uses Java 17. Do not install a random Java version.

1. Open: https://adoptium.net/temurin/releases/?version=17
2. Select:
   - Operating System: Windows
   - Architecture: x64
   - Package: JDK
   - Version: 17 LTS
3. Download the MSI installer.
4. Run it.
5. If the installer offers these options, enable:
   - Add to PATH
   - Set JAVA_HOME
6. Complete installation.
7. Close and reopen PowerShell.

Verify:

```powershell
java -version
javac -version
$env:JAVA_HOME
```

Expected:
- Java reports version 17.
- Java compiler (`javac`) reports version 17.
- `JAVA_HOME` points to the installed JDK 17 directory.

If `java` works but `javac` does not, you probably installed a JRE instead of a JDK. Install the JDK.

## 4. Install Android Studio

Android Studio provides the editor, SDK Manager, emulator manager, and Android debugging tools.

1. Open: https://developer.android.com/studio
2. Download the stable Windows version.
3. Run the installer.
4. Keep these components selected:
   - Android Studio
   - Android Virtual Device (if you plan to use an emulator)
5. Complete the installation.
6. Start Android Studio.
7. In the setup wizard, choose **Standard** installation.
8. Accept the Android SDK licences.
9. Allow the wizard to download the recommended components.
10. Wait until setup completes.

Do not install preview/canary Android Studio builds for this project.

## 5. Configure the Android SDK

This is an important step. The SDK is not the same thing as Android Studio. Android Studio is the editor; the SDK contains the tools and Android platform files needed to build and run the app.

### 5.1 Open SDK Manager

From the Android Studio welcome screen:

1. Click **More Actions**.
2. Select **SDK Manager**.

If a project is already open:

1. Open **Tools**.
2. Select **SDK Manager**.

### 5.2 Install the required SDK platform

Under **SDK Platforms**:

1. Find **Android 15.0 (Vanilla Ice Cream)** / **API Level 35**.
2. Tick the checkbox.
3. Click **Apply**.
4. Confirm the download.
5. Wait until it completes.

### 5.3 Install required SDK tools

Open the **SDK Tools** tab. Tick or confirm these components:

- Android SDK Build-Tools 35.0.0 (or the 35.0.0 package explicitly listed).
- Android SDK Platform-Tools.
- Android SDK Command-line Tools (latest).
- Android Emulator — only if using an emulator.
- Google USB Driver — useful for some Windows physical-device setups.

Click **Apply**, accept licences, and wait for installation to finish.

Do not install the NDK or CMake for the current CityFix Android module; they are not currently required.

### 5.4 Find the SDK installation path

In SDK Manager, copy the value shown beside **Android SDK Location**.

The common default is:

```text
C:\Users\YOUR_WINDOWS_USERNAME\AppData\Local\Android\Sdk
```

Your actual path may differ. Use the path shown on your computer; do not copy the example literally.

### 5.5 Configure environment variables

Open PowerShell and replace the example path below with the SDK path shown in your SDK Manager:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")
```

Add the Android tools to your user PATH:

```powershell
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$entries = @(
  "$sdk\platform-tools",
  "$sdk\cmdline-tools\latest\bin",
  "$sdk\emulator"
)
foreach ($entry in $entries) {
  if (($userPath -split ";") -notcontains $entry) {
    $userPath = "$userPath;$entry"
  }
}
[Environment]::SetEnvironmentVariable("Path", $userPath, "User")
```

Close PowerShell and open it again so Windows reloads the environment variables.

Verify:

```powershell
$env:ANDROID_HOME
adb version
sdkmanager --version
```

If `sdkmanager` is not recognized, check that this file exists:

```text
<ANDROID_HOME>\cmdline-tools\latest\bin\sdkmanager.bat
```

If the SDK Manager installed command-line tools into a versioned folder instead of `latest`, use SDK Manager to install **Android SDK Command-line Tools (latest)**. Do not manually rename SDK folders unless the maintainer asks you to.

### 5.6 Verify required SDK packages

Run:

```powershell
sdkmanager --list_installed
```

Confirm that the following packages are installed:

```text
platform-tools
platforms;android-35
build-tools;35.0.0
```

If a package is missing, install it:

```powershell
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Accept licences if requested:

```powershell
sdkmanager --licenses
```

Read the prompts and type `y` to accept the required licences. Do not blindly accept unrelated licences you do not understand.

## 6. Install Gradle 8.9

The current checkout does not contain a Gradle Wrapper. Install the exact Gradle version expected by the project.

1. Open: https://gradle.org/releases/
2. Find Gradle **8.9**.
3. Download the **binary-only** ZIP distribution.
4. Extract it to a stable folder, for example:

```text
C:\DevTools\gradle\gradle-8.9
```

5. Open Windows Start and search for **Edit the system environment variables**.
6. Open **Environment Variables**.
7. Under **User variables**, click **New**:
   - Variable name: `GRADLE_HOME`
   - Variable value: `C:\DevTools\gradle\gradle-8.9`
8. Select the user `Path`, click **Edit**, then **New**:
   - `%GRADLE_HOME%\bin`
9. Save all dialogs.
10. Close and reopen PowerShell.

Verify:

```powershell
gradle --version
```

Expected:
- Gradle 8.9
- JVM 17

If Gradle reports a different version, check PATH order and `GRADLE_HOME`. Do not install multiple Gradle versions and hope the correct one is selected.

## 7. Clone CityFix from GitHub

1. Open: https://github.com/souravsviswajith/cityfix
2. Sign in to GitHub if repository access is required.
3. Click **Code** and copy the HTTPS clone URL.
4. Open PowerShell.
5. Run:

```powershell
Set-Location D:\Workspace
git clone https://github.com/souravsviswajith/cityfix.git
Set-Location .\cityfix
```

If you already cloned the repository, do not clone it again. Instead:

```powershell
Set-Location D:\Workspace\cityfix
git status
git pull
```

Check that you are in the correct folder:

```powershell
Get-ChildItem
Get-ChildItem .\android
```

You should see the `android` directory and its Gradle build files.

## 8. Open the Android project

1. Start Android Studio.
2. Choose **Open**.
3. Select:

```text
D:\Workspace\cityfix\android
```

4. Select the `android` folder, not the repository root.
5. If Windows asks whether you trust the project, confirm only if you cloned it from the official CityFix repository.
6. Wait for Gradle sync to finish.

### 8.1 Set Gradle JDK to 17

In Android Studio:

1. Open **File → Settings**.
2. Navigate to **Build, Execution, Deployment → Build Tools → Gradle**.
3. Find **Gradle JDK**.
4. Select JDK 17 / the Temurin 17 installation.
5. Click **Apply**.
6. Click **OK**.
7. Select **File → Sync Project with Gradle Files**.

Wait for the sync to finish. The first sync can take several minutes because Gradle downloads plugins and dependencies.

### 8.2 What a successful sync looks like

- No red Gradle sync error banner.
- The Android project appears in the Project panel.
- The `app` module is visible.
- Android Studio does not show a missing SDK 35 warning.

If sync fails, do not upgrade Kotlin, AGP, Gradle, KSP, or Room. Capture the first complete error and report it.

## 9. Choose how to run the app

You can use either a physical Android phone or an emulator.

### Option A — Physical Android phone (recommended for low-RAM computers)

1. On the phone, open **Settings → About phone**.
2. Find **Build number**.
3. Tap **Build number** seven times. Enter the phone PIN if asked.
4. Open **Developer options**.
5. Enable **USB debugging**.
6. Connect the phone to the computer using a data-capable USB cable.
7. Unlock the phone.
8. Accept the **Allow USB debugging?** prompt. Select **Always allow from this computer** only on your own trusted computer.
9. In PowerShell, run:

```powershell
adb devices
```

Expected: one device with status `device`.

If it says `unauthorized`, unlock the phone and accept the RSA prompt. If no device appears, try another USB cable/port and install the manufacturer's USB driver if required.

### Option B — Android emulator

Use this option if your computer has enough RAM and hardware virtualization is enabled.

1. In Android Studio, open **Tools → Device Manager**.
2. Click **Create Device**.
3. Select a common phone profile, such as Pixel.
4. Click **Next**.
5. Select an Android 15 / API 35 system image.
6. Download the image if necessary.
7. Click **Next**, then **Finish**.
8. Press the Play icon beside the new virtual device.
9. Wait until Android finishes booting.

If the emulator is very slow, close it and use a physical phone.

## 10. Run CityFix for the first time

1. In Android Studio, select the `app` run configuration.
2. Select your connected phone or running emulator from the device list.
3. Click the green **Run ▶** button.
4. Wait for Gradle to build and install the app.
5. The CityFix app should open on the device.

The first build may take several minutes. Later builds are usually faster.

### What you should see

The current Android foundation includes a basic Compose emergency/SOS screen, local incident persistence, location permission handling, and BLE capability inspection.

**Important implementation limits:**
- BLE multi-hop relay is not implemented.
- Wi-Fi Direct/Wi-Fi Aware transport is not implemented.
- A saved SOS is local data; it is not proof of delivery to another phone or authority.
- Do not present a debug screen as a production-ready emergency service.

## 11. Build the debug APK from PowerShell

An APK is the Android application package that can be installed on a compatible Android device.

Open PowerShell in the repository root:

```powershell
Set-Location D:\Workspace\cityfix\android
gradle :app:clean
gradle :app:assembleDebug
```

Wait for:

```text
BUILD SUCCESSFUL
```

The APK should be created at:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

From the repository root, verify the file exists:

```powershell
Test-Path .\android\app\build\outputs\apk\debug\app-debug.apk
```

Expected: `True`.

Get the file size and SHA-256 checksum:

```powershell
Get-Item .\android\app\build\outputs\apk\debug\app-debug.apk |
  Select-Object Name, Length, LastWriteTime

Get-FileHash .\android\app\build\outputs\apk\debug\app-debug.apk -Algorithm SHA256
```

Keep the checksum with the APK when sharing it. A checksum helps verify that the downloaded file has not changed; it does not prove that the APK is safe or officially released.

## 12. Install the debug APK manually

Connect and authorize your Android phone first. From the repository root:

```powershell
adb devices
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

The `-r` option reinstalls the app while attempting to keep its app data.

If installation reports a signature conflict:
- The device may have a different build signed with another debug key.
- Uninstalling the existing app may remove its local data.
- Ask the maintainer before uninstalling if you need to preserve test data.

To launch the app from the device, use the app drawer.

## 13. Get an APK from GitHub Actions

GitHub Actions can build the APK on GitHub-hosted computers. This is useful when your computer cannot build Android locally.

### 13.1 Trigger the Android build

The Android workflow runs when:
- Android project files are pushed to a branch.
- A pull request changes Android project files.
- A maintainer manually starts the workflow using **workflow_dispatch**.

To run it manually:

1. Open https://github.com/souravsviswajith/cityfix/actions
2. Sign in and open the **Android build** workflow.
3. Click **Run workflow**.
4. Select the branch you want to build.
5. Click **Run workflow** again.
6. Open the new workflow run.
7. Wait for the build job to finish.

A green tick means the workflow steps completed. A red cross means the build failed. Open the failed job and copy the first complete error block.

### 13.2 Download the workflow artifact

After a successful run:

1. Open the workflow run summary.
2. Scroll to **Artifacts**.
3. Download the artifact named `cityfix-debug-apk`.
4. Extract the downloaded ZIP.
5. Confirm it contains `app-debug.apk` and its checksum file (when checksum generation is enabled).
6. Verify the checksum before installing.

Artifacts are temporary build outputs retained for a limited period by GitHub. They are not the same as a versioned GitHub Release.

### 13.3 Verify a downloaded artifact

If a checksum file is included, run this in the extracted folder:

```powershell
Get-FileHash .\app-debug.apk -Algorithm SHA256
Get-Content .\app-debug.apk.sha256
```

Compare the SHA-256 value with the value in the checksum file. They must match exactly.

## 14. Artifact, GitHub Release, and Play Store — understand the difference

| Distribution method | What it is | CityFix status |
|---|---|---|
| Local APK | APK built on your own computer | Available as a debug build if local build succeeds |
| GitHub Actions artifact | Temporary downloadable output from a workflow run | Debug APK artifact is the CI output |
| GitHub Release | Versioned project release page with attached files and release notes | Can be used for clearly labelled test builds; maintainer-controlled |
| Google Play internal/closed testing | App distributed through Play Console testing tracks | Future option; requires Play Console setup and a properly signed release bundle |

### 14.1 What contributors may download and test

Contributors may use the debug APK from:
- Their own successful local build.
- A successful GitHub Actions run.

Only install APKs from the official CityFix repository or from a maintainer-provided source. Do not install APKs sent by unknown people.

### 14.2 Creating a GitHub Release (maintainer only)

A maintainer may publish a **pre-release** for team testing:

1. Confirm the intended commit is reviewed and built successfully.
2. Download the corresponding `cityfix-debug-apk` artifact from Actions.
3. Open https://github.com/souravsviswajith/cityfix/releases
4. Click **Draft a new release**.
5. Create a tag such as `v0.1.0-test.1` only after the maintainer approves that version.
6. Set a clear title, for example `CityFix 0.1.0 — Internal Test Build`.
7. Mark it as a **pre-release**.
8. Attach the APK and SHA-256 checksum file.
9. In the notes, state the source commit, build type (debug), known limitations, and test instructions.
10. Review everything, then publish.

**Do not label a debug APK as production, stable, or Play Store-ready.** A GitHub Release page does not automatically make an APK a production release.

### 14.3 Production release signing — not configured yet

A production Android release must use a protected release signing key. The current project does not yet have a verified production signing configuration or a signed release pipeline.

Before enabling production releases, the maintainer must:
- Generate a dedicated upload/release keystore.
- Store the keystore and passwords in protected GitHub Actions secrets, never in Git.
- Configure a release signing block in the Android Gradle build.
- Add a release workflow that builds the correct release variant.
- Verify the APK/AAB signature and package identity.
- Generate and publish SHA-256 checksums.
- Record source commit, build workflow, version code/name, and release notes.
- Restrict release permissions to maintainers.
- Test the release on a clean device before distribution.

Never send a keystore, keystore password, API key, or signing secret in chat, email, an issue, or a pull request. Never commit `.jks`, `.keystore`, or signing properties.

### 14.4 Google Play distribution

Google Play internal/closed testing is a later distribution option. It requires a Play Console developer account, store listing, app signing configuration, policy declarations, and a signed Android App Bundle (AAB). Do not upload the current debug APK as a production Play Store release.

## 15. Common errors and fixes

### Error: `java is not recognized`

- Confirm JDK 17 is installed.
- Close and reopen PowerShell.
- Run `java -version`.
- Check the user/system PATH and `JAVA_HOME`.

### Error: `gradle is not recognized`

- Confirm Gradle 8.9 was extracted.
- Confirm `GRADLE_HOME` points to the extracted folder.
- Confirm `%GRADLE_HOME%\bin` is in PATH.
- Reopen PowerShell.
- Run `gradle --version`.

### Error: Android SDK location not found

- Open Android Studio → SDK Manager.
- Copy the actual SDK location.
- Set `ANDROID_HOME` to that directory.
- Confirm `platforms\android-35` exists inside the SDK folder.

### Error: SDK platform 35 missing

Run:

```powershell
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
```

### Error: Gradle uses the wrong Java version

- Run `gradle --version`.
- Confirm the JVM shown is 17.
- In Android Studio, set Gradle JDK to JDK 17.
- Do not change the project's Kotlin or Android Gradle Plugin versions.

### Error: Gradle sync or dependency download failed

- Check internet access.
- Retry once.
- Check whether a school/office proxy or firewall blocks Google Maven, Maven Central, or Gradle Plugin Portal.
- Capture the first complete error.
- Do not randomly change dependency versions or delete project files.

### Error: `SDK license not accepted`

Run:

```powershell
sdkmanager --licenses
```

Review and accept the required licences.

### Error: Phone shows as `unauthorized`

- Unlock the phone.
- Accept the USB debugging prompt.
- Run `adb devices` again.

### Error: `BUILD FAILED`

Do not send only a screenshot of the last line. Copy:
- The command you ran.
- The first `What went wrong` section.
- The first `Caused by` section, if present.
- Output of `java -version` and `gradle --version`.

## 16. A simple daily workflow

When you start working:

```powershell
Set-Location D:\Workspace\cityfix
git status
git switch main
git pull origin main
git switch -c feature/your-name-short-task
```

Make one small change at a time. Then run:

```powershell
Set-Location .\android
gradle :app:assembleDebug
Set-Location ..
git diff --check
git status
```

Commit and push only the files you intended to change:

```powershell
git add path\to\your\changed-file
git commit -m "feat(android): describe your change"
git push -u origin HEAD
```

Open a Pull Request on GitHub and wait for review. Do not push directly to `main`.

## 17. Before asking for help

Send the team lead this information:

```text
NAME:
[Your name]

WINDOWS VERSION:
[Windows 10/11]

ANDROID STUDIO VERSION:
[Help > About]

JAVA VERSION:
[Output of java -version]

GRADLE VERSION:
[Output of gradle --version]

ANDROID SDK LOCATION:
[SDK Manager path]

BRANCH:
[Output of git branch --show-current]

COMMAND I RAN:
[Exact command]

ERROR:
[Complete first error block]

WHAT I ALREADY TRIED:
[Short list]
```

Never include passwords, API keys, signing files, service-account JSON, personal citizen information, or exact private location data.

## 18. Final checklist

- [ ] Git installed and `git --version` works.
- [ ] JDK 17 installed and `javac -version` works.
- [ ] Android Studio installed.
- [ ] Android SDK Platform 35 installed.
- [ ] Android Build Tools 35.0.0 installed.
- [ ] Android Platform Tools installed and `adb version` works.
- [ ] Android Command-line Tools installed and `sdkmanager --version` works.
- [ ] `ANDROID_HOME` points to the actual SDK folder.
- [ ] Gradle 8.9 installed and `gradle --version` reports JVM 17.
- [ ] CityFix repository cloned.
- [ ] `android/` project opened in Android Studio.
- [ ] Gradle JDK set to 17.
- [ ] Gradle sync succeeds.
- [ ] App runs on an emulator or physical Android phone.
- [ ] `gradle :app:assembleDebug` succeeds.
- [ ] APK exists at `android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] APK checksum generated.
- [ ] GitHub Actions artifact can be downloaded after a successful workflow run.

**If all boxes are checked, your Android development environment is ready.**

---

**Maintainer note:** This guide describes the repository configuration inspected on 23 November 2026. Current Android CI builds a debug APK. Production signing and an automated production release workflow are not configured. Update this guide whenever the Android Gradle files, SDK levels, CI workflow, or release process changes.
