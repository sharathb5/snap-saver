# Snap Saver - Development Guide

## Project Overview

Snap Saver is a desktop application built with Tauri (Rust backend) and React (TypeScript frontend) that helps users save their Snapchat memories before they're deleted due to Snapchat's 5 GiB free storage limit.

## Architecture

### Backend (Rust + Tauri)
- **Commands**: `scan`, `compute_risk`, `export_start`, `export_cancel`, `get_export_progress`
- **Database**: SQLite for manifest tracking and idempotent operations
- **File Processing**: Streaming ZIP extraction with SHA-256 hashing
- **Risk Analysis**: Sorts memories by date and identifies at-risk content beyond 5 GiB

### Frontend (React + TypeScript)
- **Components**: DropZone, Summary, DestinationPicker, ProgressBar
- **State Management**: React hooks with Zustand (ready for future use)
- **Styling**: Tailwind CSS with custom color scheme
- **API**: Tauri invoke/event system for backend communication

## Key Features Implemented

### ✅ Core Functionality
1. **ZIP File Scanning**: Parses Snapchat export ZIPs and extracts memory metadata
2. **Risk Analysis**: Calculates which memories are at-risk based on 5 GiB limit
3. **Smart Backup**: Option to save at-risk only or all memories
4. **Progress Tracking**: Real-time progress with detailed statistics
5. **Idempotent Operations**: SHA-256 hashing prevents duplicate copies
6. **Organized Output**: Date-based folder structure for easy browsing

### ✅ User Experience
1. **Drag & Drop**: Intuitive file selection
2. **Clear Summary**: Visual breakdown of safe vs at-risk memories
3. **Progress Feedback**: Real-time progress bar with current file
4. **Error Handling**: Comprehensive error messages and recovery
5. **Local-First**: No network access, all processing happens locally

### ✅ Technical Implementation
1. **Streaming Processing**: Handles large ZIP files without memory issues
2. **Database Persistence**: SQLite manifest for tracking and resumability
3. **Event System**: Real-time progress updates via Tauri events
4. **Type Safety**: Full TypeScript coverage with Rust type mirroring
5. **Error Recovery**: Graceful handling of corrupted files and missing data

## File Structure

```
snap-saver/
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── main.rs           # Tauri app entry point
│   │   ├── commands/         # Tauri commands
│   │   │   ├── scan.rs       # ZIP scanning logic
│   │   │   ├── risk.rs       # Risk analysis
│   │   │   ├── export.rs     # File export with progress
│   │   │   └── mod.rs        # Command exports
│   │   ├── model/            # Data models
│   │   │   ├── item.rs       # MemoryItem, ScanResult, etc.
│   │   │   └── mod.rs
│   │   └── db/               # Database layer
│   │       ├── manifest.rs   # SQLite operations
│   │       └── mod.rs
│   ├── Cargo.toml            # Rust dependencies
│   └── build.rs              # Build script
├── web/                      # React frontend
│   ├── src/
│   │   ├── App.tsx           # Main app component
│   │   ├── main.tsx          # React entry point
│   │   ├── components/       # UI components
│   │   │   ├── DropZone.tsx
│   │   │   ├── Summary.tsx
│   │   │   ├── DestinationPicker.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── lib/              # Utilities
│   │   │   ├── api.ts        # Tauri API helpers
│   │   │   └── types.ts      # TypeScript types
│   │   └── styles/
│   │       └── tailwind.css  # Tailwind imports
│   ├── index.html
│   └── vite.config.ts
├── test-data/                # Sample data for testing
│   ├── sample-memories.json
│   └── sample-export.zip
├── package.json              # Node.js dependencies
├── tauri.conf.json          # Tauri configuration
├── tailwind.config.js       # Tailwind configuration
├── setup.sh                 # Setup script
├── README.md                # User documentation
└── DEVELOPMENT.md           # This file
```

## Data Flow

1. **Scan Phase**:
   - User drops ZIP files → `scan_zips` command
   - Parse ZIP entries → Extract JSON index files
   - Normalize memory data → Return `ScanResult`

