# CityFix — Android Citizen-to-Government Civic Reporting & Disaster Management System

**Tagline:** *See the problem. Report it. Reach the responsible authority.*  
**Platform:** Native Android (Kotlin, Jetpack Compose, Material 3) + Secure Backend Proxy (Kotlin / Ktor)

---

## PART 1: Pre-Implementation Architectural Blueprint

### 1. System Architecture
CityFix enforces a strict separation between the client application and external data ingestion pipelines to ensure security, API key protection, and data integrity.

```text
+-------------------------------------------------------------------+
|                     ANDROID CLIENT (Kotlin / Compose)             |
|  +-------------------------------------------------------------+  |
|  | Presentation Layer (Jetpack Compose, Material 3, ViewModels) |  |
|  +-------------------------------------------------------------+  |
|  | Domain Layer (UseCases, Verification State Evaluators)      |  |
|  +-------------------------------------------------------------+  |
|  | Data Layer (Repository Pattern, Room DB, EncryptedPrefs)    |  |
|  +-------------------------------------------------------------+  |
|  | Hardware & Sync (CameraX, FusedLocation, WorkManager)       |  |
|  +-------------------------------------------------------------+  |
+---------------------------------+---------------------------------+
                                  | HTTPS / TLS 1.3 (Retrofit + OkHttp)
                                  v
+-------------------------------------------------------------------+
|                  CITYFIX BACKEND GATEWAY (Ktor / JVM)             |
|  +-------------------------------------------------------------+  |
|  | Auth & Rate Limiting (Firebase Auth / WhatsApp Business API) |  |
|  +-------------------------------------------------------------+  |
|  | Jurisdiction Resolver (Reverse Geocoding + GIS Polygon Match)|  |
|  +-------------------------------------------------------------+  |
|  | Live Authority Orchestrator & Verification Engine           |  |
|  +-------------------------------------------------------------+  |
|  | Cache Layer (Redis with strict TTL & Provenance Metadata)    |  |
|  +-------------------------------------------------------------+  |
+---------------------------------+---------------------------------+
                                  | Server-Side Adapter Connectors
                                  v
+-------------------------------------------------------------------+
|             EXTERNAL AUTHORITATIVE DATA SOURCES                   |
|  - OpenStreetMap / Nominatim / Google Geocoding (Boundaries)      |
|  - Local Government Directories (e.g., LSGD Kerala, Data.gov.in)  |
|  - Election Commission / Parliamentary Portals (MLA/MP Data)      |
|  - National Disaster Management Authority (NDMA / SACHET CAP)     |
+-------------------------------------------------------------------+
```

### 2. Module Boundaries (Clean Architecture)
1. `:core:network` — Retrofit client, OkHttp interceptors, TLS pinning, exponential backoff retry policies, structured `ApiResult<T>` error wrappers.
2. `:core:database` — Room SQLite database for offline complaint drafts, media attachment queues, and timestamped authority caches.
3. `:core:security` — Android Keystore integration, `EncryptedSharedPreferences` for auth tokens, EXIF metadata scrubber/preserver.
4. `:feature:auth` — Phone OTP and conditional WhatsApp Business API authentication flows.
5. `:feature:media` — CameraX capture, Photo Picker gallery selection, background image compression (`Bitmap` scaling + WebP/JPEG compression), original hash preservation (`SHA-256`).
6. `:feature:location` — FusedLocationProviderClient GPS retrieval, manual map pin adjustment, administrative boundary resolution.
7. `:feature:authority` — Live authority fetching client, provenance UI badges, and the **Authority Verification Engine** UI evaluator.
8. `:feature:complaint` — Structured complaint generator, multi-format template engine (Formal Letter, Official Email, Civic Report), rich-text editor, and intent dispatcher.
9. `:feature:disaster` — Isolated high-priority emergency workflow, verified helpline directory, CAP (Common Alerting Protocol) feed consumer, and authoritative first-aid/preparedness repository.

### 3. Core Data Models
* `CivicReport`: `id`, `category`, `description`, `latitude`, `longitude`, `manualAddressOverride`, `jurisdiction`, `attachments`, `assignedAuthorities`, `draftContent`, `syncStatus`, `createdAt`.
* `Jurisdiction`: `country`, `state`, `district`, `localBodyType` (Corporation/Municipality/Panchayat), `localBodyName`, `wardNumber`, `wardName`, `assemblyConstituency`, `parliamentaryConstituency`.
* `AuthorityProfile`: `id`, `branch` (`POLITICAL` | `ADMINISTRATIVE`), `fullName`, `designation`, `department`, `jurisdictionScope`, `phone`, `email`, `sourceUrl`, `lastVerifiedEpoch`, `verificationStatus`.
* `VerificationResult`: `status` (`VERIFIED` | `PARTIALLY_VERIFIED` | `STALE` | `UNAVAILABLE`), `checksPassed` (List of criteria), `provenanceNote`, `timestamp`.
* `DisasterIncident`: `id`, `severity` (`LOCAL_EMERGENCY` | `LARGE_SCALE_DISASTER`), `category`, `latitude`, `longitude`, `notes`, `timestamp`.

