import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
  Search,
  Copy,
  Check,
  Trash2,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  Pause,
  Play,
  FileCode,
  FileCheck,
  Replace
} from 'lucide-react';
import { LogEntry, LogLevel, BatchStatusData } from '../types/syncLog';

interface BatchStatusAndLogsProps {
  batchStatus: BatchStatusData;
  logs: LogEntry[];
  onUndoLastBatch: () => void;
  onClearLogs: () => void;
}

export const BatchStatusAndLogs: React.FC<BatchStatusAndLogsProps> = ({
  batchStatus,
  logs,
  onUndoLastBatch,
  onClearLogs,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel =
      selectedLevel === 'ALL' ||
      (selectedLevel === 'CONFLICT' && log.level === 'CONFLICT') ||
      (selectedLevel === 'SUCCESS' && log.level === 'SUCCESS') ||
      (selectedLevel === 'UNDO' && log.level === 'UNDO') ||
      (selectedLevel === 'WARN_ERROR' && (log.level === 'WARN' || log.level === 'ERROR')) ||
      (selectedLevel === 'INFO' && log.level === 'INFO');

    const matchesSearch =
      searchQuery.trim() === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesLevel && matchesSearch;
  });

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message}${l.details ? ` (${l.details})` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const getPhaseBadge = () => {
    switch (batchStatus.phase) {
      case 'idle':
        return <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">IDLE</span>;
      case 'pre_check':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">PRE-FLIGHT SCAN</span>;
      case 'uploading':
        return <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">STREAMING CHUNKS</span>;
      case 'exif_linking':
        return <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded text-[10px] font-mono">WRITING EXIF LINKS</span>;
      case 'completed':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono">BATCH COMPLETED</span>;
      case 'undone':
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded text-[10px] font-mono">BATCH ROLLED BACK</span>;
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'INFO': return 'text-sky-300';
      case 'SUCCESS': return 'text-emerald-400';
      case 'CONFLICT': return 'text-amber-300';
      case 'UNDO': return 'text-purple-300 font-bold';
      case 'WARN': return 'text-yellow-300';
      case 'ERROR': return 'text-red-400 font-bold';
    }
  };

  const percentComplete = batchStatus.totalItems > 0
    ? Math.round((batchStatus.processedItems / batchStatus.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Undo Alert Banner (Appears when batch completed or when undo is available) */}
      {batchStatus.canUndo && (
        <div className="rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 border border-purple-500/40">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Undo Available for Last Batch Sync</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                  State Reversible
                </span>
              </div>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                {batchStatus.lastBatchSummary || "Completed recent batch action. You can revert uploads, renamed filenames, and conflict decisions in 1 click."}
              </p>
            </div>
          </div>

          <button
            onClick={onUndoLastBatch}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Undo Last Batch Sync</span>
          </button>
        </div>
      )}

      {/* Batch Status Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Batch Engine Status:</span>
            {getPhaseBadge()}
            {batchStatus.currentFileName && (
              <span className="text-xs font-mono text-sky-300 truncate max-w-xs">
                {batchStatus.currentFileName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            {batchStatus.speedMbPerSec > 0 && (
              <span className="flex items-center gap-1 text-sky-400">
                <span>{batchStatus.speedMbPerSec.toFixed(1)} MB/s</span>
              </span>
            )}
            {batchStatus.etaSeconds > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                <span>ETA: {batchStatus.etaSeconds}s</span>
              </span>
            )}
            <span className="text-slate-300 font-bold">
              {batchStatus.processedItems} / {batchStatus.totalItems} ({percentComplete}%)
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Batch tally chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
          <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Uploaded: {batchStatus.successCount}</span>
          </span>
          <span className="bg-sky-950/50 text-sky-400 border border-sky-900/50 px-2 py-0.5 rounded flex items-center gap-1">
            <Copy className="h-3 w-3" />
            <span>Renamed: {batchStatus.renamedCount}</span>
          </span>
          <span className="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
            <FileCheck className="h-3 w-3" />
            <span>Skipped: {batchStatus.skippedCount}</span>
          </span>
          <span className="bg-amber-950/50 text-amber-400 border border-amber-900/50 px-2 py-0.5 rounded flex items-center gap-1">
            <Replace className="h-3 w-3" />
            <span>Overwritten: {batchStatus.overwrittenCount}</span>
          </span>
        </div>
      </div>

      {/* Comprehensive Logging Console */}
      <div className="rounded-xl border border-slate-800 bg-black/95 overflow-hidden shadow-2xl">
        {/* Terminal Header & Filter Bar */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
            <div className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
            <span className="ml-2 font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-sky-400" />
              <span>Comprehensive Activity Log ({logs.length} events)</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search filter input */}
            <div className="relative">
              <Search className="h-3 w-3 text-slate-500 absolute left-2 top-2.5" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 pl-7 py-1 text-slate-300 text-[11px] font-mono outline-none focus:border-sky-500 w-32 sm:w-40"
              />
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] font-medium"
              title="Copy all logs to clipboard"
            >
              {copiedLogs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Clear button */}
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-red-400 text-[11px]"
              title="Clear log console"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Level filter tabs */}
        <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center gap-1 text-[11px] font-mono">
          <span className="text-slate-500 mr-1 text-[10px] uppercase">Level:</span>
          {['ALL', 'INFO', 'SUCCESS', 'CONFLICT', 'UNDO', 'WARN_ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedLevel === lvl
                  ? 'bg-sky-500/20 text-sky-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {lvl === 'WARN_ERROR' ? 'WARN/ERR' : lvl}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-1.5 py-0.5 rounded ${autoScroll ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}
            >
              {autoScroll ? '● Auto-Scroll' : '○ Scroll Paused'}
            </button>
          </div>
        </div>

        {/* Log Entries Container */}
        <div
          ref={logContainerRef}
          className="p-3.5 max-h-72 overflow-y-auto font-mono text-[11px] space-y-1.5 selection:bg-sky-500/30"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic py-4 text-center">
              No matching log records found.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 shrink-0 text-[10px]">[{log.timestamp}]</span>
                <span className={`shrink-0 font-bold text-[10px] ${getLevelColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-slate-200 break-all">{log.message}</span>
                {log.details && (
                  <span className="text-slate-500 text-[10px] shrink-0 truncate max-w-xs">
                    ({log.details})
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
