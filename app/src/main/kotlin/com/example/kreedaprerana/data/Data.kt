package com.example.kreedaprerana.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "athletes")
data class Athlete(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val age: Int,
    val primarySport: String
)

@Entity(
    tableName = "trials",
    foreignKeys = [ForeignKey(
        entity = Athlete::class,
        parentColumns = ["id"],
        childColumns = ["athleteId"],
        onDelete = ForeignKey.CASCADE
    )]
)
data class Trial(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val athleteId: Int,
    val trialType: String, // "Sprint", "Long Jump", etc.
    val value: Double, // seconds or meters
    val timestamp: Long = System.currentTimeMillis()
)

@Dao
interface SportsDao {
    @Query("SELECT * FROM athletes")
    fun getAllAthletes(): Flow<List<Athlete>>

    @Insert
    suspend fun insertAthlete(athlete: Athlete): Long

    @Insert
    suspend fun insertTrial(trial: Trial)

    @Query("SELECT * FROM trials WHERE athleteId = :athleteId ORDER BY timestamp DESC")
    fun getTrialsForAthlete(athleteId: Int): Flow<List<Trial>>

    @Query("""
        SELECT trials.* FROM trials 
        INNER JOIN (
            SELECT athleteId, MIN(value) as minVal 
            FROM trials 
            WHERE trialType = :trialType 
            GROUP BY athleteId
        ) bests ON trials.athleteId = bests.athleteId AND trials.value = bests.minVal
        WHERE trials.trialType = :trialType
        ORDER BY trials.value ASC 
        LIMIT 10
    """)
    fun getLeaderboard(trialType: String): Flow<List<Trial>>
}

@Database(entities = [Athlete::class, Trial::class], version = 1)
abstract class SportsDatabase : RoomDatabase() {
    abstract fun sportsDao(): SportsDao
}
