import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, Folder, Cloud, HardDrive, Smartphone, FileText, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface MockItem {
  id: number;
  displayName: string;
  relativePath: string;
  dateTaken: string;
  sizeMb: number;
  mimeType: string;
  isFavorite: boolean;
  status: 'idle' | 'queued' | 'uploading' | 'completed' | 'error';
  driveFileId?: string;
}

const INITIAL_MOCK_ITEMS: MockItem[] = [
  {
    id: 10421,
    displayName: 'PXL_20241012_153209210.jpg',
    relativePath: 'DCIM/Camera/',
    dateTaken: '2024-10-12 15:32:09',
    sizeMb: 6.84,
    mimeType: 'image/jpeg',
    isFavorite: true,
    status: 'idle'
  },
  {
    id: 10425,
    displayName: 'PXL_20241014_081144820.jpg',
    relativePath: 'DCIM/Camera/',
    dateTaken: '2024-10-14 08:11:44',
    sizeMb: 8.12,
    mimeType: 'image/jpeg',
    isFavorite: true,
    status: 'idle'
  },
  {
    id: 10428,
    displayName: 'IMG_20241015_214500_RAW.dng',
    relativePath: 'DCIM/RAW/',
    dateTaken: '2024-10-15 21:45:00',
    sizeMb: 24.50,
    mimeType: 'image/x-adobe-dng',
    isFavorite: true,
    status: 'idle'
  },
  {
    id: 10430,
    displayName: 'PXL_20241016_120412330.jpg',
    relativePath: 'DCIM/Camera/',
    dateTaken: '2024-10-16 12:04:12',
    sizeMb: 5.41,
    mimeType: 'image/jpeg',
    isFavorite: false, // will be filtered out!
    status: 'idle'
  },
  {
    id: 10433,
    displayName: 'PXL_20241017_054019102.jpg',
    relativePath: 'DCIM/Camera/',
    dateTaken: '2024-10-17 05:40:19',
    sizeMb: 7.29,
    mimeType: 'image/jpeg',
    isFavorite: true,
    status: 'idle'
  }
];

