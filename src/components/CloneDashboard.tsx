import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  Play,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  FileImage,
  ExternalLink,
  Layers,
  ArrowRight,
  Database,
  Camera,
  Folder,
  Cloud,
  Check,
  Copy,
  Info,
  Pause,
  AlertTriangle
} from 'lucide-react';
import JSZip from 'jszip';
import {
  customCloneMainActivityKt,
  customCloneServiceKt,
  customCloneDatabaseKt,
  customCloneManifestXml,
  customCloneBuildGradleKt
} from '../data/customCloneCode';
import { githubActionsWorkflowYaml } from '../data/securityAudit';
import { SyncConflictManager, FileConflict, ConflictAction } from './SyncConflictManager';
import { BatchStatusAndLogs } from './BatchStatusAndLogs';
import { LogEntry, LogLevel, BatchStatusData, SyncSnapshot } from '../types/syncLog';

interface MockPhoto {
  id: number;
  fileName: string;
  sizeBytes: number;
  camera: string;
  format: 'JPEG' | 'RAW DNG' | 'HEIC';
  driveFileId?: string;
  driveUrl?: string;
  exifDescription?: string;
  synced: boolean;
}

const INITIAL_MOCK_FAVORITES: MockPhoto[] = [
  { id: 101, fileName: 'PXL_20241012_143011201.jpg', sizeBytes: 7420100, camera: 'Google Pixel 7 Pro (50MP Quad-PD)', format: 'JPEG', synced: true, driveFileId: '1aB2c3D4_Pixel_01', driveUrl: 'https://drive.google.com/file/d/1aB2c3D4_Pixel_01/view', exifDescription: 'Google Drive RAW Backup: https://drive.google.com/file/d/1aB2c3D4_Pixel_01/view' },
  { id: 102, fileName: 'PXL_20241013_091522841.jpg', sizeBytes: 8140220, camera: 'Google Pixel 7 Pro (f/1.85, 1/320s)', format: 'JPEG', synced: true, driveFileId: '1aB2c3D4_Pixel_02', driveUrl: 'https://drive.google.com/file/d/1aB2c3D4_Pixel_02/view', exifDescription: 'Google Drive RAW Backup: https://drive.google.com/file/d/1aB2c3D4_Pixel_02/view' },
  { id: 103, fileName: 'PXL_20241014_172030990_RAW.dng', sizeBytes: 25410000, camera: 'Google Pixel 7 Pro (12.5MP RAW)', format: 'RAW DNG', synced: true, driveFileId: '1aB2c3D4_Pixel_03', driveUrl: 'https://drive.google.com/file/d/1aB2c3D4_Pixel_03/view', exifDescription: 'Google Drive RAW Backup: https://drive.google.com/file/d/1aB2c3D4_Pixel_03/view' },
  { id: 104, fileName: 'PXL_20241015_214510112.jpg', sizeBytes: 6890100, camera: 'Google Pixel 7 Pro (Night Sight)', format: 'JPEG', synced: false },
  { id: 105, fileName: 'PXL_20241016_083045610.jpg', sizeBytes: 9120400, camera: 'Google Pixel 7 Pro (Macro Focus)', format: 'JPEG', synced: false },
  { id: 106, fileName: 'PXL_20241016_121500330.heic', sizeBytes: 5210800, camera: 'Google Pixel 7 Pro (10-bit HDR)', format: 'HEIC', synced: false },
  { id: 107, fileName: 'PXL_20241017_054019201.jpg', sizeBytes: 7850000, camera: 'Google Pixel 7 Pro (Front 10.8MP)', format: 'JPEG', synced: false },
  { id: 108, fileName: 'PXL_20241017_061540882_RAW.dng', sizeBytes: 28400000, camera: 'Google Pixel 7 Pro (50MP Full RAW)', format: 'RAW DNG', synced: false }
];

