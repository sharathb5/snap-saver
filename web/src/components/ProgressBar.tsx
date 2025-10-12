import { ExportProgress } from "../lib/types";

interface ProgressBarProps {
  progress: ExportProgress;
  isVisible: boolean;
}

export function ProgressBar({ progress, isVisible }: ProgressBarProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Backing up memories...</h3>
        <span className="text-sm font-medium text-gray-600">
          {progress.percent.toFixed(1)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress.percent, 100)}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold text-success-600">{progress.copiedCount}</div>
          <div className="text-gray-500">Copied</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-600">{progress.skippedCount}</div>
          <div className="text-gray-500">Skipped</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-danger-600">{progress.failedCount}</div>
          <div className="text-gray-500">Failed</div>
        </div>
      </div>

      {/* Current file and status */}
      <div className="space-y-1">
        {progress.currentFile && (
          <div className="text-sm text-gray-600 truncate">
            <span className="font-medium">Processing:</span> {progress.currentFile}
          </div>
        )}
        {progress.status && (
          <div className="text-sm text-gray-500">
            {progress.status}
          </div>
        )}
      </div>
    </div>
  );
}
