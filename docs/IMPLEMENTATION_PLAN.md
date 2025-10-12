# Implementation Plan

## Overview
This document outlines the complete implementation plan for the Snap Saver app, including all components, utilities, and features needed for a resume-grade project.

## File Structure

### Core Application Files
```
web/
  src/
    App.tsx                    # ✅ Main application component
    components/
      DropZone.tsx            # ✅ File drop zone with validation
      Summary.tsx             # ✅ Risk analysis and memory summary
      DestinationPicker.tsx   # ✅ Export destination selection
      ProgressBar.tsx         # ✅ Export progress display
      Footer.tsx              # ✅ Application footer
      StickySummary.tsx       # ❌ Pinned summary during export
      RiskTimeline.tsx        # ❌ Visual risk timeline component
    lib/
      risk.ts                 # ❌ Risk calculation logic
      fsAccess.ts             # ❌ File System Access API wrapper
      idb.ts                  # ❌ IndexedDB operations
      types.ts                # ✅ TypeScript type definitions
      wakeLock.ts             # ✅ Wake Lock API management
      zipUtils.ts             # ❌ ZIP utility functions
      metrics.ts              # ❌ Performance metrics tracking
    workers/
      unzip.worker.ts         # ✅ ZIP parsing and HTML extraction
      export.worker.ts        # ✅ File download and export logic
      hash.worker.ts          # ✅ File hashing operations
    sw/
      service-worker.ts       # ❌ Service worker implementation
  public/
    manifest.webmanifest      # ❌ PWA manifest
    icons/                    # ❌ PWA icons
  tests/
    fixtures/                 # ❌ Test data files
      small_export.zip        # ❌ Small test export
      large_export.zip        # ❌ Large test export
      corrupted.zip           # ❌ Corrupted test file
```

## Implementation Details

### 1. StickySummary Component
```typescript
// src/components/StickySummary.tsx
interface StickySummaryProps {
  progress: ExportProgress;
  isVisible: boolean;
}

export function StickySummary({ progress, isVisible }: StickySummaryProps) {
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border">
      <div className="flex items-center space-x-4">
        <div className="text-sm">
          <div className="font-semibold">Export Progress</div>
          <div className="text-gray-600">
            {progress.copiedCount} saved • {progress.skippedCount} skipped
          </div>
        </div>
        <div className="w-16 h-16 relative">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32" cy="32" r="28"
              stroke="currentColor" strokeWidth="4"
              fill="transparent" className="text-gray-200"
            />
            <circle
              cx="32" cy="32" r="28"
              stroke="currentColor" strokeWidth="4"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress.percent / 100)}`}
              className="text-blue-600"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {Math.round(progress.percent)}%
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 2. RiskTimeline Component
```typescript
// src/components/RiskTimeline.tsx
interface RiskTimelineProps {
  summary: RiskSummary;
  items: MemoryItem[];
}

export function RiskTimeline({ summary, items }: RiskTimelineProps) {
  const timelineData = useMemo(() => {
    // Group items by month and calculate risk
    const monthlyData = items.reduce((acc, item) => {
      const month = new Date(item.createdAtIso).toISOString().slice(0, 7);
      if (!acc[month]) {
        acc[month] = { total: 0, atRisk: 0, safe: 0 };
      }
      acc[month].total++;
      if (item.sizeBytes && item.sizeBytes > summary.safeFloorGiB * 1024 * 1024 * 1024) {
        acc[month].atRisk++;
      } else {
        acc[month].safe++;
      }
      return acc;
    }, {} as Record<string, { total: number; atRisk: number; safe: number }>);
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        atRiskPercent: (data.atRisk / data.total) * 100
      }));
  }, [summary, items]);

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Risk Timeline</h3>
      <div className="space-y-3">
        {timelineData.map(({ month, total, atRisk, safe, atRiskPercent }) => (
          <div key={month} className="flex items-center space-x-4">
            <div className="w-20 text-sm text-gray-600">{month}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
              <div
                className="bg-green-500 h-4 rounded-l-full"
                style={{ width: `${(safe / total) * 100}%` }}
              />
              <div
                className="bg-red-500 h-4 rounded-r-full"
                style={{ width: `${(atRisk / total) * 100}%` }}
              />
            </div>
            <div className="w-16 text-sm text-gray-600">
              {atRisk}/{total}
            </div>
            <div className="w-12 text-sm font-semibold">
              {atRiskPercent.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Risk Calculation Logic
```typescript
// src/lib/risk.ts
export interface RiskSummary {
  totalItems: number;
  totalSizeBytes: number;
  safeItems: number;
  atRiskItems: number;
  firstAtRiskDate?: string;
  safeFloorGiB: number;
  atRiskSizeBytes: number;
}