const INITIAL_CONFLICTS: FileConflict[] = [
  {
    id: 104,
    fileName: 'PXL_20241015_214510112.jpg',
    localSize: 6890100,
    localDate: '2024-10-15 21:45',
    localFormat: 'JPEG',
    remoteDriveId: '1aB2c3D4_Drive_104',
    remoteSize: 6890100,
    remoteUploadDate: '2024-10-15 22:01',
    selectedAction: 'skip',
    resolutionStatus: 'pending'
  },
  {
    id: 108,
    fileName: 'PXL_20241017_061540882_RAW.dng',
    localSize: 28400000,
    localDate: '2024-10-17 06:15',
    localFormat: 'RAW DNG',
    remoteDriveId: '1aB2c3D4_Drive_108',
    remoteSize: 22100000,
    remoteUploadDate: '2024-10-16 19:30',
    selectedAction: 'rename',
    customNewName: 'PXL_20241017_061540882_RAW_v2.dng',
    resolutionStatus: 'pending'
  }
];

const INITIAL_LOGS: LogEntry[] = [
  { id: '1', timestamp: '09:20:12.100', level: 'INFO', message: 'Initialized MediaStore RAW Drive Sync Daemon on Pixel 7 Pro (Personal Profile).' },
  { id: '2', timestamp: '09:20:12.450', level: 'INFO', message: 'Target Drive folder verified: "High-Res Favorites" (ID: 1aB_Favorites_Root).' },
  { id: '3', timestamp: '09:20:15.210', level: 'SUCCESS', message: 'Initial MediaStore scan complete: 8 favorite photos indexed.' },
  { id: '4', timestamp: '09:20:16.890', level: 'CONFLICT', message: 'Pre-flight collision detected: PXL_20241015_214510112.jpg matches existing remote file.' },
  { id: '5', timestamp: '09:20:16.920', level: 'CONFLICT', message: 'Pre-flight collision detected: PXL_20241017_061540882_RAW.dng matches existing remote file.' }
];

