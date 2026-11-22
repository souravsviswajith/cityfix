package com.cityfix.android.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class IncidentLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float
)

class DeviceLocationProvider(private val context: Context) {
    @Suppress("MissingPermission")
    suspend fun currentLocation(): IncidentLocation? = withContext(Dispatchers.IO) {
        val fine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return@withContext null

        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = manager.getProviders(true)
        val lastKnown: Location? = providers.mapNotNull { provider ->
            runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
        }.maxByOrNull { it.time }

        lastKnown?.let {
            IncidentLocation(it.latitude, it.longitude, it.accuracy)
        }
    }
}