export function calculateRiskSummary(items: MemoryItem[]): RiskSummary {
  const SAFE_FLOOR_GB = 5;
  const SAFE_FLOOR_BYTES = SAFE_FLOOR_GB * 1024 * 1024 * 1024;
  
  // Sort items by creation date (oldest first)
  const sortedItems = [...items].sort((a, b) => 
    new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime()
  );
  
  let cumulativeSize = 0;
  let firstAtRiskDate: string | undefined;
  let atRiskSizeBytes = 0;
  
  const summary: RiskSummary = {
    totalItems: items.length,
    totalSizeBytes: items.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    safeItems: 0,
    atRiskItems: 0,
    safeFloorGiB: SAFE_FLOOR_GB,
    atRiskSizeBytes: 0
  };
  
  for (const item of sortedItems) {
    const itemSize = item.sizeBytes || 0;
    
    if (cumulativeSize + itemSize <= SAFE_FLOOR_BYTES) {
      summary.safeItems++;
      cumulativeSize += itemSize;
    } else {
      summary.atRiskItems++;
      atRiskSizeBytes += itemSize;
      
      if (!firstAtRiskDate) {
        firstAtRiskDate = item.createdAtIso;
      }
    }
  }
  
  summary.atRiskSizeBytes = atRiskSizeBytes;
  summary.firstAtRiskDate = firstAtRiskDate;
  
  return summary;
}
```

### 4. File System Access Wrapper
```typescript
// src/lib/fsAccess.ts
export class FSAccessManager {
  private static instance: FSAccessManager;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  
  static getInstance(): FSAccessManager {
    if (!FSAccessManager.instance) {
      FSAccessManager.instance = new FSAccessManager();
    }
    return FSAccessManager.instance;
  }
  
  async isSupported(): Promise<boolean> {
    return 'showDirectoryPicker' in window;
  }
  
  async requestDirectory(): Promise<FileSystemDirectoryHandle | null> {
    try {
      if (!await this.isSupported()) {
        throw new Error('File System Access API not supported');
      }
      
      this.directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      return this.directoryHandle;
    } catch (error) {
      console.error('Failed to request directory:', error);
      return null;
    }
  }
  
  async getDirectory(): Promise<FileSystemDirectoryHandle | null> {
    return this.directoryHandle;
  }
  
  async saveFile(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }
    
    try {
      const pathParts = path.split('/');
      const fileName = pathParts.pop()!;
      const dirPath = pathParts.join('/');
      
      let currentDir = this.directoryHandle;
      
      // Navigate to the target directory
      for (const part of dirPath.split('/').filter(Boolean)) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      
      // Create the file
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      
      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }
}
```

### 5. IndexedDB Wrapper
```typescript
// src/lib/idb.ts
interface FileHashRecord {
  id: string;
  sha256: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}

export class IDBWrapper {
  private dbName = 'snap-saver';
  private version = 1;
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('fileHashes')) {
          const store = db.createObjectStore('fileHashes', { keyPath: 'id' });
          store.createIndex('sha256', 'sha256', { unique: false });
          store.createIndex('path', 'path', { unique: false });
        }
      };
    });
  }
  
  async storeFileHash(record: FileHashRecord): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['fileHashes'], 'readwrite');
      const store = transaction.objectStore('fileHashes');
      const request = store.put(record);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  
  async getFileHash(id: string): Promise<FileHashRecord | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['fileHashes'], 'readonly');
      const store = transaction.objectStore('fileHashes');
      const request = store.get(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  
  async getFileByHash(sha256: string): Promise<FileHashRecord | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['fileHashes'], 'readonly');
      const store = transaction.objectStore('fileHashes');
      const index = store.index('sha256');
      const request = index.get(sha256);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
}
```

### 6. Service Worker
```typescript
// src/sw/service-worker.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Cache API responses with stale-while-revalidate
registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new StaleWhileRevalidate()
);

// Cache Snapchat downloads with cache-first strategy
registerRoute(
  ({ url }) => url.hostname === 'www.snapchat.com',
  new CacheFirst({
    cacheName: 'snapchat-downloads',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          // Use URL as cache key
          return request.url;
        },
        cacheWillUpdate: async ({ response }) => {
          // Only cache successful responses
          return response.status === 200 ? response : null;
        },
      },
    ],
  })
);

