import React, { useCallback, useState } from "react";
import { open } from "@tauri-apps/api/dialog";

interface DestinationPickerProps {
  onDestinationSelected: (path: string) => void;
  disabled?: boolean;
  currentPath?: string;
}

export function DestinationPicker({ 
  onDestinationSelected, 
  disabled, 
  currentPath 
}: DestinationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled) return;

    try {
      const selected = await open({
        directory: true,
        title: "Choose backup destination",
        defaultPath: currentPath,
      });

      if (selected && typeof selected === "string") {
        onDestinationSelected(selected);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to open directory dialog:", error);
    }
  }, [onDestinationSelected, disabled, currentPath]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Backup Destination
      </label>
      
      <div className="flex space-x-2">
        <input
          type="text"
          value={currentPath || ""}
          placeholder="Choose a folder to save your memories..."
          readOnly
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={`
            px-4 py-2 text-sm font-medium rounded-md border
            ${disabled
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            }
          `}
        >
          Browse
        </button>
      </div>
      
      <p className="text-xs text-gray-500">
        Choose any local folder. Drive/OneDrive/iCloud folders work great for cloud sync.
      </p>
    </div>
  );
}