export const CloneDashboard: React.FC = () => {
  const [photos, setPhotos] = useState<MockPhoto[]>(INITIAL_MOCK_FAVORITES);
  const [conflicts, setConflicts] = useState<FileConflict[]>(INITIAL_CONFLICTS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [undoStack, setUndoStack] = useState<SyncSnapshot[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatusData>({
    phase: 'idle',
    totalItems: 8,
    processedItems: 3,
    speedMbPerSec: 0,
    etaSeconds: 0,
    successCount: 3,
    skippedCount: 0,
    overwrittenCount: 0,
    renamedCount: 0,
    errorCount: 0,
    canUndo: false,
    lastBatchSummary: undefined
  });
  const [isCatchingUp, setIsCatchingUp] = useState(false);
  const [currentSyncIndex, setCurrentSyncIndex] = useState<number>(-1);
  const [selectedPhoto, setSelectedPhoto] = useState<MockPhoto>(INITIAL_MOCK_FAVORITES[0]);
  const [isZipping, setIsZipping] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'main' | 'service' | 'db' | 'manifest' | 'gradle' | 'github'>('main');
  const [copied, setCopied] = useState(false);

  // Statistics
  const syncedPhotos = photos.filter((p) => p.synced);
  const totalSyncedBytes = syncedPhotos.reduce((acc, p) => acc + p.sizeBytes, 0);
  const pendingPhotos = photos.filter((p) => !p.synced);

  // Format breakdown
  const jpegBytes = syncedPhotos.filter((p) => p.format === 'JPEG').reduce((acc, p) => acc + p.sizeBytes, 0);
  const rawBytes = syncedPhotos.filter((p) => p.format === 'RAW DNG').reduce((acc, p) => acc + p.sizeBytes, 0);
  const heicBytes = syncedPhotos.filter((p) => p.format === 'HEIC').reduce((acc, p) => acc + p.sizeBytes, 0);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  // Conflict resolution handlers
  const handleUpdateConflictAction = (id: number, action: ConflictAction, customName?: string) => {
    setConflicts((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, selectedAction: action, customNewName: customName !== undefined ? customName : c.customNewName } : c
      )
    );
  };

  const handleSetAllConflictActions = (action: ConflictAction) => {
    setConflicts((prev) => prev.map((c) => ({ ...c, selectedAction: action })));
  };

  const addLog = (level: LogLevel, message: string, details?: string) => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp,
        level,
        message,
        details
      }
    ]);
  };

  const handleSyncWithResolutions = async () => {
    if (pendingPhotos.length === 0) return;
    setIsCatchingUp(true);

    // Save snapshot for 1-click Undo capability
    const snapshot: SyncSnapshot = {
      timestamp: Date.now(),
      summary: `Batch sync of ${pendingPhotos.length} photos`,
      photos: JSON.parse(JSON.stringify(photos)),
      conflicts: JSON.parse(JSON.stringify(conflicts))
    };
    setUndoStack((prev) => [...prev, snapshot]);

    // Phase 1: Pre-flight check
    setBatchStatus((prev) => ({
      ...prev,
      phase: 'pre_check',
      totalItems: photos.length,
      processedItems: syncedPhotos.length,
      currentFileName: 'Scanning Drive folder for collisions...'
    }));
    addLog('INFO', 'Initiated pre-flight collision verification for pending backlog...');
    await new Promise((r) => setTimeout(r, 450));

    let successes = batchStatus.successCount;
    let skipped = batchStatus.skippedCount;
    let overwritten = batchStatus.overwrittenCount;
    let renamed = batchStatus.renamedCount;

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p.synced) {
        setCurrentSyncIndex(i);
        const conflict = conflicts.find((c) => c.id === p.id);
        let finalName = p.fileName;
        let driveId = `1aB2c3D4_Pixel_${p.id}`;

        const remainingCount = photos.filter((item, idx) => idx >= i && !item.synced).length;
        const speed = parseFloat((3.5 + Math.random() * 2.2).toFixed(1));
        const eta = Math.ceil(remainingCount * 0.7);

        setBatchStatus((prev) => ({
          ...prev,
          phase: 'uploading',
          currentFileName: p.fileName,
          speedMbPerSec: speed,
          etaSeconds: eta
        }));

        await new Promise((r) => setTimeout(r, 650));

        if (conflict) {
          if (conflict.selectedAction === 'skip') {
            driveId = conflict.remoteDriveId;
            skipped++;
            setConflicts((prev) =>
              prev.map((c) => (c.id === p.id ? { ...c, resolutionStatus: 'resolved_skip' } : c))
            );
            addLog('CONFLICT', `Skipped ${p.fileName} (Preserved remote Drive file)`, `ID: ${driveId}`);
          } else if (conflict.selectedAction === 'overwrite') {
            driveId = conflict.remoteDriveId;
            overwritten++;
            setConflicts((prev) =>
              prev.map((c) => (c.id === p.id ? { ...c, resolutionStatus: 'resolved_overwrite' } : c))
            );
            addLog('SUCCESS', `Overwrote remote Drive file for ${p.fileName}`, `Updated ID: ${driveId}`);
          } else if (conflict.selectedAction === 'rename') {
            finalName = conflict.customNewName || p.fileName.replace(/\.(?=[^.]+$)/, '_v2.');
            driveId = `1aB2c3D4_Renamed_${p.id}`;
            renamed++;
            setConflicts((prev) =>
              prev.map((c) => (c.id === p.id ? { ...c, resolutionStatus: 'resolved_rename' } : c))
            );
            addLog('SUCCESS', `Renamed duplicate to ${finalName} and uploaded`, `New ID: ${driveId}`);
          }
        } else {
          successes++;
          addLog('SUCCESS', `Uploaded ${p.fileName} directly via RAW byte stream`, `Drive ID: ${driveId}`);
        }

        const driveUrl = `https://drive.google.com/file/d/${driveId}/view`;
        const exifDesc = `Google Drive RAW Backup: ${driveUrl}`;
        addLog('INFO', `Embedded Google Drive link into EXIF ImageDescription for ${finalName}`);

        setPhotos((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  fileName: finalName,
                  synced: true,
                  driveFileId: driveId,
                  driveUrl: driveUrl,
                  exifDescription: exifDesc
                }
              : item
          )
        );

        setBatchStatus((prev) => ({
          ...prev,
          processedItems: prev.processedItems + 1,
          successCount: successes,
          skippedCount: skipped,
          overwrittenCount: overwritten,
          renamedCount: renamed
        }));
      }
    }

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'completed',
      speedMbPerSec: 0,
      etaSeconds: 0,
      currentFileName: undefined,
      canUndo: true,
      lastBatchSummary: `Batch sync complete: ${successes} uploaded, ${renamed} renamed, ${skipped} skipped.`
    }));

    addLog('SUCCESS', 'All batch sync items completed! Reversible undo snapshot preserved.');
    setIsCatchingUp(false);
    setCurrentSyncIndex(-1);
  };

  const handleUndoLastBatch = () => {
    if (undoStack.length === 0) return;
    const lastSnapshot = undoStack[undoStack.length - 1];

    setPhotos(lastSnapshot.photos);
    setConflicts(lastSnapshot.conflicts);
    setUndoStack((prev) => prev.slice(0, -1));

    const restoredSyncedCount = lastSnapshot.photos.filter((p: any) => p.synced).length;

    setBatchStatus((prev) => ({
      ...prev,
      phase: 'undone',
      processedItems: restoredSyncedCount,
      canUndo: undoStack.length > 1,
      lastBatchSummary: 'Last batch was successfully rolled back and reverted.'
    }));

    addLog('UNDO', 'Reverted last batch sync! Restored original filenames, pending states, and conflict decisions.');
  };

  const handleClearLogs = () => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs([
      { id: 'cleared', timestamp, level: 'INFO', message: 'Activity logs cleared by user.' }
    ]);
  };

  const handleReset = () => {
    setPhotos(INITIAL_MOCK_FAVORITES);
    setConflicts(INITIAL_CONFLICTS);
    setSelectedPhoto(INITIAL_MOCK_FAVORITES[0]);
    setIsCatchingUp(false);
    setCurrentSyncIndex(-1);
    setUndoStack([]);
    setBatchStatus({
      phase: 'idle',
      totalItems: 8,
      processedItems: 3,
      speedMbPerSec: 0,
      etaSeconds: 0,
      successCount: 3,
      skippedCount: 0,
      overwrittenCount: 0,
      renamedCount: 0,
      errorCount: 0,
      canUndo: false,
      lastBatchSummary: undefined
    });
    addLog('INFO', 'Reset workbench state to initial baseline.');
  };

  const handleDownloadFullCloneZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Kotlin source files
      const srcFolder = zip.folder("StarredSyncApp/app/src/main/java/com/example/starredsync");
      srcFolder?.file("MainActivity.kt", customCloneMainActivityKt.trim());
      srcFolder?.file("MediaStoreSyncService.kt", customCloneServiceKt.trim());
      srcFolder?.file("SyncDatabase.kt", customCloneDatabaseKt.trim());

      // AndroidManifest & Gradle
      zip.folder("StarredSyncApp/app/src/main")?.file("AndroidManifest.xml", customCloneManifestXml.trim());
      zip.folder("StarredSyncApp/app")?.file("build.gradle.kts", customCloneBuildGradleKt.trim());

      // GitHub Actions CI/CD for free cloud APK compilation
      zip.folder("StarredSyncApp/.github/workflows")?.file("build-apk.yml", githubActionsWorkflowYaml.trim());

      // Detailed README
      zip.file(
        "StarredSyncApp/README.md",
        `# Starred Photos RAW Drive Sync (Custom Android Clone)

## Complete Features Included
1. **Initial Catch-Up Engine**:
   - Queries MediaStore.Images.Media.EXTERNAL_CONTENT_URI where IS_FAVORITE == 1.
   - Compares with local Room database to find un-synced backlog.
   - Live progress notification & UI progress bar.

2. **Drive Storage Tracker**:
   - Computes total bytes and count uploaded to "High-Res Favorites".
   - Persistent tracking across device reboots via Room SQLite.

3. **Google Photos Metadata Link**:
   - Writes 'Google Drive RAW Backup: https://drive.google.com/file/d/<id>/view' into the local photo's EXIF 'ImageDescription' tag.
   - Swiping up on the photo in Google Photos displays the direct Drive link!

4. **100% EXIF & Filename Preservation**:
   - Requests unredacted content URI via MediaStore.setRequireOriginal().
   - Preserves camera make, model, exposure, and GPS tags.

## Free Cloud Build (Zero Android Studio Needed)
1. Push this folder to a private GitHub repo.
2. GitHub Actions automatically builds 'StarredDriveSync-debug.apk'.
3. Download the APK artifact and tap install on your Pixel 7 Pro!
`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'starred-raw-sync-full-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsZipping(false);
    }
  };

  const getCodeSnippet = () => {
    switch (activeCodeTab) {
      case 'main': return customCloneMainActivityKt.trim();
      case 'service': return customCloneServiceKt.trim();
      case 'db': return customCloneDatabaseKt.trim();
      case 'manifest': return customCloneManifestXml.trim();
      case 'gradle': return customCloneBuildGradleKt.trim();
      case 'github': return githubActionsWorkflowYaml.trim();
      default: return customCloneMainActivityKt.trim();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Full Custom Clone Workbench
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Production-Grade Starred RAW Sync Clone
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Complete with <strong>Catch-Up Sync</strong> for existing favorites, <strong>Drive Storage Quota Tracking</strong>, 24/7 background observer daemon, and <strong>EXIF Drive link embedding</strong> into Google Photos.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadFullCloneZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isZipping ? 'Bundling Full Project...' : 'Download Full Android Studio App (.ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Storage & Sync Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Favorites Synced</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {syncedPhotos.length} <span className="text-xs text-slate-400 font-normal">/ {photos.length} photos</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">100% EXIF & Original Names</div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Drive Storage Used</span>
            <HardDrive className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono">
            {formatSize(totalSyncedBytes)}
          </div>
          <div className="text-[11px] text-slate-400 truncate">Folder: "High-Res Favorites"</div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Catch-Up Backlog</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {pendingPhotos.length} <span className="text-xs text-slate-400 font-normal">pending</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {formatSize(pendingPhotos.reduce((a, b) => a + b.sizeBytes, 0))} un-synced
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>24/7 Daemon Status</span>
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-base font-bold text-emerald-400">
            Active on Pixel 7 Pro
          </div>
          <div className="text-[11px] text-slate-400">ContentObserver on MediaStore</div>
        </div>
      </div>

      {/* Catch-Up Sync Interactive Simulation Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Initial Setup: Catch-Up Engine</h3>
              {isCatchingUp && (
                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono animate-pulse">
                  Streaming RAW Chunks...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Indexes existing photos marked <code className="text-sky-300">is_favorite = 1</code> in your camera roll and uploads the un-synced backlog.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isCatchingUp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset State
            </button>
            <button
              onClick={handleSyncWithResolutions}
              disabled={isCatchingUp || pendingPhotos.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-40 transition-all"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isCatchingUp ? 'Syncing Backlog...' : 'Start Catch-Up Sync'}</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              {currentSyncIndex >= 0
                ? `Uploading: ${photos[currentSyncIndex]?.fileName} (${formatSize(photos[currentSyncIndex]?.sizeBytes)})`
                : pendingPhotos.length === 0
                ? 'All existing favorites are caught up and synced!'
                : `${pendingPhotos.length} photos ready for initial catch-up`}
            </span>
            <span className="text-sky-400 font-bold">
              {Math.round((syncedPhotos.length / photos.length) * 100)}% ({syncedPhotos.length}/{photos.length})
            </span>
          </div>

          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${(syncedPhotos.length / photos.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Format breakdown bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Drive Storage Composition:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            <span>JPEG: {formatSize(jpegBytes)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
            <span>RAW DNG: {formatSize(rawBytes)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
            <span>HEIC / HDR: {formatSize(heicBytes)}</span>
          </div>
        </div>
      </div>

      {/* Sync Conflict Manager Section */}
      <SyncConflictManager
        conflicts={conflicts}
        onUpdateAction={handleUpdateConflictAction}
        onSetAllActions={handleSetAllConflictActions}
        onInitiateSyncWithResolutions={handleSyncWithResolutions}
        isSyncing={isCatchingUp}
      />

      {/* Batch Status & Comprehensive Logging with Reversible Undo */}
      <BatchStatusAndLogs
        batchStatus={batchStatus}
        logs={logs}
        onUndoLastBatch={handleUndoLastBatch}
        onClearLogs={handleClearLogs}
      />

      {/* Feature Highlight: Metadata Link In Google Photos */}
      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900 to-slate-950 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 shrink-0">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Feature Highlight: Google Photos Persisted Drive Deep-Link</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                EXIF ImageDescription
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              When the clone uploads a photo to Google Drive, Drive returns a unique <code className="text-sky-300 font-mono text-[11px]">webViewLink</code>. The app writes this link directly into the local photo's EXIF <code className="text-sky-300 font-mono text-[11px]">ImageDescription</code> tag. When you swipe up on the photo inside the <strong>Google Photos app</strong>, it displays the link right in the photo's information card!
            </p>
          </div>
        </div>

        {/* Visual Mock of Google Photos Info Panel with Link */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 bg-black/80 rounded-xl p-4 border border-slate-800 space-y-3 font-sans">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Google Photos Info Panel (On Your Phone)</span>
              <span className="text-emerald-400 font-semibold text-[10px]">Persisted EXIF</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-white font-semibold text-sm">{selectedPhoto.fileName}</div>
              <div className="text-slate-400 text-[11px]">Oct 15, 2024 • 6:45 PM • {formatSize(selectedPhoto.sizeBytes)}</div>
              <div className="text-slate-400 text-[11px]">{selectedPhoto.camera}</div>

              {/* The embedded description link */}
              <div className="p-3 rounded-lg bg-indigo-950/50 border border-indigo-500/40 text-xs space-y-1">
                <div className="text-indigo-300 font-semibold flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Google Drive RAW Backup Link (Embedded in Photo):</span>
                </div>
                <div className="font-mono text-sky-400 text-[11px] break-all">
                  {selectedPhoto.driveUrl || 'Pending upload...'}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-2">
            <div className="text-xs font-semibold text-white">Select a Photo to Inspect Metadata:</div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/60">
              {photos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPhoto(p)}
                  className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                    selectedPhoto.id === p.id ? 'bg-sky-500/10 text-white' : 'hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] truncate">{p.fileName}</div>
                    <div className="text-[10px] text-slate-500">{formatSize(p.sizeBytes)} • {p.format}</div>
                  </div>
                  <div className="shrink-0 text-[11px]">
                    {p.synced ? (
                      <span className="text-emerald-400 font-mono text-[10px]">✓ EXIF Linked</span>
                    ) : (
                      <span className="text-amber-400 font-mono text-[10px]">Unsynced</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Code Browser for the Custom Android Studio App */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveCodeTab('main')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'main' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MainActivity.kt
            </button>
            <button
              onClick={() => setActiveCodeTab('service')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'service' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MediaStoreSyncService.kt (Daemon)
            </button>
            <button
              onClick={() => setActiveCodeTab('db')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'db' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SyncDatabase.kt (Room SQLite)
            </button>
            <button
              onClick={() => setActiveCodeTab('manifest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'manifest' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AndroidManifest.xml
            </button>
            <button
              onClick={() => setActiveCodeTab('gradle')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'gradle' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              build.gradle.kts
            </button>
            <button
              onClick={() => setActiveCodeTab('github')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCodeTab === 'github' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GitHub Actions Workflow
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold self-start"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy File'}</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-black/90 p-4 font-mono text-xs text-slate-200 max-h-96 overflow-y-auto">
          <pre tabIndex={0} className="whitespace-pre outline-none">{getCodeSnippet()}</pre>
        </div>
      </div>
    </div>
  );
};
