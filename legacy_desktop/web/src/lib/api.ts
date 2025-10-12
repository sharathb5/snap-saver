import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/api/shell";
import { 
  MemoryItem, 
  ScanResult, 
  RiskSummary, 
  ExportMode, 
  ExportProgress 
} from "./types";

// Tauri commands
export async function scanZips(zipPaths: string[]): Promise<ScanResult> {
  return await invoke("scan_zips", { zipPaths });
}

export async function computeRisk(items: MemoryItem[]): Promise<RiskSummary> {
  return await invoke("compute_risk", { items });
}

export async function exportStart(
  items: MemoryItem[],
  mode: ExportMode,
  destDir: string,
  zipPaths: string[]
): Promise<string> {
  return await invoke("export_start", { items, mode, destDir, zipPaths });
}

export async function exportCancel(): Promise<void> {
  return await invoke("export_cancel");
}

export async function getExportProgress(): Promise<ExportProgress> {
  return await invoke("get_export_progress");
}

// Event listeners
export function onExportProgress(callback: (progress: ExportProgress) => void) {
  return listen<ExportProgress>("export-progress", (event) => {
    callback(event.payload);
  });
}

// Utility functions
export async function openFolder(path: string): Promise<void> {
  await open(path);
}
