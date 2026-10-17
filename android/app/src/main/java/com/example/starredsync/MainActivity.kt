package com.example.starredsync

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
                                "${catchUpProgress.current}/${catchUpProgress.total}",
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
                    Text("Current Status: ${progress.statusMessage}", fontSize = 12.sp, color = Color(0xFF38BDF8))
                    Text("Uploading: ${progress.currentFileName}", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("Items: ${progress.current} of ${progress.total}", fontSize = 11.sp, color = Color(0xFF94A3B8))
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
            Text("Synced Photos Registry (${syncedRecords.size})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
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
                                "${formatSize(record.fileSizeBytes)} • ${record.cameraModel ?: "RAW"} • EXIF Updated",
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
    if (bytes < 1024) return "$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024) return DecimalFormat("#,##0.0 KB").format(kb)
    val mb = kb / 1024.0
    if (mb < 1024) return DecimalFormat("#,##0.0 MB").format(mb)
    val gb = mb / 1024.0
    return DecimalFormat("#,##0.00 GB").format(gb)
}
