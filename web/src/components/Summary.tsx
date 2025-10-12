import { ScanResult, RiskSummary, formatBytes, formatDate } from "../lib/types";

interface SummaryProps {
  scanResult: ScanResult;
  riskSummary: RiskSummary;
}

export function Summary({ scanResult, riskSummary }: SummaryProps) {
  const totalItems = scanResult.items.length;
  const safePercentage = totalItems > 0 ? (riskSummary.safeCount / totalItems) * 100 : 0;
  const atRiskPercentage = totalItems > 0 ? (riskSummary.atRiskCount / totalItems) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Complete</h2>
        <p className="text-gray-600">
          Found {totalItems.toLocaleString()} memories totaling {formatBytes(scanResult.totalBytes)}
        </p>
        {scanResult.missingSizesCount > 0 && (
          <p className="text-sm text-amber-600 mt-1">
            Note: {scanResult.missingSizesCount} files have unknown sizes
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Safe Items */}
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-success-800">Safe (≤5 GiB)</h3>
            <span className="text-2xl font-bold text-success-600">
              {safePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-success-700">
              {riskSummary.safeCount.toLocaleString()} items
            </p>
            <p className="text-sm text-success-700">
              {formatBytes(riskSummary.safeBytes)}
            </p>
          </div>
        </div>

        {/* At-Risk Items */}
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-danger-800">At Risk (overflow)</h3>
            <span className="text-2xl font-bold text-danger-600">
              {atRiskPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-danger-700">
              {riskSummary.atRiskCount.toLocaleString()} items
            </p>
            <p className="text-sm text-danger-700">
              {formatBytes(riskSummary.atRiskBytes)}
            </p>
          </div>
        </div>
      </div>

      {/* Risk Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-blue-900">About Snapchat's 5 GiB Limit</h4>
            <p className="text-sm text-blue-800 mt-1">
              Snapchat keeps the <strong>oldest</strong> 5 GiB safe. Anything newer beyond that may be deleted after a grace period. 
              We'll save those 'at-risk' items now.
            </p>
            {riskSummary.atRiskStartIso && (
              <p className="text-sm text-blue-800 mt-2">
                <strong>First at-risk date:</strong> {formatDate(riskSummary.atRiskStartIso)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