### 4. External APIs & Credentials Required
* **Maps & Reverse Geocoding:** Google Maps SDK for Android & Geocoding API (or OpenStreetMap Nominatim + Overpass API for administrative boundary polygons).
* **Authentication:** Firebase Authentication (Phone Number OTP) + Meta WhatsApp Business Cloud API (requires verified Meta Business Account & WABA ID).
* **Government & Civic Datasets:** Open Government Data (OGD) Platform APIs (`data.gov.in`), State Local Self-Government Directories, and NDMA SACHET CAP RSS/XML feeds.

### 5. Features Dependent on External Government Integrations (Explicit Boundaries)
* **Direct Ticket Submission to Municipal ERPs:** Most municipal bodies lack open write-APIs for third-party apps. *Resolution:* CityFix generates a legally structured, pre-addressed complaint and launches the citizen's native email client (`ACTION_SENDTO`) or provides a formatted PDF/text export, explicitly stating that submission occurs via the citizen's chosen channel rather than claiming automated government registration.
* **Live Authority Directories:** Where a local municipality does not publish machine-readable APIs or structured HTML directories, the backend returns `VerificationStatus.UNAVAILABLE` with the official portal URL so the citizen is never shown fabricated names or numbers.
* **WhatsApp Login:** Disabled gracefully in UI unless the backend feature flag `whatsapp_auth_enabled` confirms valid WABA credentials are configured.

### 6. Incremental Implementation Plan
* **Phase 1:** Gradle multi-module setup, Material 3 theme, Navigation Compose, Phone/WhatsApp Auth shell, Room database.
* **Phase 2:** CameraX & Photo Picker integration, SHA-256 evidence hashing, FusedLocation GPS + manual coordinate picker.
* **Phase 3:** Backend Ktor server setup, Jurisdiction Resolver, Live Authority Orchestrator, and Verification Engine.
* **Phase 4:** Complaint Draft Generator (Letter/Email/Report templates), editable review screen, and offline WorkManager sync.
* **Phase 5:** Isolated Disaster Management module with verified national/local emergency numbers, CAP alert parser, and authoritative safety guides.
* **Phase 6:** Security hardening (ProGuard, PII-free logging, TLS enforcement) and offline resilience testing.

---

## PART 2: Android Application Implementation (Kotlin / Jetpack Compose)

### 1. Gradle Configuration (`app/build.gradle.kts`)

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "org.cityfix.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.cityfix.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Backend base URL injected via build config; never hardcode secrets
        buildConfigField("String", "API_BASE_URL", "\"https://api.cityfix.org/v1/\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Compose & Material 3
    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.5")

    // Hilt DI
    implementation("com.google.dagger:hilt-android:2.52")
    ksp("com.google.dagger:hilt-compiler:2.52")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Networking & Serialization
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")

    // Room Local Persistence & WorkManager
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.hilt:hilt-work:1.2.0")

    // CameraX & Media
    val cameraxVersion = "1.3.4"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Location & Security
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
}
```

### 2. Android Manifest (`app/src/main/AndroidManifest.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Minimal required permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:name=".CityFixApplication"
        android:allowBackup="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="false"
        android:icon="@mipmap/ic_launcher"
        android:label="CityFix"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true"
        android:theme="@style/Theme.CityFix">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- FileProvider for secure camera media capture -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```

### 3. Domain Models & Authority Verification Engine (`domain/model/DomainModels.kt`)

```kotlin
package org.cityfix.android.domain.model

import kotlinx.serialization.Serializable

enum class IssueCategory(val displayName: String, val departmentKey: String) {
    ROADS_POTHOLES("Roads & Potholes", "PUBLIC_WORKS"),
    WATER_SUPPLY("Water Supply & Leakage", "WATER_AUTHORITY"),
    ELECTRICITY_STREETLIGHTS("Electricity & Streetlights", "ELECTRICITY"),
    SANITATION_WASTE("Garbage & Sanitation", "SANITATION"),
    DRAINAGE_FLOODING("Blocked Drainage & Waterlogging", "DRAINAGE"),
    PUBLIC_SAFETY_INFRA("Damaged Public Infrastructure", "MUNICIPAL_ENGINEERING")
}

enum class AuthorityBranch {
    POLITICAL,      // Ward Councillor, Mayor, MLA, MP
    ADMINISTRATIVE  // Municipal Commissioner, Dept Engineer, Panchayat Secretary
}

enum class VerificationStatus {
    VERIFIED,           // Confirmed current in authoritative source for this jurisdiction
    PARTIALLY_VERIFIED, // Person/office exists, but contact or ward boundary needs confirmation
    STALE,              // Cached record exceeds freshness threshold; live check failed
    UNAVAILABLE         // No reliable government source returned data
}

@Serializable
data class Jurisdiction(
    val state: String,
    val district: String,
    val localBodyType: String, // e.g., "Municipal Corporation", "Grama Panchayat"
    val localBodyName: String,
    val wardNumber: String?,
    val wardName: String?,
    val assemblyConstituency: String?,
    val parliamentaryConstituency: String?,
    val formattedAddress: String
)

@Serializable
data class AuthorityRecord(
    val id: String,
    val branch: AuthorityBranch,
    val fullName: String?,
    val designation: String,
    val department: String,
    val jurisdictionName: String,
    val officialPhone: String?,
    val officialEmail: String?,
    val sourceUrl: String?,
    val lastVerifiedIso: String?,
    val isCurrentTermConfirmed: Boolean,
    val matchesJurisdiction: Boolean,
    val matchesDepartment: Boolean,
    val isContactFromOfficialDomain: Boolean
)

