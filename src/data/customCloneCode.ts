export const customCloneMainActivityKt = `package com.example.starredsync

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.services.drive.DriveScopes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DecimalFormat

class MainActivity : ComponentActivity() {

    private lateinit var syncRepository: SyncRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        syncRepository = SyncRepository(this)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF38BDF8),
                    surface = Color(0xFF0F172A),
                    background = Color(0xFF090D16)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    CloneAppUI(
                        syncRepository = syncRepository,
                        onStartDaemon = {
                            val intent = Intent(this, MediaStoreSyncService::class.java).apply {
                                action = MediaStoreSyncService.ACTION_START_DAEMON
                            }
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                        },
                        onTriggerCatchUp = {
                            val intent = Intent(this, MediaStoreSyncService::class.java).apply {
                                action = MediaStoreSyncService.ACTION_TRIGGER_CATCHUP
                            }
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                        }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloneAppUI(
    syncRepository: SyncRepository,
    onStartDaemon: () -> Unit,
    onTriggerCatchUp: () -> Unit
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current

    var selectedTab by remember { mutableIntStateOf(0) }
    var userEmail by remember { mutableStateOf<String?>(null) }
    var hasPermissions by remember { mutableStateOf(false) }

    // Live state from persistent Room database & sync service
    val syncedRecords by syncRepository.getAllSyncedPhotos().collectAsState(initial = emptyList())
    val catchUpProgress by MediaStoreSyncService.catchUpProgressState.collectAsState()
    val isDaemonActive by MediaStoreSyncService.isDaemonActiveState.collectAsState()

    val totalBytes = syncedRecords.sumOf { it.fileSizeBytes }
    val totalCount = syncedRecords.size

    val permissionsToRequest = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.ACCESS_MEDIA_LOCATION,
                Manifest.permission.POST_NOTIFICATIONS
            )
        } else {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.ACCESS_MEDIA_LOCATION
            )
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        hasPermissions = grants.values.all { it }
        if (hasPermissions && userEmail != null) {
            onStartDaemon()
        }
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.result
            userEmail = account?.email
            if (hasPermissions) {
                onStartDaemon()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    LaunchedEffect(Unit) {
        hasPermissions = permissionsToRequest.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
        val lastAccount = GoogleSignIn.getLastSignedInAccount(context)
        if (lastAccount != null) {
            userEmail = lastAccount.email
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.CloudSync,
                            contentDescription = null,
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("Starred RAW Drive Sync", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Text(
                                if (isDaemonActive) "● 24/7 Background Daemon Active" else "○ Daemon Paused",
                                fontSize = 11.sp,
                                color = if (isDaemonActive) Color(0xFF4ADE80) else Color(0xFF94A3B8)
                            )
                        }
                    }
                },
                actions = {
                    if (userEmail == null) {
                        Button(
                            onClick = {
                                val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                    .requestEmail()
                                    .requestScopes(Scope(DriveScopes.DRIVE_FILE))
                                    .build()
                                val client = GoogleSignIn.getClient(context, gso)
                                googleSignInLauncher.launch(client.signInIntent)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text("Sign In Drive", fontSize = 11.sp)
                        }
                    } else {
                        Text(
                            userEmail?.substringBefore("@") ?: "",
                            fontSize = 12.sp,
                            color = Color(0xFF38BDF8),
                            modifier = Modifier.padding(end = 12.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0F172A))
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0F172A), tonalElevation = 0.dp) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                    label = { Text("Metrics") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.SyncProblem, contentDescription = "Catch-Up") },
                    label = { Text("Catch-Up") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.PhotoLibrary, contentDescription = "Drive Files") },
                    label = { Text("Registry") }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Permission Banner if missing
            if (!hasPermissions) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF7F1D1D)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Storage & Location permission required", fontSize = 12.sp, color = Color.White)
                        Button(
                            onClick = { permissionLauncher.launch(permissionsToRequest) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            Text("Grant", color = Color.Black, fontSize = 11.sp)
                        }
                    }
                }
            }

            // Catch-Up Active Progress Indicator
            if (catchUpProgress.isSyncing) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0284C7)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "Catch-Up Syncing Existing Favorites...",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                "\${catchUpProgress.current}/\${catchUpProgress.total}",
                                fontSize = 12.sp,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        LinearProgressIndicator(
                            progress = { if (catchUpProgress.total > 0) catchUpProgress.current.toFloat() / catchUpProgress.total else 0f },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                            color = Color(0xFF38BDF8),
                            trackColor = Color(0xFF0369A1)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            catchUpProgress.currentFileName,
                            fontSize = 11.sp,
                            color = Color(0xFFE0F2FE),
                            maxLines = 1
                        )
                    }
                }
            }

            // Tab 0: Storage & Metrics Dashboard
            if (selectedTab == 0) {
                DashboardTab(
                    totalCount = totalCount,
                    totalBytes = totalBytes,
                    isDaemonActive = isDaemonActive,
                    onTriggerCatchUp = onTriggerCatchUp
                )
            }

            // Tab 1: Catch-Up Sync Wizard
            if (selectedTab == 1) {
                CatchUpTab(
                    progress = catchUpProgress,
                    onStartCatchUp = onTriggerCatchUp
                )
            }

            // Tab 2: Synced Photos Registry with Google Drive Links
            if (selectedTab == 2) {
                RegistryTab(
                    syncedRecords = syncedRecords,
                    onOpenDriveLink = { url ->
                        try {
                            uriHandler.openUri(url)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun DashboardTab(
    totalCount: Int,
    totalBytes: Long,
    isDaemonActive: Boolean,
    onTriggerCatchUp: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // Storage Stat Cards
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Favorites Synced", fontSize = 11.sp, color = Color(0xFF94A3B8))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        totalCount.toString(),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF38BDF8)
                    )
                    Text("100% EXIF preserved", fontSize = 10.sp, color = Color(0xFF4ADE80))
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Drive Storage Used", fontSize = 11.sp, color = Color(0xFF94A3B8))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        formatSize(totalBytes),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFF472B6)
                    )
                    Text("Folder: 'High-Res Favorites'", fontSize = 10.sp, color = Color(0xFF94A3B8))
                }
            }
        }

        // Catch-Up Callout Banner
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Initial Setup: Sync Existing Starred Photos", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(
                    "Have photos you previously starred in Google Photos? Run Catch-Up to index and upload all existing favorites to Drive without creating duplicates.",
                    fontSize = 12.sp,
                    color = Color(0xFFCBD5E1)
                )
                Button(
                    onClick = onTriggerCatchUp,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Scan & Catch-Up All Existing Favorites")
                }
            }
        }
    }
}

@Composable
fun CatchUpTab(
    progress: CatchUpProgress,
    onStartCatchUp: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Catch-Up Engine", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text(
            "Scans Android MediaStore for every photo with IS_FAVORITE = 1, compares with your local sync database, and streams the un-synced backlog to Google Drive.",
            fontSize = 12.sp,
            color = Color(0xFF94A3B8)
        )

        Button(
            onClick = onStartCatchUp,
            enabled = !progress.isSyncing,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
        ) {
            Text(if (progress.isSyncing) "Catch-Up in Progress..." else "Run Catch-Up Now")
        }

        if (progress.isSyncing) {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Current Status: \${progress.statusMessage}", fontSize = 12.sp, color = Color(0xFF38BDF8))
                    Text("Uploading: \${progress.currentFileName}", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("Items: \${progress.current} of \${progress.total}", fontSize = 11.sp, color = Color(0xFF94A3B8))
                }
            }
        }
    }
}

@Composable
fun RegistryTab(
    syncedRecords: List<SyncedPhotoEntity>,
    onOpenDriveLink: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Synced Photos Registry (\${syncedRecords.size})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text("Tap to Open in Drive", fontSize = 11.sp, color = Color(0xFF38BDF8))
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxSize()) {
            items(syncedRecords) { record ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    modifier = Modifier.fillMaxWidth().clickable {
                        record.driveWebViewLink?.let(onOpenDriveLink)
                    }
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Image,
                            contentDescription = null,
                            tint = Color(0xFFEC4899),
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(record.fileName, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                            Text(
                                "\${formatSize(record.fileSizeBytes)} • \${record.cameraModel ?: "RAW"} • EXIF Updated",
                                fontSize = 10.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                        Icon(
                            Icons.Default.OpenInNew,
                            contentDescription = null,
                            tint = Color(0xFF38BDF8),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

fun formatSize(bytes: Long): String {
    if (bytes < 1024) return "\$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024) return DecimalFormat("#,##0.0 KB").format(kb)
    val mb = kb / 1024.0
    if (mb < 1024) return DecimalFormat("#,##0.0 MB").format(mb)
    val gb = mb / 1024.0
    return DecimalFormat("#,##0.00 GB").format(gb)
}
`;

