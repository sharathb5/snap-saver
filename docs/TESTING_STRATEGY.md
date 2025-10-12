# Testing Strategy

## Testing Pyramid

### Unit Tests (70%)
- **Core Logic**: Risk calculation, file parsing, hash generation
- **Utilities**: Date formatting, file size conversion, validation
- **Components**: React component rendering and interaction
- **Workers**: Worker message handling and data processing

### Integration Tests (20%)
- **Worker Communication**: Main thread ↔ worker message passing
- **Storage Operations**: IndexedDB read/write operations
- **File System**: File System Access API integration
- **Component Integration**: Multi-component user flows

### End-to-End Tests (10%)
- **Complete User Journey**: Drop ZIP → scan → export → verify
- **Error Scenarios**: Network failures, file corruption, user interruption
- **Cross-Browser**: Chrome, Firefox, Safari compatibility
- **Performance**: Large file handling, memory usage

## Unit Testing (Vitest)

### Core Logic Tests
```typescript
// risk.test.ts
describe('Risk Calculation', () => {
  test('calculates 5GB safe floor correctly', () => {
    const items = generateTestItems(1000);
    const summary = calculateRiskSummary(items);
    expect(summary.safeFloorGiB).toBe(5);
    expect(summary.atRiskItems).toBeGreaterThan(0);
  });

  test('handles empty item list', () => {
    const summary = calculateRiskSummary([]);
    expect(summary.totalItems).toBe(0);
    expect(summary.atRiskItems).toBe(0);
  });
});
```

### Component Tests
```typescript
// DropZone.test.tsx
describe('DropZone Component', () => {
  test('renders drop zone with correct accessibility attributes', () => {
    render(<DropZone onFilesSelected={jest.fn()} />);
    
    const dropZone = screen.getByRole('button');
    expect(dropZone).toHaveAttribute('aria-label', 'Drop zone for Snapchat export files');
    expect(dropZone).toHaveAttribute('tabindex', '0');
  });

  test('calls onFilesSelected when files are dropped', async () => {
    const mockCallback = jest.fn();
    render(<DropZone onFilesSelected={mockCallback} />);
    
    const file = new File(['test'], 'test.zip', { type: 'application/zip' });
    const dropZone = screen.getByRole('button');
    
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    
    expect(mockCallback).toHaveBeenCalledWith([file]);
  });
});
```