data class VerifiedAuthority(
    val record: AuthorityRecord,
    val status: VerificationStatus,
    val verificationReasons: List<String>,
    val freshnessLabel: String
)

data class MediaEvidence(
    val id: String,
    val originalUri: String,
    val compressedUri: String,
    val mimeType: String,
    val sha256OriginalHash: String,
    val capturedAtEpoch: Long
)

data class GeoLocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val isManuallyAdjusted: Boolean,
    val resolvedJurisdiction: Jurisdiction?
)

enum class ComplaintFormat {
    FORMAL_LETTER,
    OFFICIAL_EMAIL,
    CIVIC_CONCERN_REPORT
}
```

### 4. Dedicated Authority Verification Engine (`domain/verification/AuthorityVerificationEngine.kt`)

```kotlin
package org.cityfix.android.domain.verification

import org.cityfix.android.domain.model.AuthorityRecord
import org.cityfix.android.domain.model.VerificationStatus
import org.cityfix.android.domain.model.VerifiedAuthority
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Evaluates raw authority records returned by the backend against strict provenance,
 * jurisdiction, department, and temporal freshness rules.
 * Never fabricates missing fields or upgrades unverified contacts.
 */
@Singleton
class AuthorityVerificationEngine @Inject constructor() {

    companion object {
        private const val MAX_FRESHNESS_DAYS = 30L
    }

    fun evaluate(record: AuthorityRecord, now: Instant = Instant.now()): VerifiedAuthority {
        val reasons = mutableListOf<String>()

        // 1. Check existence in authoritative source
        val hasAuthoritativeSource = !record.sourceUrl.isNullOrBlank() && !record.fullName.isNullOrBlank()
        if (!hasAuthoritativeSource) {
            return VerifiedAuthority(
                record = record,
                status = VerificationStatus.UNAVAILABLE,
                verificationReasons = listOf("No authoritative government source confirmed an incumbent for this role."),
                freshnessLabel = "Unavailable"
            )
        }

        // 2. Check temporal freshness
        val verifiedInstant = record.lastVerifiedIso?.let { runCatching { Instant.parse(it) }.getOrNull() }
        val daysOld = verifiedInstant?.let { ChronoUnit.DAYS.between(it, now) } ?: Long.MAX_VALUE
        val isFresh = daysOld <= MAX_FRESHNESS_DAYS

        val freshnessLabel = when {
            verifiedInstant == null -> "Verification date unknown"
            daysOld == 0L -> "Verified today"
            daysOld == 1L -> "Verified yesterday"
            else -> "Verified $daysOld days ago"
        }

        // 3. Evaluate all 6 verification pillars
        if (record.isCurrentTermConfirmed) reasons.add("Current term/posting confirmed")
        else reasons.add("Current term status unconfirmed")

        if (record.matchesJurisdiction) reasons.add("Jurisdiction matches detected location")
        else reasons.add("Jurisdiction boundary overlap uncertain")

        if (record.matchesDepartment) reasons.add("Department aligns with reported issue")
        else reasons.add("General administrative oversight")

        if (record.isContactFromOfficialDomain) reasons.add("Contact published on official source")
        else reasons.add("Direct contact details not published on official portal")

        val finalStatus = when {
            !isFresh -> VerificationStatus.STALE
            record.isCurrentTermConfirmed &&
                record.matchesJurisdiction &&
                record.matchesDepartment &&
                record.isContactFromOfficialDomain -> VerificationStatus.VERIFIED
            else -> VerificationStatus.PARTIALLY_VERIFIED
        }

        return VerifiedAuthority(
            record = record,
            status = finalStatus,
            verificationReasons = reasons,
            freshnessLabel = freshnessLabel
        )
    }
}
```

### 5. Module 1 & Module 2: Media Evidence & Geotagging Managers (`data/hardware/`)

```kotlin
package org.cityfix.android.data.hardware

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.cityfix.android.domain.model.MediaEvidence
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MediaEvidenceManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    /**
     * Preserves original file hash (SHA-256) for evidentiary integrity while creating
     * a bandwidth-optimized compressed copy for low-connectivity uploads.
     */
    suspend fun processMediaUri(uri: Uri, mimeType: String): Result<MediaEvidence> = withContext(Dispatchers.IO) {
        runCatching {
            val id = UUID.randomUUID().toString()
            val evidenceDir = File(context.filesDir, "evidence").apply { mkdirs() }

            // 1. Copy original and compute SHA-256 hash
            val originalFile = File(evidenceDir, "${id}_orig")
            val digest = MessageDigest.getInstance("SHA-256")
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(originalFile).use { output ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        digest.update(buffer, 0, bytesRead)
                        output.write(buffer, 0, bytesRead)
                    }
                }
            } ?: error("Unable to read selected media stream")

            val sha256Hex = digest.digest().joinToString("") { "%02x".format(it) }

            // 2. Compress if image; retain original reference if video
            val compressedFile = if (mimeType.startsWith("image/")) {
                val target = File(evidenceDir, "${id}_compressed.jpg")
                compressImage(originalFile, target, maxDimension = 1280, quality = 78)
                target
            } else {
                originalFile
            }

            MediaEvidence(
                id = id,
                originalUri = Uri.fromFile(originalFile).toString(),
                compressedUri = Uri.fromFile(compressedFile).toString(),
                mimeType = mimeType,
                sha256OriginalHash = sha256Hex,
                capturedAtEpoch = System.currentTimeMillis()
            )
        }
    }

    private fun compressImage(source: File, destination: File, maxDimension: Int, quality: Int) {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.absolutePath, options)

        var inSampleSize = 1
        while (options.outHeight / inSampleSize > maxDimension || options.outWidth / inSampleSize > maxDimension) {
            inSampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply { this.inSampleSize = inSampleSize }
        val bitmap = BitmapFactory.decodeFile(source.absolutePath, decodeOptions)
            ?: error("Failed to decode bitmap for compression")

        FileOutputStream(destination).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
        }
        bitmap.recycle()
    }
}
```

```kotlin
package org.cityfix.android.data.hardware

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

