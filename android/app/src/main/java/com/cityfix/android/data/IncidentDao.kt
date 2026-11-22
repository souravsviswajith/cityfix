package com.cityfix.android.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface IncidentDao {
    @Query("SELECT * FROM incidents ORDER BY createdAtEpochMs DESC")
    fun observeAll(): Flow<List<Incident>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(incident: Incident)

    @Query("UPDATE incidents SET deliveryState = :state WHERE id = :id")
    suspend fun updateDeliveryState(id: String, state: String)
}