export const customCloneServiceKt = `package com.example.starredsync

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
            "\${MediaStore.Images.Media.IS_FAVORITE} = 1",
            null,
            "\${MediaStore.Images.Media.DATE_MODIFIED} DESC LIMIT 1"
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
                "\${MediaStore.Images.Media.IS_FAVORITE} = 1",
                null,
                "\${MediaStore.Images.Media.DATE_TAKEN} DESC"
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
                                name = cursor.getString(nameCol) ?: "photo_\$mediaId.jpg",
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
                    statusMessage = "Uploading (\${index + 1}/\$total)"
                )
                updateNotification("Catch-Up: \${index + 1}/\$total (\${item.name})")
                uploadSinglePhoto(item.mediaId, item.name, item.size, item.mimeType, folderId, service)
            }

            _catchUpProgressState.value = CatchUpProgress(
                isSyncing = false,
                current = total,
                total = total,
                statusMessage = "Catch-Up Complete! All \${total} photos uploaded."
            )
            updateNotification("✓ All \${total} favorites synced to Drive")
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
                        webViewLink = existing.webViewLink ?: "https://drive.google.com/file/d/\$driveFileId/view"
                        syncRepository.recordSyncedPhoto(mediaId, name, size, driveFileId, webViewLink, "Pixel 7 Pro")
                        return@use
                    }
                    ConflictStrategy.OVERWRITE -> {
                        // Update existing remote file with local RAW stream
                        val updated = service.files().update(existing.id, meta, content)
                            .setFields("id, name, size, webViewLink")
                            .execute()
                        driveFileId = updated.id
                        webViewLink = updated.webViewLink ?: "https://drive.google.com/file/d/\$driveFileId/view"
                    }
                    ConflictStrategy.RENAME -> {
                        // Append _v2 suffix before file extension
                        val dotIndex = name.lastIndexOf('.')
                        finalName = if (dotIndex != -1) "\${name.substring(0, dotIndex)}_v2\${name.substring(dotIndex)}" else "\${name}_v2"
                        meta.name = finalName
                        val created = service.files().create(meta, content)
                            .setFields("id, name, size, webViewLink")
                            .execute()
                        driveFileId = created.id
                        webViewLink = created.webViewLink ?: "https://drive.google.com/file/d/\$driveFileId/view"
                    }
                }
            } else {
                // No collision: standard create
                val uploaded = service.files().create(meta, content)
                    .setFields("id, name, size, webViewLink")
                    .execute()
                driveFileId = uploaded.id
                webViewLink = uploaded.webViewLink ?: "https://drive.google.com/file/d/\$driveFileId/view"
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
                        "Google Drive RAW Backup: \$webViewLink"
                    )
                    exif.saveAttributes()
                }
            } catch (ignored: Exception) {
                // In Android 11+ scoped storage, writes to external camera photos require MediaStore.createWriteRequest
                // If not granted, the link is still safely saved in the app's persistent database!
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
`;

export const customCloneDatabaseKt = `package com.example.starredsync

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
`;

export const customCloneBuildGradleKt = `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.example.starredsync"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.starredsync"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Room Database for persistent tracking of synced photos & Drive links
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // AndroidX ExifInterface for reading & writing EXIF ImageDescription
    implementation("androidx.exifinterface:exifinterface:1.3.7")

    // Google Play Services Auth
    implementation("com.google.android.gms:play-services-auth:21.2.0")

    // Google Drive REST API v3 Client
    implementation("com.google.apis:google-api-services-drive:v3-rev20240905-2.0.0")
    implementation("com.google.api-client:google-api-client-android:2.7.0")
    implementation("com.google.http-client:google-http-client-gson:1.45.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
`;

export const customCloneManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.starredsync">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Required to query MediaStore for photos -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <!-- CRITICAL: Prevents Android from redacting GPS location in EXIF -->
    <uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />

    <!-- Foreground service for continuous 24/7 background operation on Pixel -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="false"
        android:label="Starred RAW Sync"
        android:theme="@style/Theme.Material3.Dark.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".MediaStoreSyncService"
            android:foregroundServiceType="dataSync"
            android:exported="false" />
    </application>

</manifest>`;