data class RawCoordinates(val latitude: Double, val longitude: Double, val accuracyMeters: Float)

@Singleton
class LocationTracker @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission") // Caller enforces explicit permission check before invoking
    suspend fun getCurrentCoordinates(): Result<RawCoordinates> = suspendCancellableCoroutine { cont ->
        val cancellationSource = CancellationTokenSource()
        cont.invokeOnCancellation { cancellationSource.cancel() }

        fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellationSource.token)
            .addOnSuccessListener { location ->
                if (location != null) {
                    cont.resume(Result.success(RawCoordinates(location.latitude, location.longitude, location.accuracy)))
                } else {
                    cont.resume(Result.failure(IllegalStateException("GPS signal unavailable. Please adjust pin manually.")))
                }
            }
            .addOnFailureListener { exception ->
                cont.resume(Result.failure(exception))
            }
    }
}
```

### 6. Module 5: Structured Complaint Draft Generator (`domain/complaint/ComplaintDraftGenerator.kt`)

```kotlin
package org.cityfix.android.domain.complaint

import org.cityfix.android.domain.model.ComplaintFormat
import org.cityfix.android.domain.model.GeoLocationData
import org.cityfix.android.domain.model.IssueCategory
import org.cityfix.android.domain.model.MediaEvidence
import org.cityfix.android.domain.model.VerifiedAuthority
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

data class GeneratedComplaint(
    val subject: String,
    val recipientSummary: String,
    val body: String,
    val disclaimer: String
)

@Singleton
class ComplaintDraftGenerator @Inject constructor() {

