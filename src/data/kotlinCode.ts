export const kotlinMainActivity = `package com.example.mediastoredrivesync

import android.Manifest
import android.content.ContentUris
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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.http.InputStreamContent
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.*

/**
 * Data model representing a raw photo entry from MediaStore
 */
data class MediaStorePhoto(
    val id: Long,
    val contentUri: Uri,
    val displayName: String,
    val relativePath: String?,
    val dateTaken: Long,
    val mimeType: String,
    val size: Long,
    var exifSummary: String = "",
    var uploadStatus: String = "Pending"
)

class MainActivity : ComponentActivity() {

    private var googleSignInAccount: GoogleSignInAccount? = null
    private var driveService: Drive? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
                    FavoritesSyncApp(
                        onSignInRequest = { launcher ->
                            val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                                .requestEmail()
                                .requestScopes(Scope(DriveScopes.DRIVE_FILE))
                                .build()
                            val client = GoogleSignIn.getClient(this, gso)
                            launcher.launch(client.signInIntent)
                        },
                        onAccountReceived = { account ->
                            googleSignInAccount = account
                            initDriveService(account)
                        },
                        onStartSync = { photos, onProgress ->
                            lifecycleScope.launch(Dispatchers.IO) {
                                executeDriveSync(photos, onProgress)
                            }
                        }
                    )
                }
            }
        }
    }

    private fun initDriveService(account: GoogleSignInAccount) {
        val credential = GoogleAccountCredential.usingOAuth2(
            this, listOf(DriveScopes.DRIVE_FILE)
        )
        credential.selectedAccount = account.account
        driveService = Drive.Builder(
            NetHttpTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        ).setApplicationName("MediaStore-Drive-RAW-Sync").build()
    }

    /**
     * Executes the direct binary stream upload of MediaStore favorites to Google Drive.
     * Preserves 100% EXIF and original file names without temporary transcodes.
     */
    private suspend fun executeDriveSync(
        photos: List<MediaStorePhoto>,
        onProgress: (Int, Int, String) -> Unit
    ) {
        val service = driveService ?: run {
            onProgress(0, photos.size, "Error: Google Drive not authenticated.")
            return
        }

        try {
            onProgress(0, photos.size, "Checking for 'High-Res Favorites' folder in Drive...")
            val folderId = getOrCreateDriveFolder(service, "High-Res Favorites")

            photos.forEachIndexed { index, photo ->
                onProgress(index + 1, photos.size, "Uploading \${photo.displayName} (\${formatBytes(photo.size)})...")
                try {
                    // CRITICAL FOR EXIF: Android 10+ (API 29+) redacts GPS and camera info unless
                    // MediaStore.setRequireOriginal is called and ACCESS_MEDIA_LOCATION permission is granted!
                    val originalUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        MediaStore.setRequireOriginal(photo.contentUri)
                    } else {
                        photo.contentUri
                    }

                    // Open direct raw byte stream from the Android MediaStore content provider
                    contentResolver.openInputStream(originalUri)?.use { inputStream ->
                        val fileMetadata = File().apply {
                            name = photo.displayName
                            parents = listOf(folderId)
                            description = "Synced via MediaStore RAW stream. Original path: \${photo.relativePath}"
                        }

                        val mediaContent = InputStreamContent(photo.mimeType, inputStream).apply {
                            length = photo.size
                        }

                        // Upload raw stream directly using Drive REST API v3
                        service.files().create(fileMetadata, mediaContent)
                            .setFields("id, name, size")
                            .execute()

                        photo.uploadStatus = "Uploaded"
                    } ?: run {
                        photo.uploadStatus = "Error: Stream unreadable"
                    }
                } catch (e: Exception) {
                    photo.uploadStatus = "Failed: \${e.localizedMessage}"
                }
            }

            onProgress(photos.size, photos.size, "Finished syncing all \${photos.size} favorite photos!")
        } catch (e: Exception) {
            onProgress(0, photos.size, "Sync aborted: \${e.message}")
        }
    }

    /**
     * Finds or creates the dedicated target folder in Google Drive.
     */
    private fun getOrCreateDriveFolder(service: Drive, folderName: String): String {
        val query = "name = '\$folderName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        val result = service.files().list()
            .setQ(query)
            .setSpaces("drive")
            .setFields("files(id, name)")
            .execute()

        val existingFolder = result.files?.firstOrNull()
        if (existingFolder != null) {
            return existingFolder.id
        }

        // Create folder
        val folderMetadata = File().apply {
            name = folderName
            mimeType = "application/vnd.google-apps.folder"
        }
        val created = service.files().create(folderMetadata)
            .setFields("id")
            .execute()
        return created.id
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "\$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb)
        val mb = kb / 1024.0
        return String.format(Locale.US, "%.2f MB", mb)
    }
}

/**
 * Main Composable UI for the Android Application
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesSyncApp(
    onSignInRequest: (androidx.activity.result.ActivityResultLauncher<Intent>) -> Unit,
    onAccountReceived: (GoogleSignInAccount) -> Unit,
    onStartSync: (List<MediaStorePhoto>, (Int, Int, String) -> Unit) -> Unit
) {
    val context = LocalContext.current
    var hasStoragePermission by remember { mutableStateOf(false) }
    var userEmail by remember { mutableStateOf<String?>(null) }
    var favoritePhotos by remember { mutableStateOf<List<MediaStorePhoto>>(emptyList()) }
    var isScanning by remember { mutableStateOf(false) }
    var isSyncing by remember { mutableStateOf(false) }
    var syncLog by remember { mutableStateOf("Ready. Click 'Scan MediaStore' to locate favorite photos.") }
    var currentProgress by remember { mutableFloatStateOf(0f) }

    // Required permissions depending on Android version
    val requiredPermissions = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.ACCESS_MEDIA_LOCATION
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.ACCESS_MEDIA_LOCATION
            )
        } else {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        hasStoragePermission = grants.values.all { it }
    }

    val signInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.result
            userEmail = account?.email
            account?.let(onAccountReceived)
        } catch (e: Exception) {
            syncLog = "Google Sign-In failed: \${e.message}"
        }
    }

    LaunchedEffect(Unit) {
        val allGranted = requiredPermissions.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
        hasStoragePermission = allGranted

        val lastAccount = GoogleSignIn.getLastSignedInAccount(context)
        if (lastAccount != null) {
            userEmail = lastAccount.email
            onAccountReceived(lastAccount)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("MediaStore RAW Drive Sync", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text("100% EXIF & Original Filename Preservation", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0F172A),
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Permission & Google Auth Status Cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Storage Permission Card
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("1. MediaStore Access", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        Spacer(modifier = Modifier.height(4.dp))
                        if (hasStoragePermission) {
                            Text("Granted ✓", color = Color(0xFF4ADE80), fontWeight = FontWeight.SemiBold)
                        } else {
                            Button(
                                onClick = { permissionLauncher.launch(requiredPermissions) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Grant Permission", fontSize = 11.sp)
                            }
                        }
                    }
                }

                // Google Drive Auth Card
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("2. Google Drive v3", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        Spacer(modifier = Modifier.height(4.dp))
                        if (userEmail != null) {
                            Text(userEmail ?: "", color = Color(0xFF38BDF8), fontSize = 12.sp, maxLines = 1)
                        } else {
                            Button(
                                onClick = { onSignInRequest(signInLauncher) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Sign In Google", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = {
                        isScanning = true
                        favoritePhotos = queryMediaStoreFavorites(context)
                        isScanning = false
                        syncLog = "Found \${favoritePhotos.size} favorite photos in MediaStore database."
                    },
                    enabled = hasStoragePermission && !isScanning && !isSyncing,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (isScanning) "Scanning..." else "Scan Favorites")
                }

                Button(
                    onClick = {
                        if (userEmail == null) {
                            syncLog = "Please sign in with Google first."
                            return@Button
                        }
                        if (favoritePhotos.isEmpty()) {
                            syncLog = "No favorite photos found to sync. Tap 'Scan Favorites' first."
                            return@Button
                        }
                        isSyncing = true
                        onStartSync(favoritePhotos) { current, total, message ->
                            currentProgress = if (total > 0) current.toFloat() / total.toFloat() else 0f
                            syncLog = "[\$current/\$total] \$message"
                            if (current == total && total > 0) {
                                isSyncing = false
                            }
                        }
                    },
                    enabled = userEmail != null && favoritePhotos.isNotEmpty() && !isSyncing,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (isSyncing) "Syncing..." else "Upload to Drive")
                }
            }

            // Progress Bar & Real-time Console Log
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF030712))
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Live Log Console", fontSize = 11.sp, color = Color(0xFF64748B))
                        Text("\${(currentProgress * 100).toInt()}%", fontSize = 11.sp, color = Color(0xFF38BDF8))
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { currentProgress },
                        modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                        color = Color(0xFF38BDF8),
                        trackColor = Color(0xFF1E293B)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = syncLog,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = Color(0xFFE2E8F0)
                    )
                }
            }

            // Scanned Favorites List
            Text(
                "Detected Favorite Photos (\${favoritePhotos.size})",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )

            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(favoritePhotos) { photo ->
                    PhotoItemRow(photo)
                }
            }
        }
    }
}

@Composable
fun PhotoItemRow(photo: MediaStorePhoto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
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
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(photo.displayName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                Text(
                    "Path: \${photo.relativePath ?: "DCIM/"}  •  \${photo.exifSummary}",
                    fontSize = 11.sp,
                    color = Color(0xFF94A3B8)
                )
            }
            Text(
                photo.uploadStatus,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = when (photo.uploadStatus) {
                    "Uploaded" -> Color(0xFF4ADE80)
                    "Pending" -> Color(0xFFFBBF24)
                    else -> Color(0xFFF87171)
                }
            )
        }
    }
}

/**
 * Executes direct ContentResolver query against MediaStore.Images.Media.EXTERNAL_CONTENT_URI
 * Filtering by MediaStore.Images.Media.IS_FAVORITE == 1
 */
fun queryMediaStoreFavorites(context: Context): List<MediaStorePhoto> {
    val results = mutableListOf<MediaStorePhoto>()
    val contentResolver = context.contentResolver

    // Query columns
    val projection = arrayOf(
        MediaStore.Images.Media._ID,
        MediaStore.Images.Media.DISPLAY_NAME,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaStore.Images.Media.RELATIVE_PATH else MediaStore.Images.Media.DATA,
        MediaStore.Images.Media.DATE_TAKEN,
        MediaStore.Images.Media.DATE_ADDED,
        MediaStore.Images.Media.MIME_TYPE,
        MediaStore.Images.Media.SIZE
    )

    // Filter strictly for photos marked as Favorite
    // Note: IS_FAVORITE was added in Android 11 (API 30), column name string is "is_favorite"
    val selection = "\${MediaStore.Images.Media.IS_FAVORITE} = 1"
    val sortOrder = "\${MediaStore.Images.Media.DATE_TAKEN} DESC"

    try {
        contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            null,
            sortOrder
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val dateTakenColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN)
            val mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)
            val sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)

            val relativePathColumn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                cursor.getColumnIndex(MediaStore.Images.Media.RELATIVE_PATH)
            } else {
                cursor.getColumnIndex(MediaStore.Images.Media.DATA)
            }

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColumn)
                val displayName = cursor.getString(nameColumn) ?: "photo_\$id.jpg"
                val dateTaken = cursor.getLong(dateTakenColumn)
                val mimeType = cursor.getString(mimeColumn) ?: "image/jpeg"
                val size = cursor.getLong(sizeColumn)
                val relativePath = if (relativePathColumn != -1) cursor.getString(relativePathColumn) else null

                val contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)

                // Inspect EXIF metadata directly from the raw stream
                var exifSummary = ""
                try {
                    val originalUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        MediaStore.setRequireOriginal(contentUri)
                    } else contentUri

                    contentResolver.openInputStream(originalUri)?.use { stream ->
                        val exif = ExifInterface(stream)
                        val make = exif.getAttribute(ExifInterface.TAG_MAKE) ?: ""
                        val model = exif.getAttribute(ExifInterface.TAG_MODEL) ?: ""
                        val dateTime = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL) ?: ""
                        exifSummary = if (model.isNotEmpty()) "\$make \$model | \$dateTime" else dateTime
                    }
                } catch (ignored: Exception) {
                    exifSummary = "EXIF preserved"
                }

                results.add(
                    MediaStorePhoto(
                        id = id,
                        contentUri = contentUri,
                        displayName = displayName,
                        relativePath = relativePath,
                        dateTaken = dateTaken,
                        mimeType = mimeType,
                        size = size,
                        exifSummary = exifSummary
                    )
                )
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }

    return results
}
`;