2. **Risk Analysis**:
   - Sort memories by date → `compute_risk` command
   - Accumulate sizes until 5 GiB → Identify at-risk items
   - Return `RiskSummary` with statistics

3. **Export Phase**:
   - User selects mode & destination → `export_start` command
   - Stream extract files → Compute SHA-256 → Save to date folders
   - Emit progress events → Update database manifest
   - Return completion status

## Database Schema

```sql
-- Items table: stores all discovered memories
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    created_at_iso TEXT NOT NULL,
    zip_path TEXT NOT NULL,
    size_bytes INTEGER,
    media_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hashes table: tracks file checksums
CREATE TABLE hashes (
    item_id TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items (id)
);

-- Copies table: tracks successful exports
CREATE TABLE copies (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    dest_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    copied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items (id)
);

-- Runs table: tracks export sessions
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    dest_dir TEXT NOT NULL,
    mode TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    copied_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running'
);
```

## Testing

### Manual Testing
1. Use `test-data/sample-export.zip` for basic functionality testing
2. Test with real Snapchat export ZIPs for full validation
3. Verify idempotent behavior by re-running exports
4. Test error handling with corrupted ZIP files

### Test Scenarios
- [ ] Single ZIP file processing
- [ ] Multiple ZIP file processing
- [ ] Large ZIP file handling (>1GB)
- [ ] Missing file sizes handling
- [ ] Corrupted ZIP file recovery
- [ ] Export cancellation
- [ ] Progress resumption
- [ ] Destination folder permissions

## Performance Considerations

### Memory Usage
- Streaming ZIP extraction prevents memory bloat
- Database operations are batched for efficiency
- Progress updates are throttled to prevent UI lag

### Disk Usage
- Temporary files are cleaned up automatically
- SHA-256 hashing prevents duplicate storage
- Date-based organization optimizes file system performance

### CPU Usage
- Background thread processing prevents UI blocking
- SHA-256 computation is optimized for streaming
- Database queries are indexed for fast lookups

## Security & Privacy

### Data Protection
- No network access - completely offline
- All processing happens locally
- No data collection or telemetry
- Source code is fully auditable

### File Safety
- Atomic file operations prevent corruption
- SHA-256 verification ensures integrity
- Temporary files are securely cleaned up
- Database transactions ensure consistency

## Future Enhancements

### Potential Features
1. **Google Drive Integration**: Optional cloud backup with resumable uploads
2. **Batch Processing**: Handle multiple export sessions
3. **Advanced Filtering**: Filter by date range, media type, etc.
4. **Export Formats**: Support for different output formats
5. **Compression**: Optional ZIP compression for exports
6. **Metadata Preservation**: Keep original file timestamps and attributes

### Technical Improvements
1. **Parallel Processing**: Multi-threaded ZIP extraction
2. **Progress Persistence**: Resume exports after app restart
3. **Advanced Error Recovery**: Retry failed operations
4. **Performance Monitoring**: Detailed timing and statistics
5. **Plugin System**: Extensible architecture for custom processors

## Troubleshooting

### Common Issues
1. **Rust Compilation Errors**: Ensure Rust toolchain is up to date
2. **Node.js Version**: Requires Node.js 16+ for Tauri compatibility
3. **Permission Errors**: Ensure destination folder is writable
4. **Memory Issues**: Large ZIP files may require more system RAM
5. **Database Locking**: Ensure only one export runs at a time

### Debug Mode
- Enable Rust debug logging with `RUST_LOG=debug`
- Check browser console for frontend errors
- Monitor system resources during large exports
- Use `cargo test` for unit test validation

## Contributing

### Development Setup
1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Install Node.js: Download from https://nodejs.org/
3. Run setup: `./setup.sh`
4. Start development: `npm run tauri dev`

### Code Standards
- Rust: Follow standard Rust formatting with `cargo fmt`
- TypeScript: Use strict mode and proper typing
- React: Functional components with hooks
- CSS: Tailwind utility classes only

### Testing Requirements
- All new features must include tests
- Manual testing with real Snapchat exports
- Performance testing with large datasets
- Error handling validation

This development guide provides a comprehensive overview of the Snap Saver application architecture, implementation details, and development practices.