    fun generateDraft(
        format: ComplaintFormat,
        category: IssueCategory,
        citizenDescription: String,
        location: GeoLocationData,
        authorities: List<VerifiedAuthority>,
        evidenceList: List<MediaEvidence>,
        citizenName: String
    ): GeneratedComplaint {
        val dateStr = ZonedDateTime.now(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm z"))

        val jurisdiction = location.resolvedJurisdiction
        val locationText = buildString {
            append(jurisdiction?.formattedAddress ?: "Coordinates: ${location.latitude}, ${location.longitude}")
            append("\nGPS Coordinates: ${"%.6f".format(location.latitude)}, ${"%.6f".format(location.longitude)}")
            if (location.isManuallyAdjusted) append(" (Pin manually refined by citizen)")
            jurisdiction?.wardNumber?.let { append("\nWard: $it ${jurisdiction.wardName.orEmpty()}") }
            jurisdiction?.localBodyName?.let { append("\nLocal Body: $it (${jurisdiction.localBodyType})") }
        }

        val authorityBlock = if (authorities.isEmpty()) {
            "To: Concerned Municipal / Local Administrative Officer (Live authority directory unavailable for this ward)"
        } else {
            authorities.joinToString("\n") { auth ->
                val name = auth.record.fullName ?: "Incumbent Officer"
                val contact = listOfNotNull(auth.record.officialEmail, auth.record.officialPhone).joinToString(" | ")
                "- ${auth.record.designation} ($name) — ${auth.record.department}" +
                    if (contact.isNotBlank()) " [$contact]" else " [Contact not published]"
            }
        }

        val evidenceBlock = if (evidenceList.isEmpty()) {
            "No photographic or video attachments included."
        } else {
            evidenceList.mapIndexed { idx, item ->
                "Attachment #${idx + 1}: ${item.mimeType} | Integrity SHA-256: ${item.sha256OriginalHash.take(16)}..."
            }.joinToString("\n")
        }

        val subject = "Civic Infrastructure Complaint: ${category.displayName} — ${jurisdiction?.wardName ?: jurisdiction?.localBodyName ?: "Reported Location"}"

        val body = when (format) {
            ComplaintFormat.FORMAL_LETTER -> """
                Date: $dateStr

                To,
                $authorityBlock

                Subject: $subject

                Respected Sir/Madam,

                I am writing as a resident to formally bring to your urgent attention a civic infrastructure issue regarding ${category.displayName.lowercase()} in our locality.

                1. ISSUE DESCRIPTION:
                $citizenDescription

                2. EXACT LOCATION & JURISDICTION:
                $locationText

                3. SUPPORTING EVIDENCE:
                $evidenceBlock

                4. REQUESTED CORRECTIVE ACTION:
                Kindly inspect the site at the earliest and initiate necessary repair/remediation work to prevent public inconvenience and safety hazards. Please share an acknowledgment or grievance reference number for tracking.

                Yours faithfully,
                $citizenName
                (Drafted via CityFix Civic Reporting)
            """.trimIndent()

            ComplaintFormat.OFFICIAL_EMAIL -> """
                Subject: $subject

                Dear Official / Representative,

                Please find below a documented civic grievance requiring attention from ${category.departmentKey.replace('_', ' ')}:

                • Issue Category: ${category.displayName}
                • Observed On: $dateStr
                • Location: ${jurisdiction?.formattedAddress ?: "${location.latitude}, ${location.longitude}"} (GPS: ${location.latitude}, ${location.longitude})

                Details:
                $citizenDescription

                Attached Evidence Manifest:
                $evidenceBlock

                Addressed Authorities:
                $authorityBlock

                Requesting timely intervention and field inspection.

                Regards,
                $citizenName
            """.trimIndent()

            ComplaintFormat.CIVIC_CONCERN_REPORT -> """
                === CIVIC CONCERN FIELD REPORT ===
                Timestamp: $dateStr
                Category: ${category.displayName}
                Location:
                $locationText

                Field Observation:
                $citizenDescription

                Identified Authorities & Provenance:
                $authorityBlock

                Evidence Hashes:
                $evidenceBlock
            """.trimIndent()
        }

        return GeneratedComplaint(
            subject = subject,
            recipientSummary = authorities.mapNotNull { it.record.officialEmail }.joinToString(", "),
            body = body,
            disclaimer = "Note: CityFix prepares this structured complaint for your review. Sending via email or post does not automatically register a ticket in internal government ERPs unless acknowledged by the authority."
        )
    }
}
```

### 7. Module 6: Dedicated Disaster Management Domain & Safety Guidance (`domain/disaster/DisasterRepository.kt`)

```kotlin
package org.cityfix.android.domain.disaster

import kotlinx.serialization.Serializable

enum class DisasterScale {
    LOCAL_EMERGENCY,
    LARGE_SCALE_DISASTER
}

enum class DisasterCategory(val title: String, val scale: DisasterScale) {
    HOUSE_FIRE("House / Structural Fire", DisasterScale.LOCAL_EMERGENCY),
    SERIOUS_ACCIDENT("Serious Road / Industrial Accident", DisasterScale.LOCAL_EMERGENCY),
    MEDICAL_CPR("Medical / Cardiac (CPR) Emergency", DisasterScale.LOCAL_EMERGENCY),
    GAS_LEAK("LPG / Pipeline Gas Leak", DisasterScale.LOCAL_EMERGENCY),
    CHEMICAL_HAZARD("Chemical Spill / Toxic Fumes", DisasterScale.LOCAL_EMERGENCY),
    ELECTRICAL_HAZARD("Downed Power Line / Electrocution", DisasterScale.LOCAL_EMERGENCY),
    STRUCTURAL_COLLAPSE("Building / Bridge Collapse", DisasterScale.LOCAL_EMERGENCY),
    FALLING_TREES("Fallen Tree Blocking Access / Wires", DisasterScale.LOCAL_EMERGENCY),
    FLOODING_WATERLOGGING("Flash Flooding / Severe Waterlogging", DisasterScale.LOCAL_EMERGENCY),

    EARTHQUAKE("Earthquake", DisasterScale.LARGE_SCALE_DISASTER),
    TSUNAMI("Tsunami Warning", DisasterScale.LARGE_SCALE_DISASTER),
    CYCLONE("Cyclone / Hurricane", DisasterScale.LARGE_SCALE_DISASTER),
    SEVERE_STORM("Severe Thunderstorm / Squall", DisasterScale.LARGE_SCALE_DISASTER),
    LIGHTNING("Cloud-to-Ground Lightning", DisasterScale.LARGE_SCALE_DISASTER),
    LANDSLIDE("Landslide / Mudslide", DisasterScale.LARGE_SCALE_DISASTER),
    WILDFIRE("Wildfire / Forest Fire", DisasterScale.LARGE_SCALE_DISASTER),
    HEATWAVE("Extreme Heatwave", DisasterScale.LARGE_SCALE_DISASTER)
}

@Serializable
data class EmergencyHelpline(
    val serviceName: String,
    val phoneNumber: String,
    val scope: String, // e.g., "National Emergency Response Support System (ERSS)"
    val isVerifiedOfficial: Boolean,
    val sourceCitation: String
)

data class AuthoritativeSafetyGuide(
    val category: DisasterCategory,
    val immediateActions: List<String>,
    val strictDoNots: List<String>,
    val sourceAgency: String,
    val sourceUrl: String
)

/**
 * Provides verified national/regional emergency numbers and authoritative NDMA / Red Cross
 * safety protocols. Explicitly states that CityFix does NOT dispatch ambulances or rescue teams.
 */
class DisasterGuidanceProvider {

    fun getVerifiedNationalHelplines(): List<EmergencyHelpline> = listOf(
        EmergencyHelpline("All-in-One Emergency (Police, Fire, Ambulance)", "112", "India ERSS (National)", true, "https://112.gov.in"),
        EmergencyHelpline("Fire & Rescue Services", "101", "National Fire Service", true, "https://ndma.gov.in"),
        EmergencyHelpline("Medical Ambulance", "108", "National Ambulance Service", true, "https://nhm.gov.in"),
        EmergencyHelpline("Disaster Management / NDMA Helpline", "1078", "National Disaster Management Authority", true, "https://ndma.gov.in"),
        EmergencyHelpline("State / District Disaster Control Room", "1070 / 1077", "SDMA / DDMA Toll-Free", true, "https://ndma.gov.in")
    )

