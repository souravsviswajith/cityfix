package com.cityfix.android.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Incident::class], version = 1, exportSchema = false)
abstract class CityFixDatabase : RoomDatabase() {
    abstract fun incidentDao(): IncidentDao

    companion object {
        @Volatile private var instance: CityFixDatabase? = null

        fun get(context: Context): CityFixDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    CityFixDatabase::class.java,
                    "cityfix.db"
                ).build().also { instance = it }
            }
    }
}
