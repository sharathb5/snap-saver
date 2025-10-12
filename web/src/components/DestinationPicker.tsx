import { useCallback, useState, useEffect } from "react";
import { getFSAccessCapabilities, requestDirectoryAccess, getBrowserRecommendation } from "../lib/fsAccess";
import { FSAccessCapabilities } from "../lib/fsAccess";

interface DestinationPickerProps {
  onDestinationSelected: (strategy: "fs-access" | "download-zip", handle?: FileSystemDirectoryHandle) => void;
  disabled?: boolean;
  currentStrategy?: "fs-access" | "download-zip";
  currentHandle?: FileSystemDirectoryHandle;
}

export function DestinationPicker({ 
  onDestinationSelected, 
  disabled, 
  currentStrategy,
  currentHandle
}: DestinationPickerProps) {
  const [capabilities, setCapabilities] = useState<FSAccessCapabilities | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    getFSAccessCapabilities().then(setCapabilities);
  }, []);

  const handleChooseFolder = useCallback(async () => {
    if (disabled || isRequesting) return;

    setIsRequesting(true);
    try {
      const handle = await requestDirectoryAccess();
      if (handle) {
        onDestinationSelected("fs-access", handle);
      }
    } catch (error) {
      console.error("Failed to request directory access:", error);
      // Fallback to download-zip
      onDestinationSelected("download-zip");
    } finally {
      setIsRequesting(false);
    }
  }, [onDestinationSelected, disabled, isRequesting]);

  const handleDownloadZip = useCallback(() => {
    if (disabled) return;
    onDestinationSelected("download-zip");
  }, [onDestinationSelected, disabled]);

  if (!capabilities) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Backup Destination
        </label>
        <div className="animate-pulse bg-gray-200 h-10 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Backup Destination
      </label>
      
      <div className="space-y-3">
        {/* File System Access Option */}
        {capabilities.hasFileSystemAccess ? (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="destination"
                    value="fs-access"
                    checked={currentStrategy === "fs-access"}
                    onChange={handleChooseFolder}
                    disabled={disabled}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Choose folder (recommended)
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Save directly to your chosen folder with organized date structure
                </p>
                {currentHandle && (
                  <p className="text-xs text-success-600 mt-1 ml-6">
                    ✓ Selected: {currentHandle.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleChooseFolder}
                disabled={disabled || isRequesting}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md border
                  ${disabled || isRequesting
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  }
                `}
              >
                {isRequesting ? "Selecting..." : "Choose Folder"}
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="destination"
                value="fs-access"
                disabled={true}
                className="h-4 w-4 text-gray-400 border-gray-300"
              />
              <label className="text-sm font-medium text-gray-500">
                Choose folder (not available)
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              File System Access API not supported in this browser
            </p>
          </div>
        )}

        {/* Download ZIP Option */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="destination"
                      value="download-zip"
                      checked={currentStrategy === "download-zip"}
                      onChange={handleDownloadZip}
                      disabled={disabled}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Download organized files (.zip)
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Extract and organize your memories into a downloadable ZIP
                  </p>
                </div>
          </div>
        </div>
      </div>
      
      {/* Browser recommendation */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        <p><strong>Recommended:</strong> {getBrowserRecommendation()}</p>
        {!capabilities.hasFileSystemAccess && (
          <p className="mt-1">For large exports, use desktop Chrome/Edge for better performance.</p>
        )}
      </div>
    </div>
  );
}