    fun getAuthoritativeGuide(category: DisasterCategory): AuthoritativeSafetyGuide = when (category) {
        DisasterCategory.MEDICAL_CPR -> AuthoritativeSafetyGuide(
            category = category,
            immediateActions = listOf(
                "Call 112 or 108 immediately and put phone on speaker.",
                "Check responsiveness and normal breathing for no more than 10 seconds.",
                "If unresponsive and not breathing normally, place hands on center of chest and push hard and fast (100–120 compressions/min, ~5 cm deep).",
                "Ask a bystander to locate an Automated External Defibrillator (AED) if available."
            ),
            strictDoNots = listOf(
                "Do not give food, water, or oral medication to an unresponsive person.",
                "Do not interrupt chest compressions for more than 10 seconds."
            ),
            sourceAgency = "Indian Red Cross Society / WHO Basic Emergency Care",
            sourceUrl = "https://indianredcross.org"
        )
        DisasterCategory.GAS_LEAK -> AuthoritativeSafetyGuide(
            category = category,
            immediateActions = listOf(
                "Extinguish all open flames immediately.",
                "Open all doors and windows to ventilate the area.",
                "Turn off the LPG regulator or main gas valve.",
                "Evacuate all occupants to open air and call emergency gas leak helpline / 112 from outside."
            ),
            strictDoNots = listOf(
                "DO NOT turn any electrical switches, fans, or lights ON or OFF (sparks can ignite gas).",
                "DO NOT use mobile phones or lighters inside the premises."
            ),
            sourceAgency = "National Disaster Management Authority (NDMA)",
            sourceUrl = "https://ndma.gov.in"
        )
        DisasterCategory.EARTHQUAKE -> AuthoritativeSafetyGuide(
            category = category,
            immediateActions = listOf(
                "DROP to your hands and knees.",
                "COVER your head and neck under a sturdy table or against an interior wall away from glass.",
                "HOLD ON until the shaking stops.",
                "If outdoors, move to an open area clear of buildings, trees, and overhead power lines."
            ),
            strictDoNots = listOf(
                "Do not use elevators.",
                "Do not run outside while debris is falling."
            ),
            sourceAgency = "National Disaster Management Authority (NDMA)",
            sourceUrl = "https://ndma.gov.in/Natural-Hazards/Earthquakes"
        )
        else -> AuthoritativeSafetyGuide(
            category = category,
            immediateActions = listOf(
                "Move immediately to a safe, elevated, or structurally sound location away from the hazard.",
                "Call 112 (National Emergency) or 1077 (District Disaster Control Room) to alert official responders.",
                "Monitor official broadcasts from NDMA SACHET or local District Collectorate."
            ),
            strictDoNots = listOf(
                "Do not touch fallen electrical wires or wade through moving floodwater.",
                "Do not rely on unverified social media rumors for evacuation orders."
            ),
            sourceAgency = "National Disaster Management Authority (NDMA)",
            sourceUrl = "https://ndma.gov.in"
        )
    }
}
```

### 8. Offline Persistence & Sync (`data/local/CityFixDatabase.kt` & `worker/ReportSyncWorker.kt`)

```kotlin
package org.cityfix.android.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "civic_reports")
data class CivicReportEntity(
    @PrimaryKey val id: String,
    val categoryName: String,
    val description: String,
    val latitude: Double,
    val longitude: Double,
    val jurisdictionJson: String?,
    val authoritiesJson: String?,
    val generatedDraftSubject: String,
    val generatedDraftBody: String,
    val evidenceJson: String,
    val syncState: String, // "DRAFT", "QUEUED_FOR_BACKUP", "ARCHIVED_LOCALLY"
    val createdAtEpoch: Long
)

@Dao
interface CivicReportDao {
    @Query("SELECT * FROM civic_reports ORDER BY createdAtEpoch DESC")
    fun observeAllReports(): Flow<List<CivicReportEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReport(report: CivicReportEntity)

    @Query("DELETE FROM civic_reports WHERE id = :reportId")
    suspend fun deleteReport(reportId: String)
}

@Database(entities = [CivicReportEntity::class], version = 1, exportSchema = false)
abstract class CityFixDatabase : RoomDatabase() {
    abstract fun civicReportDao(): CivicReportDao
}
```

### 9. Jetpack Compose Navigation & Core Screens (`ui/navigation/CityFixApp.kt`)

```kotlin
package org.cityfix.android.ui.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import org.cityfix.android.domain.disaster.DisasterCategory
import org.cityfix.android.domain.disaster.DisasterGuidanceProvider
import org.cityfix.android.domain.model.VerificationStatus
import org.cityfix.android.domain.model.VerifiedAuthority

sealed class Screen(val route: String, val label: String) {
    data object Home : Screen("home", "Home")
    data object Report : Screen("report", "Report Issue")
    data object Disaster : Screen("disaster", "Disaster")
    data object MyReports : Screen("my_reports", "My Reports")
    data object Profile : Screen("profile", "Profile")
}

