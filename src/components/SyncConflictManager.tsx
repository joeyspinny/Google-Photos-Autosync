import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck,
  FileCode,
  FileX,
  HardDrive,
  HelpCircle,
  Info,
  RefreshCw,
  Replace,
  ShieldAlert,
  Sparkles,
  Upload
} from 'lucide-react';

export type ConflictAction = 'skip' | 'overwrite' | 'rename';

export interface FileConflict {
  id: number;
  fileName: string;
  localSize: number;
  localDate: string;
  localFormat: string;
  remoteDriveId: string;
  remoteSize: number;
  remoteUploadDate: string;
  selectedAction: ConflictAction;
  customNewName?: string;
  resolutionStatus?: 'pending' | 'resolved_skip' | 'resolved_overwrite' | 'resolved_rename';
}

interface SyncConflictManagerProps {
  conflicts: FileConflict[];
  onUpdateAction: (id: number, action: ConflictAction, customName?: string) => void;
  onSetAllActions: (action: ConflictAction) => void;
  onInitiateSyncWithResolutions: () => void;
  isSyncing: boolean;
}

export const SyncConflictManager: React.FC<SyncConflictManagerProps> = ({
  conflicts,
  onUpdateAction,
  onSetAllActions,
  onInitiateSyncWithResolutions,
  isSyncing,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const getAutoRenamedName = (fileName: string): string => {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) return `${fileName}_v2`;
    return `${fileName.substring(0, dotIndex)}_v2${fileName.substring(dotIndex)}`;
  };

  const pendingConflictCount = conflicts.filter(
    (c) => !c.resolutionStatus || c.resolutionStatus === 'pending'
  ).length;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-slate-950/95 p-5 space-y-5 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2.5 text-amber-400 shrink-0 border border-amber-500/30 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Sync Conflict Manager</h3>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                {conflicts.length} Collisions Detected
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Identical filenames already exist in Google Drive folder <code className="text-sky-300">"High-Res Favorites"</code>.
              Choose how each collision is resolved before initiating the batch sync.
            </p>
          </div>
        </div>

        {/* Global Presets */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs self-start sm:self-auto shrink-0">
          <span className="text-[10px] text-slate-500 font-semibold px-2 uppercase tracking-wider">Set All:</span>
          <button
            onClick={() => onSetAllActions('skip')}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-[11px] font-medium"
          >
            Skip All
          </button>
          <button
            onClick={() => onSetAllActions('overwrite')}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-950/50 transition-colors text-[11px] font-medium"
          >
            Overwrite All
          </button>
          <button
            onClick={() => onSetAllActions('rename')}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded text-sky-300 hover:text-sky-200 hover:bg-sky-950/50 transition-colors text-[11px] font-medium"
          >
            Rename All (_v2)
          </button>
        </div>
      </div>

      {/* Conflict Items List */}
      <div className="space-y-3">
        {conflicts.map((conflict) => {
          const autoName = getAutoRenamedName(conflict.fileName);
          const effectiveName = conflict.customNewName || autoName;

          return (
            <div
              key={conflict.id}
              className={`rounded-xl border p-4 transition-all ${
                conflict.resolutionStatus && conflict.resolutionStatus !== 'pending'
                  ? 'border-slate-800 bg-slate-900/30 opacity-75'
                  : 'border-slate-800/90 bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Conflict comparison info */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white truncate">
                      {conflict.fileName}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      {conflict.localFormat}
                    </span>
                  </div>

                  {/* Side-by-side comparison tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Local file details */}
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/90 space-y-1">
                      <div className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center justify-between">
                        <span>📱 LOCAL (Device MediaStore)</span>
                        <span>Pending Upload</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span>Size: {formatSize(conflict.localSize)}</span>
                        <span>Date: {conflict.localDate}</span>
                      </div>
                    </div>

                    {/* Remote file details */}
                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/90 space-y-1">
                      <div className="text-[10px] font-mono text-sky-400 font-semibold flex items-center justify-between">
                        <span>☁️ REMOTE (Google Drive)</span>
                        <span className="truncate max-w-[120px]">ID: {conflict.remoteDriveId}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span>Size: {formatSize(conflict.remoteSize)}</span>
                        <span>Uploaded: {conflict.remoteUploadDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rename preview or custom edit */}
                  {conflict.selectedAction === 'rename' && (
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="text-sky-400 font-medium text-[11px]">Will upload as:</span>
                      {editingId === conflict.id ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            defaultValue={effectiveName}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateAction(conflict.id, 'rename', (e.target as HTMLInputElement).value);
                                setEditingId(null);
                              }
                            }}
                            className="bg-black/90 border border-sky-500 text-white font-mono text-xs rounded px-2 py-1 w-full outline-none"
                          />
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-[11px] bg-sky-500 text-slate-950 rounded font-semibold"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-mono text-sky-300 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/50">
                          <span>{effectiveName}</span>
                          <button
                            onClick={() => setEditingId(conflict.id)}
                            className="text-slate-400 hover:text-white p-0.5"
                            title="Edit target name"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {conflict.selectedAction === 'overwrite' && (
                    <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Remote file in Google Drive will be updated with the local RAW stream. Drive URL will remain stable.</span>
                    </div>
                  )}

                  {conflict.selectedAction === 'skip' && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>Local upload will be bypassed. Remote Drive file remains unchanged.</span>
                    </div>
                  )}
                </div>

                {/* Right: Strategy Segmented Controller */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0 self-start lg:self-center">
                  {/* Option: Skip */}
                  <button
                    onClick={() => onUpdateAction(conflict.id, 'skip')}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      conflict.selectedAction === 'skip'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileX className="h-3.5 w-3.5" />
                    <span>Skip</span>
                  </button>

                  {/* Option: Overwrite */}
                  <button
                    onClick={() => onUpdateAction(conflict.id, 'overwrite')}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      conflict.selectedAction === 'overwrite'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Replace className="h-3.5 w-3.5" />
                    <span>Overwrite</span>
                  </button>

                  {/* Option: Rename */}
                  <button
                    onClick={() => onUpdateAction(conflict.id, 'rename')}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      conflict.selectedAction === 'rename'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Rename</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation & Initiate Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            {conflicts.filter((c) => c.selectedAction === 'skip').length} Skipped •{' '}
            {conflicts.filter((c) => c.selectedAction === 'overwrite').length} Overwriting •{' '}
            {conflicts.filter((c) => c.selectedAction === 'rename').length} Renaming
          </span>
        </div>

        <button
          onClick={onInitiateSyncWithResolutions}
          disabled={isSyncing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          <span>{isSyncing ? 'Executing Sync with Resolutions...' : 'Apply Resolutions & Run Batch Sync'}</span>
        </button>
      </div>
    </div>
  );
};
