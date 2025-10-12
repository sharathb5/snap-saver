import React, { useCallback, useState } from "react";
import { open } from "@tauri-apps/api/dialog";

interface DropZoneProps {
  onFilesSelected: (files: string[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const zipFiles = files
      .filter(file => file.name.toLowerCase().endsWith('.zip'))
      .map(file => file.path);
    
    if (zipFiles.length > 0) {
      onFilesSelected(zipFiles);
    }
  }, [onFilesSelected, disabled]);

  const handleClick = useCallback(async () => {
    if (disabled) return;

    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "ZIP files",
            extensions: ["zip"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        onFilesSelected(selected);
      }
    } catch (error) {
      console.error("Failed to open file dialog:", error);
    }
  }, [onFilesSelected, disabled]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${isDragOver 
          ? "border-primary-500 bg-primary-50" 
          : "border-gray-300 hover:border-gray-400"
        }
        ${disabled 
          ? "opacity-50 cursor-not-allowed" 
          : "cursor-pointer hover:bg-gray-50"
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 text-gray-400">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        
        <div>
          <p className="text-lg font-medium text-gray-900">
            {disabled ? "Processing..." : "Drop your Snapchat export ZIP here"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {disabled 
              ? "Please wait while we scan your files" 
              : "or click to browse for ZIP files"
            }
          </p>
        </div>
        
        {!disabled && (
          <div className="text-xs text-gray-400">
            <p>Everything happens on your device.</p>
            <p>We don't upload or store your files.</p>
          </div>
        )}
      </div>
    </div>
  );
}
