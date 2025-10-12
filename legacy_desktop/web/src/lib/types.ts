export type MediaType = "photo" | "video" | "unknown";

export interface MemoryItem {
  id: string;
  created_at_iso: string;
  zip_path: string;
  size_bytes?: number;
  media_type: MediaType;
}

export interface ScanResult {
  items: MemoryItem[];
  total_bytes: number;
  missing_sizes_count: number;
}

export interface RiskSummary {
  safe_floor_bytes: number;
  safe_count: number;
  safe_bytes: number;
  at_risk_count: number;
  at_risk_bytes: number;
  at_risk_start_iso?: string;
}

export interface ExportPlan {
  mode: ExportMode;
  dest_dir: string;
}

export type ExportMode = "at-risk" | "all";

export interface ExportProgress {
  percent: number;
  copied_count: number;
  skipped_count: number;
  failed_count: number;
  current_file?: string;
}

export interface ManifestSummary {
  dest: string;
  copied_count: number;
  error_count: number;
  run_started_iso: string;
  run_ended_iso: string;
  mode: ExportMode;
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