### Worker Tests
```typescript
// unzip.worker.test.ts
describe('UnzipWorker', () => {
  test('parses Snapchat export ZIP correctly', async () => {
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

## Integration Testing

### Worker Communication
```typescript
// worker-integration.test.ts
describe('Worker Integration', () => {
  test('export worker communicates progress correctly', async () => {
    const worker = new ExportWorker();
    const progressUpdates: ExportProgress[] = [];
    
    worker.onProgress = (progress) => progressUpdates.push(progress);
    
    await worker.exportFiles(testItems, testPlan, testZipFiles);
    
    expect(progressUpdates).toHaveLength(greaterThan(0));
    expect(progressUpdates[0].percent).toBe(0);
    expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
  });
});
```

### Storage Integration
```typescript
// storage.test.ts
describe('IndexedDB Integration', () => {
  test('stores and retrieves file hashes correctly', async () => {
    const db = new IDBWrapper();
    const testHash = 'abc123def456';
    const testPath = '/test/file.jpg';
    
    await db.storeFileHash(testHash, testPath);
    const retrieved = await db.getFileHash(testPath);
    
    expect(retrieved).toBe(testHash);
  });
});
```

## End-to-End Testing (Cypress)

### Happy Path Test
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

### Error Handling Test
```typescript
// cypress/e2e/error-scenarios.cy.ts
describe('Error Scenarios', () => {
  it('handles corrupted ZIP files gracefully', () => {
    cy.visit('/');
    
    cy.get('[data-testid="drop-zone"]').selectFile('fixtures/corrupted.zip');
    
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="error-message"]').should('contain', 'Invalid ZIP file');
  });

  it('handles network failures during export', () => {
    cy.visit('/');
    
    // Mock network failure
    cy.intercept('GET', 'https://www.snapchat.com/dmd/mm*', { forceNetworkError: true });
    
    cy.get('[data-testid="drop-zone"]').selectFile('fixtures/test_export.zip');
    cy.get('[data-testid="start-export"]').click();
    
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.get('[data-testid="retry-button"]').should('be.visible');
  });
});
```

### Performance Test
```typescript
// cypress/e2e/performance.cy.ts
describe('Performance Tests', () => {
  it('handles large exports without memory issues', () => {
    cy.visit('/');
    
    // Monitor memory usage
    cy.window().then((win) => {
      const initialMemory = win.performance.memory?.usedJSHeapSize || 0;
      
      cy.get('[data-testid="drop-zone"]').selectFile('fixtures/large_export.zip');
      cy.get('[data-testid="start-export"]').click();
      
      // Wait for completion
      cy.get('[data-testid="completion-message"]', { timeout: 120000 }).should('be.visible');
      
      // Check memory usage
      cy.window().then((win) => {
        const finalMemory = win.performance.memory?.usedJSHeapSize || 0;
        const memoryIncrease = finalMemory - initialMemory;
        
        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).to.be.lessThan(100 * 1024 * 1024);
      });
    });
  });
});
```

## Test Fixtures

### Small Test Export
- **File**: `tests/fixtures/small_export.zip`
- **Contents**: 10 memory items, ~50MB total
- **Purpose**: Fast unit and integration tests

### Large Test Export
- **File**: `tests/fixtures/large_export.zip`
- **Contents**: 1000+ memory items, ~2GB total
- **Purpose**: Performance and memory testing

### Corrupted Test Files
- **File**: `tests/fixtures/corrupted.zip`
- **Contents**: Invalid ZIP structure
- **Purpose**: Error handling tests

### Edge Case Files
- **File**: `tests/fixtures/edge_cases.zip`
- **Contents**: Unusual file names, special characters
- **Purpose**: Robustness testing

## Test Data Generation

### Synthetic Memory Items
```typescript
// test-utils/generateTestData.ts
export function generateTestItems(count: number): MemoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-${i}`,
    createdAtIso: new Date(Date.now() - i * 86400000).toISOString(),
    zipPath: `https://www.snapchat.com/dmd/mm?test=${i}`,
    sizeBytes: Math.floor(Math.random() * 10 * 1024 * 1024), // 0-10MB
    mediaType: Math.random() > 0.5 ? 'photo' : 'video',
    originalName: `test_${i}.${Math.random() > 0.5 ? 'jpg' : 'mp4'}`
  }));
}
```

## Continuous Integration

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

## Test Coverage Goals

### Unit Tests
- **Target**: 90% code coverage
- **Critical Paths**: 100% coverage for risk calculation, file parsing
- **Components**: 80% coverage for UI components

### Integration Tests
- **Worker Communication**: 100% coverage
- **Storage Operations**: 100% coverage
- **File System**: 90% coverage

### E2E Tests
- **Happy Path**: 100% coverage
- **Error Scenarios**: 80% coverage
- **Cross-Browser**: Chrome, Firefox, Safari

## Performance Testing

### Memory Usage
- **Baseline**: <50MB initial memory usage
- **Large Export**: <200MB peak memory usage
- **Cleanup**: Memory returns to baseline after export

### Processing Speed
- **Small Export**: <30 seconds for 100 items
- **Large Export**: <10 minutes for 1000 items
- **Progress Updates**: Updates every 5% or 10 seconds

### Browser Compatibility
- **Chrome**: Full functionality
- **Firefox**: Full functionality
- **Safari**: Basic functionality (limited File System Access)
- **Edge**: Full functionality