@Composable
fun CityFixApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val navItems = listOf(
        Triple(Screen.Home, Icons.Default.Home, "Home"),
        Triple(Screen.Report, Icons.Default.AddCircle, "Report"),
        Triple(Screen.Disaster, Icons.Default.Warning, "Disaster"),
        Triple(Screen.MyReports, Icons.Default.Description, "Reports"),
        Triple(Screen.Profile, Icons.Default.Person, "Profile")
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                navItems.forEach { (screen, icon, label) ->
                    NavigationBarItem(
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(Screen.Home.route) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label) }
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    onStartCivicReport = { navController.navigate(Screen.Report.route) },
                    onOpenDisasterModule = { navController.navigate(Screen.Disaster.route) },
                    onViewReports = { navController.navigate(Screen.MyReports.route) }
                )
            }
            composable(Screen.Report.route) {
                CivicReportWizardScreen()
            }
            composable(Screen.Disaster.route) {
                DisasterManagementScreen()
            }
            composable(Screen.MyReports.route) {
                MyReportsScreen()
            }
            composable(Screen.Profile.route) {
                ProfileAndPrivacyScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onStartCivicReport: () -> Unit,
    onOpenDisasterModule: () -> Unit,
    onViewReports: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("CityFix", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(
                            "See the problem. Report it. Reach the responsible authority.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            )
        }
    ) { inner ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(inner)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Prominent Emergency Pathway (Distinct Visual Priority)
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Emergency & Disaster Response",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Access verified 112/101/108 emergency helplines, official disaster alerts, and authoritative safety protocols.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = onOpenDisasterModule,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Open Disaster & Emergency Module")
                        }
                    }
                }
            }

            // Primary Civic Reporting Action
            item {
                ElevatedCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Report Civic Infrastructure Issue",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Capture geotagged evidence, fetch live verified political & administrative officials for your ward, and draft an official complaint.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = onStartCivicReport, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Start Geotagged Civic Report")
                        }
                    }
                }
            }

            // Saved Reports Shortcut
            item {
                OutlinedCard(onClick = onViewReports, modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Saved Drafts & Dispatched Complaints", style = MaterialTheme.typography.titleSmall)
                            Text(
                                "Review offline drafts, evidence hashes, and authority provenance.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = "Open My Reports")
                    }
                }
            }
        }
    }
}