// Handle offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Handle background sync for failed downloads
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Retry failed downloads when back online
  const failedDownloads = await getFailedDownloads();
  for (const download of failedDownloads) {
    try {
      await retryDownload(download);
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}
```

### 7. PWA Manifest
```json
// public/manifest.webmanifest
{
  "name": "Snap Saver",
  "short_name": "SnapSaver",
  "description": "Save your Snapchat memories before they're deleted",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "en",
  "dir": "ltr",
  "scope": "/",
  "prefer_related_applications": false
}
```

## Testing Implementation

### 1. Unit Tests
```typescript
// tests/risk.test.ts
import { describe, test, expect } from 'vitest';
import { calculateRiskSummary } from '../src/lib/risk';
import { generateTestItems } from './utils/testData';

describe('Risk Calculation', () => {
  test('calculates 5GB safe floor correctly', () => {
    const items = generateTestItems(1000);
    const summary = calculateRiskSummary(items);
    
    expect(summary.safeFloorGiB).toBe(5);
    expect(summary.atRiskItems).toBeGreaterThan(0);
    expect(summary.safeItems + summary.atRiskItems).toBe(summary.totalItems);
  });
  
  test('handles empty item list', () => {
    const summary = calculateRiskSummary([]);
    
    expect(summary.totalItems).toBe(0);
    expect(summary.atRiskItems).toBe(0);
    expect(summary.safeItems).toBe(0);
  });
});
```

### 2. Integration Tests
```typescript
// tests/worker-integration.test.ts
import { describe, test, expect } from 'vitest';
import { UnzipWorker } from '../src/workers/unzip.worker';
import { loadTestFixture } from './utils/fixtures';

describe('Worker Integration', () => {
  test('unzip worker processes test ZIP correctly', async () => {
    const worker = new UnzipWorker();
    const testZip = await loadTestFixture('small_export.zip');
    
    const result = await worker.parseZip(testZip);
    
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toMatchObject({
      mediaType: expect.oneOf(['photo', 'video']),
      createdAtIso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      zipPath: expect.stringContaining('snapchat.com')
    });
  });
});
```

### 3. E2E Tests
```typescript
// cypress/e2e/export-flow.cy.ts
describe('Complete Export Flow', () => {
  it('successfully exports Snapchat memories', () => {
    cy.visit('/');
    
    // Upload test ZIP
    cy.get('[data-testid="drop-zone"]').selectFile('fixtures/test_export.zip');
    
    // Wait for scan completion
    cy.get('[data-testid="summary"]').should('be.visible');
    cy.get('[data-testid="at-risk-count"]').should('contain', '5');
    
    // Select export mode
    cy.get('[data-testid="export-mode-at-risk"]').check();
    
    // Start export
    cy.get('[data-testid="start-export"]').click();
    
    // Wait for completion
    cy.get('[data-testid="progress-bar"]').should('be.visible');
    cy.get('[data-testid="completion-message"]', { timeout: 60000 }).should('be.visible');
    
    // Verify download
    cy.get('[data-testid="download-link"]').should('be.visible');
  });
});
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Unit tests
        run: npm run test:unit
      
      - name: Build
        run: npm run build
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Lighthouse CI
        run: npm run lighthouse
```

## Implementation Priority

### Phase 1 (Critical)
1. ✅ Core application functionality
2. ✅ ZIP parsing and HTML extraction
3. ✅ Risk calculation and analysis
4. ✅ File download and export
5. ✅ Progress tracking and UI
6. ✅ Basic error handling
7. ✅ UX improvements and polish

### Phase 2 (Important)
1. ❌ StickySummary component
2. ❌ RiskTimeline component
3. ❌ Service worker implementation
4. ❌ PWA manifest and icons
5. ❌ IndexedDB wrapper
6. ❌ File System Access wrapper

### Phase 3 (Enhancement)
1. ❌ Comprehensive test suite
2. ❌ CI/CD pipeline
3. ❌ Performance monitoring
4. ❌ Advanced accessibility features
5. ❌ Error recovery mechanisms

## Conclusion

This implementation plan provides a complete roadmap for transforming the Snap Saver app into a professional-grade project. The core functionality is already implemented and working, with the remaining items focusing on polish, testing, and production readiness.

The plan prioritizes the most important features first, ensuring that the app remains functional while adding professional-grade features and documentation. Each component is designed to be modular and testable, following best practices for maintainable code.
