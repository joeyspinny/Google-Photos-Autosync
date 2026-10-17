package com.example.starredsync

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "synced_photos")
data class SyncedPhotoEntity(
    @PrimaryKey val mediaStoreId: Long,
    val fileName: String,
    val fileSizeBytes: Long,
    val driveFileId: String,
    val driveWebViewLink: String?,
    val cameraModel: String?,
    val syncedAtTimestamp: Long = System.currentTimeMillis()
)

@Dao
interface SyncedPhotoDao {
    @Query("SELECT * FROM synced_photos ORDER BY syncedAtTimestamp DESC")
    fun getAll(): Flow<List<SyncedPhotoEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM synced_photos WHERE mediaStoreId = :id)")
    suspend fun exists(id: Long): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(photo: SyncedPhotoEntity)

    @Query("SELECT COUNT(*) FROM synced_photos")
    fun count(): Flow<Int>

    @Query("SELECT COALESCE(SUM(fileSizeBytes), 0) FROM synced_photos")
    fun totalBytes(): Flow<Long>
}

@Database(entities = [SyncedPhotoEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun syncedPhotoDao(): SyncedPhotoDao

    companion object {
        @Volatile private var instance: AppDatabase? = null
        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "starred_sync.db"
                ).build().also { instance = it }
            }
    }
}

class SyncRepository(context: Context) {
    private val dao = AppDatabase.getInstance(context).syncedPhotoDao()

    fun getAllSyncedPhotos(): Flow<List<SyncedPhotoEntity>> = dao.getAll()

    suspend fun isPhotoAlreadySynced(mediaId: Long): Boolean = dao.exists(mediaId)

    suspend fun recordSyncedPhoto(
        mediaStoreId: Long,
        fileName: String,
        fileSizeBytes: Long,
        driveFileId: String,
        driveWebViewLink: String,
        cameraModel: String
    ) {
        dao.insert(
            SyncedPhotoEntity(
                mediaStoreId = mediaStoreId,
                fileName = fileName,
                fileSizeBytes = fileSizeBytes,
                driveFileId = driveFileId,
                driveWebViewLink = driveWebViewLink,
                cameraModel = cameraModel
            )
        )
    }
}
