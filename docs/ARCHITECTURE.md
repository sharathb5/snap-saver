# Architecture Overview

## System Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant UW as UnzipWorker
    participant EW as ExportWorker
    participant IDB as IndexedDB
    participant FS as FileSystem

    U->>UI: Drop ZIP file(s)
    UI->>UW: Parse ZIP files
    UW->>UW: Extract memories_history.html
    UW->>UW: Parse HTML tables
    UW->>UW: Extract download URLs
    UW->>UI: Return MemoryItem[]
    
    UI->>UI: Calculate risk summary
    UI->>U: Show at-risk vs safe breakdown
    
    U->>UI: Choose export mode & destination
    UI->>EW: Start export with items
    EW->>EW: Download from URLs
    EW->>EW: Hash & validate files
    EW->>IDB: Cache file hashes
    EW->>FS: Write organized files
    EW->>UI: Progress updates
    EW->>UI: Completion with manifest
```

## Component Architecture

```mermaid
graph TB
    subgraph "UI Layer"
        A[App.tsx]
        DZ[DropZone.tsx]
        S[Summary.tsx]
        DP[DestinationPicker.tsx]
        PB[ProgressBar.tsx]
        SS[StickySummary.tsx]
        RT[RiskTimeline.tsx]
    end
    
    subgraph "Worker Layer"
        UW[UnzipWorker]
        EW[ExportWorker]
    end
    
    subgraph "Storage Layer"
        IDB[IndexedDB]
        FS[FileSystem Access]
    end
    
    subgraph "Utilities"
        R[risk.ts]
        Z[zipUtils.ts]
        M[metrics.ts]
        WL[wakeLock.ts]
    end
    
    A --> DZ
    A --> S
    A --> DP
    A --> PB
    A --> SS
    A --> RT
    
    DZ --> UW
    S --> R
    DP --> FS
    PB --> EW
    
    UW --> Z
    EW --> IDB
    EW --> FS
    EW --> M
    EW --> WL
```

## Data Models

### MemoryItem
```typescript
interface MemoryItem {
  id: string;                    // Unique identifier
  createdAtIso: string;         // ISO timestamp
  zipPath: string;              // Download URL or ZIP path
  sizeBytes?: number;           // File size (filled during download)
  mediaType: 'photo' | 'video'; // Media type
  originalName: string;         // Original filename
  sha256?: string;              // Hash for deduplication
}
```

### RiskSummary
```typescript
interface RiskSummary {
  totalItems: number;
  totalSizeBytes: number;
  safeItems: number;
  atRiskItems: number;
  firstAtRiskDate?: string;     // Oldest at-risk item
  safeFloorGiB: number;         // 5 GiB threshold
  atRiskSizeBytes: number;      // Size of at-risk items
}
```

### ExportProgress
```typescript
interface ExportProgress {
  percent: number;
  copiedCount: number;
  skippedCount: number;
  failedCount: number;
  currentFile?: string;
  status?: string;
  speedMBps?: number;
  eta?: string;
}
```

### Manifest
```typescript
interface Manifest {
  version: string;
  exportedAt: string;
  mode: 'at-risk' | 'all';
  destStrategy: 'fs-access' | 'download-zip';
  stats: {
    copiedCount: number;
    skippedCount: number;
    failedCount: number;
    totalItems: number;
  };
  files: Array<{
    id: string;
    path: string;
    sizeBytes: number;
    sha256: string;
    copiedAt: string;
  }>;
}
```

## Key Design Decisions

### 1. Worker-Based Architecture
- **UnzipWorker**: Handles ZIP parsing and HTML extraction
- **ExportWorker**: Manages file downloads and writes
- **Benefits**: Non-blocking UI, better error isolation, parallel processing

### 2. Streaming File Processing
- **Memory Efficiency**: Process large files without loading entirely into memory
- **Progress Tracking**: Real-time progress updates during long operations
- **Resume Capability**: Can pause/resume exports without losing progress

### 3. Idempotent Operations
- **Hash-Based Deduplication**: SHA-256 hashes prevent duplicate downloads
- **IndexedDB Cache**: Persistent storage of file metadata and hashes
- **Atomic Writes**: File system operations are atomic to prevent corruption

### 4. Graceful Degradation
- **File System Access**: Primary method with download ZIP fallback
- **Browser Compatibility**: Progressive enhancement for different capabilities
- **Error Recovery**: Retry mechanisms and user-friendly error messages

## Performance Considerations

### Memory Management
- **Streaming**: Large files processed in chunks
- **Worker Isolation**: Heavy processing in separate threads
- **Garbage Collection**: Explicit cleanup of large objects

### Network Optimization
- **Concurrent Downloads**: Bounded concurrency to avoid overwhelming servers
- **Retry Logic**: Exponential backoff for failed requests
- **Timeout Handling**: 30-second timeouts prevent hanging requests

### File System Efficiency
- **Batch Operations**: Group file system operations where possible
- **Directory Structure**: Organized by date for easy browsing
- **Atomic Writes**: Prevent partial file corruption
