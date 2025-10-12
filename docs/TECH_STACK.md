# Tech Stack & Rationale

## Core Framework
- **Vite + React + TypeScript + Tailwind**: Fast development with HMR, type safety, and utility-first styling. Vite's esbuild provides lightning-fast builds and hot reloading essential for rapid iteration on complex parsing logic.

## Workers & Threading
- **Web Workers + Comlink**: Offloads heavy ZIP parsing and file processing to background threads, preventing UI blocking during multi-GB operations. Comlink provides clean async/await API for worker communication.

## File Processing
- **fflate**: Lightweight, fast ZIP library with streaming support. Handles large archives efficiently without loading entire files into memory. Superior to zip.js for performance and bundle size.
- **Streams API**: Enables streaming file processing for memory-efficient handling of large Snapchat exports without browser crashes.

## Cryptography & Storage
- **Web Crypto (SHA-256)**: Native browser crypto for file integrity verification and duplicate detection. No external dependencies, secure, and performant.
- **IndexedDB**: Client-side storage for manifest cache, hash verification, and export state persistence. Enables idempotent re-runs and offline functionality.

## File System Access
- **File System Access API**: Direct folder selection and atomic writes. Graceful fallback to download ZIP when not supported (Safari/iOS). Provides native file system integration without server dependencies.

## PWA & Offline
- **Manifest + Service Worker**: Full PWA capabilities with offline app shell. Enables installation and background processing for long-running exports.

## Testing & Quality
- **Vitest + Testing Library**: Fast unit testing with React component testing. Vitest provides Vite-native testing with excellent TypeScript support.
- **Cypress e2e**: End-to-end testing for complete user flows (drop ZIP → scan → export). Critical for validating complex worker interactions and file processing.

## Code Quality
- **ESLint + Prettier**: Consistent code formatting and linting. Prettier handles formatting, ESLint catches bugs and enforces best practices.
- **TypeScript strictest reasonable**: Maximum type safety without being overly restrictive. Catches errors at compile time and improves developer experience.

## CI/CD
- **GitHub Actions**: Automated linting, type checking, unit tests, Cypress e2e, and Lighthouse CI. Ensures code quality and performance standards across all commits.

## Accessibility & Performance
- **Axe checks + WCAG AA**: Automated accessibility testing and manual compliance verification. Ensures app is usable by all users.
- **Web Vitals + Bundle Analysis**: Performance monitoring and optimization. Critical for handling large file operations without degrading user experience.

## Analytics (Optional)
- **Privacy-safe pageview count**: Minimal analytics with no file names or media tracking. Off by default, respects user privacy while providing basic usage insights.

## Alternatives Considered

### Desktop Apps (Electron/Tauri)
- **Rejected**: Adds complexity, larger bundle size, platform-specific builds. Web PWA provides better cross-platform compatibility and easier deployment.

### zip.js
- **Rejected**: Larger bundle size, less performant than fflate for our use case. fflate's streaming capabilities better suited for large file processing.

### Workbox
- **Rejected**: Overkill for our simple PWA needs. Custom service worker provides better control over caching strategy for file processing.

### Server-Side Processing
- **Rejected**: Violates local-first principle, adds security concerns, requires hosting costs. Client-side processing ensures user privacy and data control.
