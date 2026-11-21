package com.cityfix.android.data

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class IncidentCategory(val label: String) {
    MEDICAL("Medical"),
    FIRE("Fire"),
    FLOOD("Flood"),
    ACCIDENT("Road accident"),
    STRUCTURAL("Structural danger"),
    OTHER("Other")
}

enum class DeliveryState {
    QUEUED, RELAYED, RECEIVED, ACKNOWLEDGED
}

@Entity(tableName = "incidents")
data class Incident(
    @PrimaryKey val id: String,
    val category: String,
    val description: String,
    val latitude: Double?,
    val longitude: Double?,
    val accuracyMeters: Float?,
    val createdAtEpochMs: Long,
    val deliveryState: String = DeliveryState.QUEUED.name,
    val isTest: Boolean = false
)
