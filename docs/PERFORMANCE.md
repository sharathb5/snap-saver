# Performance Optimization

## Streaming Architecture

### Memory-Efficient Processing
- **Streaming ZIP Reading**: Process ZIP entries one at a time without loading entire archive
- **Chunked File Processing**: Handle large files in 1MB chunks to prevent memory spikes
- **Worker Isolation**: Heavy processing in Web Workers to prevent UI blocking
- **Garbage Collection**: Explicit cleanup of large objects and temporary data

### Implementation Details
```typescript
// Streaming ZIP processing
async function* processZipStream(zipFile: File) {
  const reader = zipFile.stream().getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    
    // Process chunk when we have enough data
    if (chunks.length >= CHUNK_SIZE) {
      yield processChunk(chunks);
      chunks.length = 0; // Clear processed chunks
    }
  }
}
```

## Concurrency Control

### Bounded Concurrency
- **Download Limit**: Maximum 5 concurrent downloads to avoid overwhelming servers
- **File Processing**: Maximum 3 concurrent file operations to prevent I/O bottlenecks
- **Memory Management**: Monitor memory usage and throttle when approaching limits

### Implementation
```typescript
class ConcurrencyLimiter {
  private active = 0;
  private queue: (() => void)[] = [];
  
  constructor(private maxConcurrent: number) {}
  
  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
```

## Memory Targets

### Baseline Memory Usage
- **Initial Load**: <50MB JavaScript heap
- **Idle State**: <30MB after garbage collection
- **Peak Usage**: <200MB during large exports
- **Cleanup**: Return to baseline within 30 seconds

### Memory Monitoring
```typescript
class MemoryMonitor {
  private baseline = 0;
  
  start() {
    this.baseline = this.getMemoryUsage();
  }
  
  getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }
  
  checkMemoryPressure(): boolean {
    const current = this.getMemoryUsage();
    const increase = current - this.baseline;
    
    // Alert if memory increased by more than 150MB
    return increase > 150 * 1024 * 1024;
  }
  
  forceCleanup() {
    // Clear caches, trigger GC
    if (window.gc) window.gc();
  }
}
```

## ETA Calculation

### Moving Average Algorithm
- **Window Size**: Last 10 completed items for smooth ETA
- **Weighted Average**: Recent items weighted more heavily
- **Confidence Intervals**: Show ETA range based on variance

### Implementation
```typescript
class ETACalculator {
  private times: number[] = [];
  private readonly windowSize = 10;
  
  addItem(processingTime: number) {
    this.times.push(processingTime);
    if (this.times.length > this.windowSize) {
      this.times.shift();
    }
  }
  
  calculateETA(remainingItems: number): { eta: string; confidence: number } {
    if (this.times.length === 0) {
      return { eta: 'Calculating...', confidence: 0 };
    }
    
    // Weighted average (recent items weighted more)
    const weights = this.times.map((_, i) => i + 1);
    const weightedSum = this.times.reduce((sum, time, i) => sum + time * weights[i], 0);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const avgTime = weightedSum / weightSum;
    
    const totalTime = avgTime * remainingItems;
    const eta = this.formatTime(totalTime);
    
    // Calculate confidence based on variance
    const variance = this.calculateVariance();
    const confidence = Math.max(0, 1 - variance / avgTime);
    
    return { eta, confidence };
  }
  
  private formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
```

## Wake Lock Usage

### Screen Wake Management
- **Acquire on Export**: Request wake lock when export starts
- **Release on Complete**: Release wake lock when export finishes or is cancelled
- **Fallback Handling**: Graceful degradation when wake lock not supported

### Implementation
```typescript
class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  
  async acquire(): Promise<boolean> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
        });
        
        return true;
      }
    } catch (error) {
      console.warn('Wake lock not supported:', error);
    }
    
    return false;
  }
  
  async release(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}
```

## Bundle Optimization

### Code Splitting
- **Route-based Splitting**: Split by main application routes
- **Feature-based Splitting**: Split by major features (workers, utilities)
- **Dynamic Imports**: Lazy load non-critical components

### Bundle Analysis
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          workers: ['fflate', 'comlink'],
          utils: ['date-fns', 'crypto-js'],
        },
      },
    },
  },
});
```

### Tree Shaking
- **ES Modules**: Use ES modules for better tree shaking
- **Side Effects**: Mark packages as side-effect free
- **Dead Code Elimination**: Remove unused code paths

## Network Optimization

### Request Optimization
- **Connection Pooling**: Reuse HTTP connections
- **Request Batching**: Group multiple requests when possible
- **Timeout Management**: Appropriate timeouts for different operations

### Caching Strategy
```typescript
class NetworkCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly ttl = 5 * 60 * 1000; // 5 minutes
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
```

## Performance Metrics

### Web Vitals
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **First Input Delay**: <100ms
- **Time to Interactive**: <3.0s

### Custom Metrics
```typescript
class PerformanceMetrics {
  private metrics = new Map<string, number[]>();
  
  record(metric: string, value: number) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);
  }
  
  getAverage(metric: string): number {
    const values = this.metrics.get(metric) || [];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  getReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [metric, values] of this.metrics) {
      report[metric] = {
        average: this.getAverage(metric),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
    
    return report;
  }
}
```

## Browser-Specific Optimizations

### Chrome/Edge
- **File System Access**: Full support for direct file system access
- **Web Workers**: Full worker support with shared memory
- **Streams API**: Complete streaming support

### Firefox
- **File System Access**: Limited support, fallback to download ZIP
- **Web Workers**: Full support
- **Streams API**: Good support

### Safari/iOS
- **File System Access**: Not supported, download ZIP only
- **Web Workers**: Limited support, may have memory constraints
- **Streams API**: Limited support
- **Background Processing**: May be throttled, recommend desktop usage

## Performance Testing

### Synthetic Tests
```typescript
// performance.test.ts
describe('Performance Tests', () => {
  test('memory usage stays within limits', async () => {
    const monitor = new MemoryMonitor();
    monitor.start();
    
    // Process large dataset
    await processLargeDataset();
    
    const memoryUsage = monitor.getMemoryUsage();
    expect(memoryUsage).toBeLessThan(200 * 1024 * 1024); // 200MB
  });
  
  test('processing speed meets targets', async () => {
    const start = performance.now();
    
    await processTestDataset();
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(30000); // 30 seconds
  });
});
```

### Real-World Benchmarks
- **Small Export (100 items)**: <30 seconds, <100MB memory
- **Medium Export (500 items)**: <2 minutes, <150MB memory
- **Large Export (1000+ items)**: <10 minutes, <200MB memory
- **Very Large Export (5000+ items)**: <30 minutes, <250MB memory

## Optimization Checklist

### ✅ Memory Management
- [ ] Streaming file processing implemented
- [ ] Explicit cleanup of large objects
- [ ] Memory monitoring and pressure detection
- [ ] Garbage collection optimization

### ✅ Concurrency Control
- [ ] Bounded concurrent downloads
- [ ] File processing queue management
- [ ] Memory-aware throttling
- [ ] Error handling and retry logic

### ✅ Performance Monitoring
- [ ] ETA calculation with confidence intervals
- [ ] Real-time performance metrics
- [ ] Memory usage tracking
- [ ] Network performance monitoring

### ✅ Browser Optimization
- [ ] Chrome/Edge optimizations
- [ ] Firefox compatibility
- [ ] Safari/iOS fallbacks
- [ ] Progressive enhancement
