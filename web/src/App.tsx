import { useState, useEffect, useCallback } from "react";
import { DropZone } from "./components/DropZone";
import { Summary } from "./components/Summary";
import { DestinationPicker } from "./components/DestinationPicker";
import { ProgressBar } from "./components/ProgressBar";
import { Footer } from "./components/Footer";
import { 
  ScanResult, 
  RiskSummary, 
  ExportMode, 
  ExportProgress,
  ExportPlan
} from "./lib/types";
import { computeRiskAnalysis, getItemsForExport } from "./lib/risk";
import { wakeLock } from "./lib/wakeLock";
import { getFolderInfo, copyToClipboard } from "./lib/fsAccess";

type AppState = 
  | { type: "idle" }
  | { type: "scanning"; files: File[] }
  | { type: "scanned"; scanResult: ScanResult; riskSummary: RiskSummary; files: File[] }
  | { type: "exporting"; progress: ExportProgress; runId: string }
  | { type: "completed"; runId: string; destStrategy: "fs-access" | "download-zip" };

export default function App() {
  const [state, setState] = useState<AppState>({ type: "idle" });
  const [exportMode, setExportMode] = useState<ExportMode>(() => {
    const saved = localStorage.getItem('snap-saver-export-mode');
    return (saved as ExportMode) || "at-risk";
  });
  const [destStrategy, setDestStrategy] = useState<"fs-access" | "download-zip">(() => {
    const saved = localStorage.getItem('snap-saver-dest-strategy');
    return (saved as "fs-access" | "download-zip") || "download-zip";
  });
  const [destHandle, setDestHandle] = useState<FileSystemDirectoryHandle | undefined>();
  const [folderInfo, setFolderInfo] = useState<{ name: string; path: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string>("");
  const [unzipWorker, setUnzipWorker] = useState<Worker | null>(null);
  const [exportWorker, setExportWorker] = useState<Worker | null>(null);
  const [fileValidation, setFileValidation] = useState<{
    totalFiles: number;
    validSnapchatExports: number;
    invalidFiles: string[];
  } | null>(null);

  // Initialize workers
  useEffect(() => {
    const unzip = new Worker(new URL('./workers/unzip.worker.ts', import.meta.url), { type: 'module' });
    const exportW = new Worker(new URL('./workers/export.worker.ts', import.meta.url), { type: 'module' });
    
    setUnzipWorker(unzip);
    setExportWorker(exportW);

    // Handle unzip worker messages
    unzip.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'scan-result') {
        console.log(`🎉 Scan complete: Found ${data.items.length} memories (${data.totalBytes} bytes)`);
        const riskSummary = computeRiskAnalysis(data.items);
        setState({ 
          type: "scanned", 
          scanResult: data, 
          riskSummary,
          files: state.type === "scanning" ? state.files : []
        });
      } else if (type === 'error') {
        console.error(`❌ Error: ${data.message}`);
        setError(data.message);
        setState({ type: "idle" });
      }
    };

    // Handle export worker messages
    exportW.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'progress') {
        setState(prev => {
          if (prev.type === "exporting") {
            return { ...prev, progress: data };
          }
          return prev;
        });
      } else if (type === 'complete') {
        if (data.success) {
          setState(prev => {
            if (prev.type === "exporting") {
              return { 
                type: "completed", 
                runId: prev.runId,
                destStrategy: destStrategy
              };
            }
            return prev;
          });
        } else {
          setError(data.error);
        }
        wakeLock.releaseWakeLock();
      } else if (type === 'download-zip') {
        // Handle ZIP download
        const blob = new Blob([data.zipData], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };

    return () => {
      unzip.terminate();
      exportW.terminate();
    };
  }, []);

  // Handle file selection
  const handleFilesSelected = useCallback(async (files: File[]) => {
    setError("");
    console.log(`🚀 Starting scan of ${files.length} ZIP file(s)`);
    
    // Immediate file validation feedback
    const validation = {
      totalFiles: files.length,
      validSnapchatExports: 0,
      invalidFiles: [] as string[]
    };
    
    // Quick validation - check if files are ZIPs and have reasonable names
    for (const file of files) {
      if (file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
        validation.validSnapchatExports++;
      } else {
        validation.invalidFiles.push(file.name);
      }
    }
    
    setFileValidation(validation);
    setState({ type: "scanning", files });
    
    if (unzipWorker) {
      unzipWorker.postMessage({ type: 'scan', data: { files } });
    }
  }, [unzipWorker]);


  // Handle destination selection
  const handleDestinationSelected = useCallback(async (strategy: "fs-access" | "download-zip", handle?: FileSystemDirectoryHandle) => {
    setDestStrategy(strategy);
    setDestHandle(handle);
    
    // Get folder info if using fs-access
    if (strategy === "fs-access" && handle) {
      try {
        const info = await getFolderInfo(handle);
        setFolderInfo(info);
      } catch (error) {
        console.error('Failed to get folder info:', error);
      }
    } else {
      setFolderInfo(null);
    }
    
    // Persist destination strategy
    localStorage.setItem('snap-saver-dest-strategy', strategy);
  }, []);

  // Handle export start
  const handleExportStart = useCallback(async () => {
    if (state.type !== "scanned" || !exportWorker) return;
    
    setError("");
    
    // Request wake lock
    await wakeLock.requestWakeLock();
    
    const itemsToExport = getItemsForExport(state.scanResult.items, exportMode);
    console.log(`📦 Export mode: ${exportMode}`);
    console.log(`📦 Total items available: ${state.scanResult.items.length}`);
    console.log(`📦 Items selected for export: ${itemsToExport.length}`);
    console.log(`📦 Items with known sizes: ${state.scanResult.items.filter(item => item.sizeBytes !== undefined).length}`);
    
    const runId = `run-${Date.now()}`;
    
    const plan: ExportPlan = {
      mode: exportMode,
      destStrategy,
      destHandle,
    };
    
    setState({ 
      type: "exporting", 
      progress: { 
        percent: 0, 
        copiedCount: 0, 
        skippedCount: 0, 
        failedCount: 0 
      }, 
      runId 
    });
    
    exportWorker.postMessage({ 
      type: 'export', 
      data: { 
        items: itemsToExport,
        plan,
        zipFiles: state.files
      } 
    });
  }, [state, exportMode, destStrategy, destHandle, exportWorker]);

  // Handle export cancellation
  const handleExportCancel = useCallback(() => {
    if (exportWorker && state.type === "exporting") {
      exportWorker.postMessage({ type: 'cancel' });
      setState({ type: "idle" });
      wakeLock.releaseWakeLock();
    }
  }, [exportWorker, state]);

  // Handle copying folder path
  const handleCopyPath = useCallback(async () => {
    if (destHandle && folderInfo) {
      const success = await copyToClipboard(folderInfo.path);
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } else {
        // Fallback: show the path in an alert
        alert(`Folder path: ${folderInfo.path}\n\nCopy this path and paste it in Finder's "Go to Folder" (Cmd+Shift+G)`);
      }
    }
  }, [destHandle, folderInfo]);

  // Reset app
  const handleReset = useCallback(() => {
    setState({ type: "idle" });
    setDestStrategy("download-zip");
    setDestHandle(undefined);
    setFolderInfo(null);
    setCopySuccess(false);
    setError("");
    wakeLock.releaseWakeLock();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1">
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
              <div>
                <DropZone
                  onFilesSelected={handleFilesSelected}
                  disabled={state.type === "scanning"}
                />
                
                {/* File validation feedback */}
                {fileValidation && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <strong>Found {fileValidation.totalFiles} file(s)</strong>
                        {fileValidation.validSnapchatExports > 0 && (
                          <span> • {fileValidation.validSnapchatExports} valid ZIP file(s)</span>
                        )}
                        {fileValidation.invalidFiles.length > 0 && (
                          <span> • {fileValidation.invalidFiles.length} not ZIP files</span>
                        )}
                      </div>
                    </div>
                    {fileValidation.invalidFiles.length > 0 && (
                      <div className="mt-2 text-xs text-blue-700">
                        Invalid files: {fileValidation.invalidFiles.join(', ')}
                      </div>
                    )}
                  </div>
                )}

              </div>
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
                        onChange={(e) => {
                          const mode = e.target.value as ExportMode;
                          setExportMode(mode);
                          localStorage.setItem('snap-saver-export-mode', mode);
                        }}
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
                        onChange={(e) => {
                          const mode = e.target.value as ExportMode;
                          setExportMode(mode);
                          localStorage.setItem('snap-saver-export-mode', mode);
                        }}
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
                  onDestinationSelected={handleDestinationSelected}
                  currentStrategy={destStrategy}
                  currentHandle={destHandle}
                />

                {/* Start button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleExportStart}
                    disabled={!destStrategy}
                    className={`
                      px-8 py-3 text-lg font-medium rounded-lg
                      ${destStrategy
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
              <div className="space-y-4">
                <ProgressBar
                  progress={state.progress}
                  isVisible={true}
                />
                
                {/* Enhanced progress details */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{state.progress.copiedCount}</div>
                      <div className="text-gray-600">Saved</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{state.progress.skippedCount}</div>
                      <div className="text-gray-600">Skipped</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{Math.round(state.progress.percent)}%</div>
                      <div className="text-gray-600">Complete</div>
                    </div>
                  </div>
                  
                  {state.progress.currentFile && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                      <div className="font-medium text-gray-700">Current file:</div>
                      <div className="text-gray-600 truncate">{state.progress.currentFile}</div>
                      {state.progress.status && (
                        <div className="text-gray-500 mt-1">{state.progress.status}</div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center text-xs text-gray-500">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Keeping your screen awake during export
                  </div>
                  <button
                    onClick={handleExportCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
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
                    {state.destStrategy === "fs-access" 
                      ? "Your memories have been saved to your chosen folder."
                      : "Your memories have been downloaded as a ZIP file."
                    }
                  </p>
                  
                  {/* Show folder info for fs-access */}
                  {state.destStrategy === "fs-access" && folderInfo && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">Saved to folder:</h4>
                        <button
                          onClick={handleCopyPath}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            copySuccess 
                              ? "bg-green-100 text-green-800" 
                              : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                          }`}
                        >
                          {copySuccess ? "✓ Copied!" : "Copy Path"}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 font-mono bg-white p-2 rounded border">
                        {folderInfo.path}
                      </p>
                      <div className="mt-3 text-xs text-gray-500">
                        <p><strong>To open in Finder:</strong></p>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          <li>Open Finder</li>
                          <li>Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Cmd+Shift+G</kbd></li>
                          <li>Paste the path above</li>
                          <li>Press Enter</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center space-x-3">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
