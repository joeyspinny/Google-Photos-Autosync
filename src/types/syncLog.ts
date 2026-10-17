export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'CONFLICT' | 'ERROR' | 'UNDO';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

export type BatchPhase = 'idle' | 'pre_check' | 'uploading' | 'exif_linking' | 'completed' | 'undone';

export interface BatchStatusData {
  phase: BatchPhase;
  totalItems: number;
  processedItems: number;
  currentFileName?: string;
  speedMbPerSec: number;
  etaSeconds: number;
  successCount: number;
  skippedCount: number;
  overwrittenCount: number;
  renamedCount: number;
  errorCount: number;
  canUndo: boolean;
  lastBatchSummary?: string;
}

export interface SyncSnapshot {
  timestamp: number;
  summary: string;
  photos: any[];
  conflicts: any[];
}
