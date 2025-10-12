export type MediaType = "photo" | "video" | "unknown";
export type ExportMode = "at-risk" | "all";

export interface MemoryItem {
  id: string;               // stable id (path+timestamp hash)
  createdAtIso: string;     // normalized UTC
  zipPath: string;          // path inside the export zip
  sizeBytes?: number;       // may be undefined until measured
  mediaType: MediaType;
  originalName?: string;
}

export interface ScanResult {
  items: MemoryItem[];
  totalBytes: number;
  missingSizesCount: number;
}

export interface RiskSummary {
  safeFloorBytes: number;   // 5 * 1024^3
  safeCount: number;
  safeBytes: number;
  atRiskCount: number;
  atRiskBytes: number;
  atRiskStartIso?: string;
}

export interface ExportPlan {
  mode: "at-risk" | "all";
  destStrategy: "fs-access" | "download-zip";
  destHandle?: FileSystemDirectoryHandle; // if fs-access available
}

export interface ExportProgress {
  percent: number;          // 0..100
  copiedCount: number;
  skippedCount: number;
  failedCount: number;
  currentFile?: string;
  status?: string;
}

export interface ManifestSummary {
  dest: string;
  copiedCount: number;
  errorCount: number;
  runStartedIso: string;
  runEndedIso: string;
  mode: "at-risk" | "all";
}

// Helper functions
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

// Worker message types
export interface WorkerMessage<T = any> {
  type: string;
  data: T;
}

export interface ScanMessage extends WorkerMessage<{ files: File[] }> {
  type: "scan";
}

export interface ExportMessage extends WorkerMessage<{
  items: MemoryItem[];
  plan: ExportPlan;
}> {
  type: "export";
}

export interface ProgressMessage extends WorkerMessage<ExportProgress> {
  type: "progress";
}

export interface CompleteMessage extends WorkerMessage<{ success: boolean; error?: string }> {
  type: "complete";
}
