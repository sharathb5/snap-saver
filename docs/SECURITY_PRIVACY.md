# Security & Privacy

## Local-First Guarantees

### No Data Transmission
- **Zero Uploads**: All processing happens client-side in the user's browser
- **No Server Communication**: No data sent to external servers during normal operation
- **Offline Capable**: Full functionality without internet connection after initial load

### Data Isolation
- **Browser Sandbox**: All operations contained within browser security model
- **No Cross-Origin Requests**: Only processes local files and official Snapchat URLs
- **Memory Cleanup**: Sensitive data cleared from memory after processing

## Privacy Protection

### What Data is Stored Locally
- **File Hashes**: SHA-256 hashes for deduplication (no file content)
- **Export Metadata**: Timestamps, file counts, export settings
- **User Preferences**: Last used export mode and destination (localStorage)
- **No File Content**: Actual media files are never stored in browser storage

### What Data is NOT Stored
- **File Contents**: Media files are only written to user-selected directories
- **Personal Information**: No usernames, phone numbers, or personal data
- **Network Requests**: No tracking of download URLs or request patterns
- **Analytics Data**: Optional pageview count only (off by default)

## Threat Model & Mitigations

### Browser Tab Closure
- **Threat**: User closes tab during long export, losing progress
- **Mitigation**: Wake Lock API keeps screen active, progress persisted in IndexedDB
- **Recovery**: Export can resume from last checkpoint

### Memory Pressure
- **Threat**: Large exports cause browser memory issues
- **Mitigation**: Streaming processing, bounded concurrency, explicit cleanup
- **Monitoring**: Memory usage tracked and reported to user

### Browser Throttling
- **Threat**: Browser throttles background tabs, slowing exports
- **Mitigation**: Wake Lock prevents throttling, user notification about tab focus
- **Fallback**: Graceful degradation with progress preservation

### File System Corruption
- **Threat**: Partial writes or file system errors
- **Mitigation**: Atomic file operations, hash verification, retry mechanisms
- **Recovery**: Idempotent operations allow safe re-runs

### Network Security
- **Threat**: Malicious URLs or network attacks
- **Mitigation**: Only official Snapchat domains allowed, timeout protection
- **Validation**: File type validation and size limits

## Security Best Practices

### Input Validation
- **File Type Checking**: Only ZIP files accepted
- **Size Limits**: Reasonable file size bounds to prevent abuse
- **URL Validation**: Only official Snapchat download URLs processed

### Error Handling
- **No Sensitive Data in Logs**: Error messages don't expose file paths or content
- **Graceful Failures**: Errors don't crash the application
- **User Notification**: Clear error messages without technical details

### Code Security
- **No Eval**: No dynamic code execution
- **Content Security Policy**: Strict CSP headers prevent XSS
- **Dependency Scanning**: Regular security audits of dependencies

## Compliance & Legal

### GDPR Compliance
- **No Personal Data Collection**: App doesn't collect or process personal data
- **Local Processing**: All data stays on user's device
- **User Control**: Users have full control over their data

### Terms of Service
- **Official Exports Only**: Only processes official Snapchat export files
- **No Scraping**: No automated data collection from Snapchat
- **Fair Use**: Respects Snapchat's terms and rate limits

### Disclaimer
- **Not Affiliated**: Not officially associated with Snapchat
- **User Responsibility**: Users responsible for complying with Snapchat's ToS
- **No Warranty**: Software provided as-is without guarantees

## Running Offline

### Initial Setup
1. Load the PWA in browser with internet connection
2. Service worker caches all necessary resources
3. App becomes fully functional offline

### Offline Capabilities
- **File Processing**: All ZIP parsing and analysis works offline
- **Export Operations**: File system exports work without internet
- **Progress Tracking**: All progress and state management works offline
- **Error Recovery**: Retry mechanisms work offline

### Limitations
- **Download URLs**: Cannot download from Snapchat URLs without internet
- **Updates**: Cannot check for app updates
- **Analytics**: Optional analytics disabled when offline

## Data Retention

### Browser Storage
- **IndexedDB**: File hashes and metadata persist until manually cleared
- **localStorage**: User preferences persist across sessions
- **Cache**: Service worker cache persists until storage quota exceeded

### User Control
- **Clear Data**: Users can clear all stored data via browser settings
- **Export Data**: Users can export their data via standard file operations
- **No Backups**: No automatic backups to external services