export const DriveSimulator: React.FC = () => {
  const [items, setItems] = useState<MockItem[]>(INITIAL_MOCK_ITEMS);
  const [logs, setLogs] = useState<string[]>([
    "System idle. Click 'Run End-to-End Simulation' or execute step-by-step."
  ]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderCreated, setFolderCreated] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [userEmail] = useState<string>("joeyspin@gmail.com");

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleReset = () => {
    setItems(INITIAL_MOCK_ITEMS.map((i) => ({ ...i, status: 'idle', driveFileId: undefined })));
    setLogs(["Reset simulator state. Ready to test."]);
    setCurrentStep(0);
    setFolderId(null);
    setFolderCreated(false);
    setIsRunning(false);
  };

  // Step 1: Query MediaStore
  const runStep1Query = async () => {
    addLog("[*] Executing ContentResolver.query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI)...");
    addLog("[*] Selection SQL: MediaStore.Images.Media.IS_FAVORITE == 1");
    await new Promise((r) => setTimeout(r, 600));

    const favorites = items.filter((i) => i.isFavorite);
    addLog(`[✓] Cursor scanned ${items.length} total media rows.`);
    addLog(`[✓] Filter matched ${favorites.length} photos with IS_FAVORITE = 1.`);
    addLog(`    (Notice: item 10430 was excluded because isFavorite == false)`);

    setItems((prev) =>
      prev.map((i) =>
        i.isFavorite ? { ...i, status: 'queued' } : { ...i, status: 'idle' }
      )
    );
    setCurrentStep(1);
  };

  // Step 2: Auth Google Drive v3
  const runStep2Auth = async () => {
    addLog("[*] Initializing Google Drive v3 REST Client...");
    addLog(`[*] OAuth2 Scope requested: 'https://www.googleapis.com/auth/drive.file'`);
    await new Promise((r) => setTimeout(r, 700));
    addLog(`[✓] OAuth2 Token verified for: ${userEmail}`);
    addLog(`[✓] Google Drive client transport initialized.`);
    setCurrentStep(2);
  };

  // Step 3: Check / Create Folder
  const runStep3Folder = async () => {
    addLog("[*] Calling driveService.files().list()...");
    addLog("[*] Query: name = 'High-Res Favorites' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    await new Promise((r) => setTimeout(r, 600));

    const generatedFolderId = "1aBcD_HighResFavoritesFolder_982xyz";
    addLog("[!] Folder not found in root drive. Creating new folder...");
    await new Promise((r) => setTimeout(r, 500));
    addLog(`[✓] Folder created successfully: 'High-Res Favorites'`);
    addLog(`[✓] Assigned Google Drive Folder ID: ${generatedFolderId}`);

    setFolderId(generatedFolderId);
    setFolderCreated(true);
    setCurrentStep(3);
  };

  // Step 4: Stream Upload
  const runStep4Upload = async () => {
    if (!folderId) {
      addLog("[!] Error: Target folder ID not resolved yet. Run Step 3 first.");
      return;
    }

    addLog("[*] Starting raw binary stream upload loop...");
    const favorites = items.filter((i) => i.isFavorite);

    for (let index = 0; index < favorites.length; index++) {
      const target = favorites[index];
      setItems((prev) =>
        prev.map((i) => (i.id === target.id ? { ...i, status: 'uploading' } : i))
      );

      addLog(`[${index + 1}/${favorites.length}] Opening ContentResolver.openInputStream(MediaStore.setRequireOriginal(uri))...`);
      addLog(`    Streaming ${target.displayName} (${target.sizeMb} MB) via Resumable Upload into parents: ['${folderId}']`);

      await new Promise((r) => setTimeout(r, 900));

      const driveFileId = `drive_file_${target.id}_${Math.random().toString(36).substring(2, 7)}`;
      setItems((prev) =>
        prev.map((i) =>
          i.id === target.id ? { ...i, status: 'completed', driveFileId } : i
        )
      );
      addLog(`    ✓ Uploaded! Drive ID: ${driveFileId} (100% EXIF & original filename intact)`);
    }

    addLog(`[✓] SUCCESS: All ${favorites.length} RAW favorite photos synced to Google Drive.`);
    setCurrentStep(4);
  };

  // Run full flow automatically
  const runFullFlow = async () => {
    setIsRunning(true);
    handleReset();
    await new Promise((r) => setTimeout(r, 300));
    await runStep1Query();
    await new Promise((r) => setTimeout(r, 400));
    await runStep2Auth();
    await new Promise((r) => setTimeout(r, 400));
    await runStep3Folder();
    await new Promise((r) => setTimeout(r, 400));
    await runStep4Upload();
    setIsRunning(false);
  };

  const favoriteCount = items.filter((i) => i.isFavorite).length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const progressPercent = favoriteCount > 0 ? Math.round((completedCount / favoriteCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Live Execution Simulator</h3>
          <p className="text-xs text-slate-400">
            Simulate the exact Android ContentResolver query, Google Drive API v3 folder handshake, and RAW byte stream upload.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={runFullFlow}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-400 shadow-md shadow-sky-500/20 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {isRunning ? 'Running Simulation...' : 'Run End-to-End Simulation'}
          </button>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={runStep1Query}
          disabled={isRunning}
          className={`p-3 rounded-lg border text-left transition-all ${
            currentStep >= 1
              ? 'border-sky-500/50 bg-sky-950/20 text-white'
              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono font-bold text-sky-400">STEP 1</span>
            <Smartphone className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-xs font-semibold">Query MediaStore</div>
          <div className="text-[10px] text-slate-400 truncate">WHERE is_favorite = 1</div>
        </button>

        <button
          onClick={runStep2Auth}
          disabled={isRunning || currentStep < 1}
          className={`p-3 rounded-lg border text-left transition-all ${
            currentStep >= 2
              ? 'border-indigo-500/50 bg-indigo-950/20 text-white'
              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 disabled:opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono font-bold text-indigo-400">STEP 2</span>
            <Cloud className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xs font-semibold">OAuth Drive v3</div>
          <div className="text-[10px] text-slate-400 truncate">Scope: drive.file</div>
        </button>

        <button
          onClick={runStep3Folder}
          disabled={isRunning || currentStep < 2}
          className={`p-3 rounded-lg border text-left transition-all ${
            currentStep >= 3
              ? 'border-amber-500/50 bg-amber-950/20 text-white'
              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 disabled:opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono font-bold text-amber-400">STEP 3</span>
            <Folder className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xs font-semibold">Folder Handshake</div>
          <div className="text-[10px] text-slate-400 truncate">High-Res Favorites</div>
        </button>

        <button
          onClick={runStep4Upload}
          disabled={isRunning || currentStep < 3}
          className={`p-3 rounded-lg border text-left transition-all ${
            currentStep >= 4
              ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 disabled:opacity-40'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono font-bold text-emerald-400">STEP 4</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xs font-semibold">Raw Stream Upload</div>
          <div className="text-[10px] text-slate-400 truncate">Preserve EXIF Bytes</div>
        </button>
      </div>

      {/* MediaStore Mock Grid & Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: MediaStore items table */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-sky-400" />
              <span>Device MediaStore.Images.Media Rows</span>
            </h4>
            <span className="text-xs text-slate-400">
              {completedCount} / {favoriteCount} Uploaded ({progressPercent}%)
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
            <div className="divide-y divide-slate-800/80">
              {items.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        item.isFavorite
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                      title={item.isFavorite ? 'IS_FAVORITE = 1' : 'IS_FAVORITE = 0'}
                    >
                      {item.isFavorite ? '★ FAV' : 'REG'}
                    </div>

                    <div className="min-w-0">
                      <div className="font-mono text-slate-200 font-medium truncate flex items-center gap-2">
                        {item.displayName}
                        {item.mimeType.includes('dng') && (
                          <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1 py-0.2 rounded border border-purple-700/50">
                            RAW DNG
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{item.relativePath}</span>
                        <span>•</span>
                        <span>{item.sizeMb.toFixed(1)} MB</span>
                        <span>•</span>
                        <span>{item.dateTaken}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {item.status === 'idle' && (
                      <span className="text-[11px] text-slate-500">
                        {item.isFavorite ? 'Ready in DB' : 'Filtered out'}
                      </span>
                    )}
                    {item.status === 'queued' && (
                      <span className="text-[11px] text-amber-400 font-medium">Queued</span>
                    )}
                    {item.status === 'uploading' && (
                      <span className="text-[11px] text-sky-400 font-medium animate-pulse">
                        Streaming RAW...
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <div className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drive Target Folder status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Folder className={`h-5 w-5 ${folderCreated ? 'text-amber-400' : 'text-slate-500'}`} />
              <div>
                <div className="font-semibold text-white">Target: Google Drive / High-Res Favorites</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {folderId ? `Folder ID: ${folderId}` : 'Status: Not created yet'}
                </div>
              </div>
            </div>
            {folderCreated && (
              <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                FOLDER READY
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Real-time Terminal Log */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              <span>Real-Time Sync Console</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">v3 REST API</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-black/90 p-3.5 font-mono text-[11px] text-slate-300 h-96 overflow-y-auto space-y-1.5 shadow-inner">
            {logs.map((log, i) => {
              let color = "text-slate-300";
              if (log.startsWith("[*]")) color = "text-sky-300";
              if (log.startsWith("[✓]") || log.includes("✓")) color = "text-emerald-400";
              if (log.startsWith("[!]")) color = "text-amber-300";
              if (log.startsWith("System")) color = "text-slate-500";
              return (
                <div key={i} className={`leading-relaxed ${color}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