@Composable
fun AuthorityVerificationCard(verified: VerifiedAuthority) {
    val (badgeColor, badgeText) = when (verified.status) {
        VerificationStatus.VERIFIED -> Color(0xFF1B5E20) to "VERIFIED OFFICIAL"
        VerificationStatus.PARTIALLY_VERIFIED -> Color(0xFFE65100) to "PARTIALLY VERIFIED"
        VerificationStatus.STALE -> Color(0xFF6D4C41) to "CACHED / STALE"
        VerificationStatus.UNAVAILABLE -> Color(0xFFB71C1C) to "UNAVAILABLE"
    }

    OutlinedCard(
        border = BorderStroke(1.dp, badgeColor.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                AssistChip(
                    onClick = {},
                    label = { Text(verified.record.branch.name, style = MaterialTheme.typography.labelSmall) }
                )
                Text(
                    text = badgeText,
                    color = badgeColor,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(6.dp))
            Text(
                text = verified.record.fullName ?: "Incumbent Name Not Published",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${verified.record.designation} • ${verified.record.department}",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "Jurisdiction: ${verified.record.jurisdictionName}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(8.dp))
            verified.record.officialPhone?.let {
                Text("Official Phone: $it", style = MaterialTheme.typography.bodySmall)
            }
            verified.record.officialEmail?.let {
                Text("Official Email: $it", style = MaterialTheme.typography.bodySmall)
            }
            if (verified.record.officialPhone == null && verified.record.officialEmail == null) {
                Text(
                    "Direct phone/email not published by authoritative source.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text(
                text = "Provenance: ${verified.freshnessLabel} • Source: ${verified.record.sourceUrl ?: "None"}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            verified.verificationReasons.forEach { reason ->
                Text("• $reason", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DisasterManagementScreen() {
    val context = LocalContext.current
    val provider = remember { DisasterGuidanceProvider() }
    val helplines = remember { provider.getVerifiedNationalHelplines() }
    var selectedCategory by remember { mutableStateOf(DisasterCategory.FLOODING_WATERLOGGING) }
    val activeGuide = remember(selectedCategory) { provider.getAuthoritativeGuide(selectedCategory) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Disaster & Emergency Management") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    titleContentColor = MaterialTheme.colorScheme.onErrorContainer
                )
            )
        }
    ) { inner ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(inner)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Mandatory Transparency Notice
            item {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text(
                        text = "IMPORTANT: CityFix provides verified emergency contacts and authoritative safety guidance. CityFix does NOT directly dispatch ambulances, fire engines, or rescue teams. Always dial 112 or local emergency services immediately.",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Verified Emergency Helplines (One-tap Dialer Intent)
            item {
                Text("Verified Official Emergency Helplines", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            items(helplines) { helpline ->
                OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(helpline.serviceName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text("${helpline.scope} • Source: ${helpline.sourceCitation}", style = MaterialTheme.typography.labelSmall)
                        }
                        FilledTonalButton(
                            onClick = {
                                val dialNumber = helpline.phoneNumber.substringBefore("/").trim()
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$dialNumber"))
                                context.startActivity(intent)
                            }
                        ) {
                            Icon(Icons.Default.Call, contentDescription = null)
                            Spacer(Modifier.width(4.dp))
                            Text(helpline.phoneNumber)
                        }
                    }
                }
            }

            // Scenario-Specific Authoritative Safety Protocols
            item {
                Text("Authoritative Safety Protocols", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                ScrollableTabRow(
                    selectedTabIndex = DisasterCategory.entries.indexOf(selectedCategory),
                    edgePadding = 0.dp
                ) {
                    DisasterCategory.entries.forEach { cat ->
                        Tab(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            text = { Text(cat.title) }
                        )
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Immediate Verified Actions:", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        activeGuide.immediateActions.forEach { action ->
                            Text("✓ $action", style = MaterialTheme.typography.bodyMedium)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text("Critical Precautions (Do Not):", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                        activeGuide.strictDoNots.forEach { dont ->
                            Text("✕ $dont", style = MaterialTheme.typography.bodyMedium)
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                        Text(
                            "Authoritative Source: ${activeGuide.sourceAgency} (${activeGuide.sourceUrl})",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

// Placeholder composable signatures for the remaining screens wired into navigation
@Composable
fun CivicReportWizardScreen() {
    // Integrates MediaEvidenceManager, LocationTracker, Live Authority Repository, and ComplaintDraftGenerator
    // Displays interactive steps: 1. Evidence & Location -> 2. Live Verified Authorities -> 3. Editable Draft & Email/Share Dispatch
}

@Composable
fun MyReportsScreen() {
    // Observes CivicReportDao.observeAllReports() from Room DB with offline sync status and delete controls
}

@Composable
fun ProfileAndPrivacyScreen() {
    // Displays Phone OTP / Conditional WhatsApp Auth state, permission controls, and local data purge option
}
```

---

## PART 3: Backend Live Authority Retrieval & Verification Service (Kotlin / Ktor)

The Android app **never** scrapes government websites directly or stores API keys. Instead, it calls `/v1/authorities/resolve`, which performs GIS boundary lookup, queries authoritative government connectors, applies strict verification checks, and caches results with provenance metadata.

```kotlin
package org.cityfix.backend.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class AuthorityLookupResponse(
    val jurisdiction: JurisdictionDto,
    val authorities: List<AuthorityRecordDto>,
    val dataAvailabilityNotice: String?
)

@Serializable
data class JurisdictionDto(
    val state: String,
    val district: String,
    val localBodyType: String,
    val localBodyName: String,
    val wardNumber: String?,
    val wardName: String?,
    val assemblyConstituency: String?,
    val parliamentaryConstituency: String?,
    val formattedAddress: String
)

@Serializable
data class AuthorityRecordDto(
    val id: String,
    val branch: String, // "POLITICAL" | "ADMINISTRATIVE"
    val fullName: String?,
    val designation: String,
    val department: String,
    val jurisdictionName: String,
    val officialPhone: String?,
    val officialEmail: String?,
    val sourceUrl: String?,
    val lastVerifiedIso: String?,
    val isCurrentTermConfirmed: Boolean,
    val matchesJurisdiction: Boolean,
    val matchesDepartment: Boolean,
    val isContactFromOfficialDomain: Boolean
)

/**
 * Server-side orchestrator interface.
 * Implementations connect to official open-data APIs (data.gov.in, State LSGD portals, ECI).
 * If an authoritative source cannot be reached or lacks data, returns an empty list with
 * an explicit dataAvailabilityNotice rather than synthetic/hardcoded officials.
 */
interface AuthoritativeSourceConnector {
    suspend fun resolveJurisdiction(lat: Double, lon: Double): JurisdictionDto?
    suspend fun fetchPoliticalRepresentatives(jurisdiction: JurisdictionDto): List<AuthorityRecordDto>
    suspend fun fetchAdministrativeOfficials(jurisdiction: JurisdictionDto, categoryKey: String): List<AuthorityRecordDto>
}

fun Route.authorityRoutes(connector: AuthoritativeSourceConnector) {
    get("/v1/authorities/resolve") {
        val lat = call.request.queryParameters["lat"]?.toDoubleOrNull()
        val lon = call.request.queryParameters["lon"]?.toDoubleOrNull()
        val category = call.request.queryParameters["category"] ?: "GENERAL"

        if (lat == null || lon == null || lat !in -90.0..90.0 || lon !in -180.0..180.0) {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Valid latitude and longitude required"))
            return@get
        }

        val jurisdiction = connector.resolveJurisdiction(lat, lon)
        if (jurisdiction == null) {
            call.respond(
                HttpStatusCode.NotFound,
                mapOf("error" to "Unable to resolve administrative boundaries for the supplied coordinates.")
            )
            return@get
        }

        val political = connector.fetchPoliticalRepresentatives(jurisdiction)
        val administrative = connector.fetchAdministrativeOfficials(jurisdiction, category)
        val combined = political + administrative

        val notice = if (combined.isEmpty()) {
            "No machine-readable government directory is currently connected for ${jurisdiction.localBodyName}. " +
                "Please consult your official state local-self-government portal directly."
        } else {
            null
        }

        call.respond(
            HttpStatusCode.OK,
            AuthorityLookupResponse(
                jurisdiction = jurisdiction,
                authorities = combined,
                dataAvailabilityNotice = notice
            )
        )
    }
}
```