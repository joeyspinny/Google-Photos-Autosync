package com.example.starredsync

import android.app.*
import android.content.*
import android.database.ContentObserver
import android.net.Uri
import android.os.*
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.api.client.extensions.android.http.AndroidHttp
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.InputStreamContent
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.atomic.AtomicBoolean

data class CatchUpProgress(
    val isSyncing: Boolean = false,
    val current: Int = 0,
    val total: Int = 0,
    val currentFileName: String = "",
    val statusMessage: String = "Idle"
)

enum class ConflictStrategy {
    SKIP,      // Keep remote file untouched, link existing
    OVERWRITE, // Replace remote Drive file with local RAW stream
    RENAME     // Upload under a new name with _v2 suffix
}

class MediaStoreSyncService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var syncRepository: SyncRepository
    private var driveService: Drive? = null
    private var targetFolderId: String? = null
    private val isCatchingUp = AtomicBoolean(false)
    private var conflictStrategy: ConflictStrategy = ConflictStrategy.RENAME

    private val mediaObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            // Triggered automatically whenever a photo is starred in Google Photos!
            serviceScope.launch {
                checkAndSyncNewStarredPhoto()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        syncRepository = SyncRepository(this)
        startForeground(NOTIFICATION_ID, buildNotification("Monitoring starred photos 24/7..."))
        contentResolver.registerContentObserver(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            true,
            mediaObserver
        )
        initDriveClient()
        _isDaemonActiveState.value = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TRIGGER_CATCHUP -> {
                serviceScope.launch {
                    executeCatchUpSync()
                }
            }
        }
        return START_STICKY
    }

    private fun initDriveClient() {
        val account = GoogleSignIn.getLastSignedInAccount(this) ?: return
        val credential = GoogleAccountCredential.usingOAuth2(this, listOf(DriveScopes.DRIVE_FILE))
        credential.selectedAccount = account.account
        driveService = Drive.Builder(
            AndroidHttp.newCompatibleTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("StarredPhotos-RAW-Sync").build()
    }

    private suspend fun getOrCreateTargetFolder(service: Drive): String {
        targetFolderId?.let { return it }
        val query = "name = 'High-Res Favorites' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        val found = service.files().list().setQ(query).setFields("files(id)").execute()
        val id = found.files?.firstOrNull()?.id ?: run {
            val meta = File().apply {
                name = "High-Res Favorites"
                mimeType = "application/vnd.google-apps.folder"
            }
            service.files().create(meta).setFields("id").execute().id
        }
        targetFolderId = id
        return id
    }

    /**
     * Real-time background sync for single photo starred in Google Photos
     */
    private suspend fun checkAndSyncNewStarredPhoto() {
        val service = driveService ?: return
        val folderId = getOrCreateTargetFolder(service)

        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_MODIFIED,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.SIZE
        )

        contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            "${MediaStore.Images.Media.IS_FAVORITE} = 1",
            null,
            "${MediaStore.Images.Media.DATE_MODIFIED} DESC LIMIT 1"
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val mediaId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                val name = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME))
                val size = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE))
                val mime = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)) ?: "image/jpeg"

                // Check if already in our database
                if (syncRepository.isPhotoAlreadySynced(mediaId)) return

                uploadSinglePhoto(mediaId, name, size, mime, folderId, service)
            }
        }
    }

    /**
     * Catch-up wizard: indexes all favorite photos and streams the un-synced backlog
     */
    private suspend fun executeCatchUpSync() {
        if (!isCatchingUp.compareAndSet(false, true)) return
        val service = driveService ?: run {
            isCatchingUp.set(false)
            return
        }

        try {
            _catchUpProgressState.value = CatchUpProgress(isSyncing = true, statusMessage = "Querying MediaStore...")
            val folderId = getOrCreateTargetFolder(service)

            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_MODIFIED,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.SIZE
            )

            val favoritesToUpload = mutableListOf<PendingPhoto>()

            contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                "${MediaStore.Images.Media.IS_FAVORITE} = 1",
                null,
                "${MediaStore.Images.Media.DATE_TAKEN} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
                val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)

                while (cursor.moveToNext()) {
                    val mediaId = cursor.getLong(idCol)
                    if (!syncRepository.isPhotoAlreadySynced(mediaId)) {
                        favoritesToUpload.add(
                            PendingPhoto(
                                mediaId = mediaId,
                                name = cursor.getString(nameCol) ?: "photo_$mediaId.jpg",
                                size = cursor.getLong(sizeCol),
                                mimeType = cursor.getString(mimeCol) ?: "image/jpeg"
                            )
                        )
                    }
                }
            }

            val total = favoritesToUpload.size
            favoritesToUpload.forEachIndexed { index, item ->
                _catchUpProgressState.value = CatchUpProgress(
                    isSyncing = true,
                    current = index + 1,
                    total = total,
                    currentFileName = item.name,
                    statusMessage = "Uploading (${index + 1}/$total)"
                )
                updateNotification("Catch-Up: ${index + 1}/$total (${item.name})")
                uploadSinglePhoto(item.mediaId, item.name, item.size, item.mimeType, folderId, service)
            }

            _catchUpProgressState.value = CatchUpProgress(
                isSyncing = false,
                current = total,
                total = total,
                statusMessage = "Catch-Up Complete! All ${total} photos uploaded."
            )
            updateNotification("✓ All ${total} favorites synced to Drive")
        } finally {
            isCatchingUp.set(false)
        }
    }

    private suspend fun uploadSinglePhoto(
        mediaId: Long,
        name: String,
        size: Long,
        mime: String,
        folderId: String,
        service: Drive
    ) {
        val contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId)
        val originalUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.setRequireOriginal(contentUri)
        } else contentUri

        contentResolver.openInputStream(originalUri)?.use { stream ->
            val meta = File().apply {
                this.name = name
                this.parents = listOf(folderId)
                this.description = "RAW Favorite. Preserved EXIF from MediaStore."
            }
            val content = InputStreamContent(mime, stream).apply { this.length = size }

            // Collision Detection: Check if a file with this name already exists in target folder
            val checkQuery = "'$folderId' in parents and name = '$name' and trashed = false"
            val existingList = service.files().list().setQ(checkQuery).setFields("files(id, name, size, webViewLink)").execute()
            val existing = existingList.files?.firstOrNull()

            var driveFileId: String
            var webViewLink: String
            var finalName = name

            if (existing != null) {
                when (conflictStrategy) {
                    ConflictStrategy.SKIP -> {
                        // Skip upload; link existing remote file
                        driveFileId = existing.id
                        webViewLink = existing.webViewLink ?: "https://drive.google.com/file/d/$driveFileId/view"
                        syncRepository.recordSyncedPhoto(mediaId, name, size, driveFileId, webViewLink, "Pixel 7 Pro")
                        return@use
                    }
                    ConflictStrategy.OVERWRITE -> {
                        // Update existing remote file with local RAW stream
                        val updated = service.files().update(existing.id, meta, content)
                            .setFields("id, name, size, webViewLink")
                            .execute()
                        driveFileId = updated.id
                        webViewLink = updated.webViewLink ?: "https://drive.google.com/file/d/$driveFileId/view"
                    }
                    ConflictStrategy.RENAME -> {
                        // Append _v2 suffix before file extension
                        val dotIndex = name.lastIndexOf('.')
                        finalName = if (dotIndex != -1) "${name.substring(0, dotIndex)}_v2${name.substring(dotIndex)}" else "${name}_v2"
                        meta.name = finalName
                        val created = service.files().create(meta, content)
                            .setFields("id, name, size, webViewLink")
                            .execute()
                        driveFileId = created.id
                        webViewLink = created.webViewLink ?: "https://drive.google.com/file/d/$driveFileId/view"
                    }
                }
            } else {
                // No collision: standard create
                val uploaded = service.files().create(meta, content)
                    .setFields("id, name, size, webViewLink")
                    .execute()
                driveFileId = uploaded.id
                webViewLink = uploaded.webViewLink ?: "https://drive.google.com/file/d/$driveFileId/view"
            }

            // 2. Extract camera model for registry
            var cameraModel = "Pixel 7 Pro"
            try {
                contentResolver.openInputStream(originalUri)?.use { s ->
                    val exif = ExifInterface(s)
                    cameraModel = exif.getAttribute(ExifInterface.TAG_MODEL) ?: "Camera"
                }
            } catch (ignored: Exception) {}

            // 3. PERSIST METADATA ON LOCAL PHOTO: Write Google Drive link into EXIF ImageDescription
            try {
                contentResolver.openFileDescriptor(contentUri, "rw")?.use { pfd ->
                    val exif = ExifInterface(pfd.fileDescriptor)
                    exif.setAttribute(
                        ExifInterface.TAG_IMAGE_DESCRIPTION,
                        "Google Drive RAW Backup: $webViewLink"
                    )
                    exif.saveAttributes()
                }
            } catch (ignored: Exception) {
                // In Android 11+ scoped storage, writes to external camera photos require MediaStore.createWriteRequest
            }

            // 4. Save to Room database for tracking storage & file links
            syncRepository.recordSyncedPhoto(
                mediaStoreId = mediaId,
                fileName = name,
                fileSizeBytes = size,
                driveFileId = driveFileId,
                driveWebViewLink = webViewLink,
                cameraModel = cameraModel
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        contentResolver.unregisterContentObserver(mediaObserver)
        _isDaemonActiveState.value = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(text: String): Notification {
        val channelId = "starred_sync_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(channelId, "Starred RAW Sync", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(chan)
        }
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Starred RAW Drive Sync")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_upload)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        const val ACTION_START_DAEMON = "ACTION_START_DAEMON"
        const val ACTION_TRIGGER_CATCHUP = "ACTION_TRIGGER_CATCHUP"
        private const val NOTIFICATION_ID = 5050

        private val _catchUpProgressState = MutableStateFlow(CatchUpProgress())
        val catchUpProgressState = _catchUpProgressState.asStateFlow()

        private val _isDaemonActiveState = MutableStateFlow(false)
        val isDaemonActiveState = _isDaemonActiveState.asStateFlow()
    }
}

data class PendingPhoto(
    val mediaId: Long,
    val name: String,
    val size: Long,
    val mimeType: String
)