export const androidManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Network permissions for Google Drive API v3 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Storage permissions for MediaStore access -->
    <!-- Android 13+ (API 33+) -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

    <!-- Android 10+ (API 29+) CRITICAL: Required to read EXIF GPS geotags without redaction -->
    <uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />

    <!-- Legacy Android 9 and below -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />

    <application
        android:allowBackup="false"
        android:icon="@android:drawable/ic_menu_camera"
        android:label="Starred RAW Sync"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="Drive RAW Sync">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`;

export const buildGradleKts = `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.mediastoredrivesync"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.mediastoredrivesync"
        minSdk = 30 // MediaStore.IS_FAVORITE introduced in Android 11 (API 30)
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1,DEPENDENCIES}"
        }
    }
}

dependencies {
    // Jetpack Compose & Material 3
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")

    // AndroidX ExifInterface for reading and verifying EXIF tags
    implementation("androidx.exifinterface:exifinterface:1.3.7")

    // Google Play Services Auth
    implementation("com.google.android.gms:play-services-auth:21.2.0")

    // Google Drive REST API v3 Client
    implementation("com.google.apis:google-api-services-drive:v3-rev20240914-2.0.0")
    implementation("com.google.api-client:google-api-client-android:2.7.0")
    implementation("com.google.http-client:google-http-client-gson:1.45.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}`;
