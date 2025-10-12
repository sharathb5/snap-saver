import React, { useState, useEffect, useCallback } from "react";
import { DropZone } from "./components/DropZone";
import { Summary } from "./components/Summary";
import { DestinationPicker } from "./components/DestinationPicker";
import { ProgressBar } from "./components/ProgressBar";
import { 
  scanZips, 
  computeRisk, 
  exportStart, 
  onExportProgress, 
  openFolder 
} from "./lib/api";
import { 
  MemoryItem, 
  ScanResult, 
  RiskSummary, 
  ExportMode, 
  ExportProgress 
} from "./lib/types";

type AppState = 
  | { type: "idle" }
  | { type: "scanning"; zipPaths: string[] }
  | { type: "scanned"; scanResult: ScanResult; riskSummary: RiskSummary; zipPaths: string[] }
  | { type: "exporting"; progress: ExportProgress; runId: string }
  | { type: "completed"; runId: string; destDir: string };

export default function App() {
  const [state, setState] = useState<AppState>({ type: "idle" });
  const [exportMode, setExportMode] = useState<ExportMode>("at-risk");
  const [destDir, setDestDir] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Handle file selection
  const handleFilesSelected = useCallback(async (zipPaths: string[]) => {
    setError("");
    setState({ type: "scanning", zipPaths });
    
    try {
      const scanResult = await scanZips(zipPaths);
      const riskSummary = await computeRisk(scanResult.items);
      
      setState({ 
        type: "scanned", 
        scanResult, 
        riskSummary, 
        zipPaths 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan ZIP files");
      setState({ type: "idle" });
    }
  }, []);

  // Handle export start
  const handleExportStart = useCallback(async () => {
    if (state.type !== "scanned" || !destDir) return;
    
    setError("");
    
    try {
      const runId = await exportStart(
        state.scanResult.items,
        exportMode,
        destDir,
        state.zipPaths
      );
      
      setState({ 
        type: "exporting", 
        progress: { 
          percent: 0, 
          copied_count: 0, 
          skipped_count: 0, 
          failed_count: 0 
        }, 
        runId 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start export");
    }
  }, [state, destDir, exportMode]);

  // Handle export completion
  const handleExportComplete = useCallback(() => {
    if (state.type === "exporting") {
      setState({ 
        type: "completed", 
        runId: state.runId, 
        destDir 
      });
    }
  }, [state, destDir]);

  // Listen for export progress
  useEffect(() => {
    if (state.type === "exporting") {
      const unsubscribe = onExportProgress((progress) => {
        setState(prev => {
          if (prev.type === "exporting") {
            return { ...prev, progress };
          }
          return prev;
        });
        
        // Check if export is complete
        if (progress.percent >= 100) {
          setTimeout(handleExportComplete, 1000); // Small delay to show 100%
        }
      });
      
      return unsubscribe;
    }
  }, [state.type, handleExportComplete]);

  // Handle open folder
  const handleOpenFolder = useCallback(async () => {
    if (state.type === "completed") {
      try {
        await openFolder(state.destDir);
      } catch (err) {
        console.error("Failed to open folder:", err);
      }
    }
  }, [state]);

  // Reset app
  const handleReset = useCallback(() => {
    setState({ type: "idle" });
    setDestDir("");
    setError("");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Snap Saver</h1>
          <p className="text-lg text-gray-600">
            Save your Snapchat memories before they're deleted
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 bg-danger-50 border border-danger-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-danger-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-danger-800">Error</h3>
                <p className="text-sm text-danger-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="space-y-6">
          {/* Drop zone - show when idle or scanning */}
          {(state.type === "idle" || state.type === "scanning") && (
            <DropZone
              onFilesSelected={handleFilesSelected}
              disabled={state.type === "scanning"}
            />
          )}

          {/* Summary - show when scanned */}
          {state.type === "scanned" && (
            <Summary
              scanResult={state.scanResult}
              riskSummary={state.riskSummary}
            />
          )}

          {/* Export controls - show when scanned */}
          {state.type === "scanned" && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Mode toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Backup Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="exportMode"
                      value="at-risk"
                      checked={exportMode === "at-risk"}
                      onChange={(e) => setExportMode(e.target.value as ExportMode)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Save at-risk only (recommended)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="exportMode"
                      value="all"
                      checked={exportMode === "all"}
                      onChange={(e) => setExportMode(e.target.value as ExportMode)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Save all memories
                    </span>
                  </label>
                </div>
              </div>

              {/* Destination picker */}
              <DestinationPicker
                onDestinationSelected={setDestDir}
                currentPath={destDir}
              />

              {/* Start button */}
              <div className="flex justify-center">
                <button
                  onClick={handleExportStart}
                  disabled={!destDir}
                  className={`
                    px-8 py-3 text-lg font-medium rounded-lg
                    ${destDir
                      ? "bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }
                  `}
                >
                  Start Backup
                </button>
              </div>
            </div>
          )}

          {/* Progress bar - show when exporting */}
          {state.type === "exporting" && (
            <ProgressBar
              progress={state.progress}
              isVisible={true}
            />
          )}

          {/* Completion message - show when completed */}
          {state.type === "completed" && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 text-success-600">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Backup Complete!
                </h3>
                <p className="text-gray-600">
                  Your memories have been saved to your chosen folder.
                </p>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleOpenFolder}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Open Folder
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
