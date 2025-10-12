import { unzipSync, zipSync } from 'fflate';
import { MemoryItem, ExportPlan, ExportProgress } from '../lib/types';

// Worker for exporting files to File System Access or creating download ZIP
class ExportWorker {
  private isCancelled = false;
  private progressCallback?: (progress: ExportProgress) => void;
  private performanceMetrics = {
    startTime: 0,
    totalBytes: 0,
    downloadTimes: [] as number[],
    averageDownloadTime: 0,
    slowestDownload: 0,
    fastestDownload: Infinity
  };

  async exportFiles(
    items: MemoryItem[],
    plan: ExportPlan,
    zipFiles: File[],
    onProgress: (progress: ExportProgress) => void
  ): Promise<void> {
    this.isCancelled = false;
    this.progressCallback = onProgress;
    
    // Initialize performance tracking
    this.performanceMetrics = {
      startTime: performance.now(),
      totalBytes: 0,
      downloadTimes: [],
      averageDownloadTime: 0,
      slowestDownload: 0,
      fastestDownload: Infinity
    };

    try {
      if (plan.destStrategy === 'fs-access') {
        await this.exportToFileSystem(items, plan, zipFiles);
      } else {
        await this.exportToDownloadZip(items, zipFiles);
      }
    } catch (error) {
      if (!this.isCancelled) {
        throw error;
      }
    }
  }

  private async exportToFileSystem(
    items: MemoryItem[],
    plan: ExportPlan,
    zipFiles: File[]
  ): Promise<void> {
    if (!plan.destHandle) {
      throw new Error('No destination directory handle provided');
    }

    const totalItems = items.length;
    let copiedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Create base directory structure
    const baseDir = await plan.destHandle.getDirectoryHandle('by-date', { create: true });

    for (let i = 0; i < items.length; i++) {
      if (this.isCancelled) break;

      const item = items[i];
      const percent = (i / totalItems) * 100;

      this.updateProgress({
        percent,
        copiedCount,
        skippedCount,
        failedCount,
        currentFile: item.zipPath,
        status: `Processing ${i + 1}/${totalItems}...`,
      });

      try {
        let fileData: Uint8Array | null = null;

        if (item.zipPath.startsWith('http')) {
          // Download from URL
          console.log(`🌐 Processing URL item ${i + 1}/${totalItems}: ${item.zipPath.substring(0, 50)}...`);
          const downloadResult = await this.downloadFromUrl(item.zipPath);
          if (downloadResult) {
            fileData = downloadResult.data;
            // Update the item with the actual file size
            item.sizeBytes = downloadResult.size;
            console.log(`✅ Got ${downloadResult.size} bytes for item ${i + 1}`);
          } else {
            console.log(`❌ Failed to download item ${i + 1}`);
          }
        } else {
          // Extract from ZIP file
          console.log(`📁 Processing ZIP item ${i + 1}/${totalItems}: ${item.zipPath}`);
          const zipFile = await this.findZipFileForItem(item, zipFiles);
          if (zipFile) {
            fileData = await this.extractFileFromZip(item, zipFile);
          }
        }

        if (fileData) {
          // Save the file
          const success = await this.saveFileToDirectory(item, fileData, baseDir);
          if (success) {
            copiedCount++;
            console.log(`✅ Saved item ${i + 1} (${copiedCount} total copied)`);
          } else {
            skippedCount++;
            console.log(`⏭️ Skipped item ${i + 1} (${skippedCount} total skipped)`);
          }
        } else {
          failedCount++;
          console.log(`❌ Failed item ${i + 1} (${failedCount} total failed)`);
        }
      } catch (error) {
        console.error(`❌ Failed to process ${item.zipPath}:`, error);
        failedCount++;
      }
    }

    // Create manifest.json
    await this.createManifest(plan.destHandle, {
      copiedCount,
      failedCount,
      totalItems,
      mode: plan.mode,
    });

    // Calculate final performance metrics
    const totalTime = performance.now() - this.performanceMetrics.startTime;
    this.performanceMetrics.averageDownloadTime = this.performanceMetrics.downloadTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.downloadTimes.length;
    
    console.log(`📊 Performance Summary:`);
    console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Total data: ${(this.performanceMetrics.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Average speed: ${((this.performanceMetrics.totalBytes / 1024 / 1024) / (totalTime / 1000)).toFixed(2)} MB/s`);
    console.log(`   Files processed: ${copiedCount + skippedCount + failedCount}`);
    console.log(`   ✅ Successfully saved: ${copiedCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failedCount} (${((failedCount / (copiedCount + skippedCount + failedCount)) * 100).toFixed(1)}%)`);
    console.log(`   Average download time: ${this.performanceMetrics.averageDownloadTime.toFixed(0)}ms`);
    console.log(`   Fastest download: ${this.performanceMetrics.fastestDownload.toFixed(0)}ms`);
    console.log(`   Slowest download: ${this.performanceMetrics.slowestDownload.toFixed(0)}ms`);

    this.updateProgress({
      percent: 100,
      copiedCount,
      skippedCount,
      failedCount,
      status: 'Complete',
    });
  }

  private async exportToDownloadZip(items: MemoryItem[], zipFiles: File[]): Promise<void> {
    const totalItems = items.length;
    let copiedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const zipData: Record<string, Uint8Array> = {};

    for (let i = 0; i < items.length; i++) {
      if (this.isCancelled) break;

      const item = items[i];
      const percent = (i / totalItems) * 100;

      this.updateProgress({
        percent,
        copiedCount,
        skippedCount,
        failedCount,
        currentFile: item.zipPath,
        status: `Building ZIP ${i + 1}/${totalItems}...`,
      });

      try {
        let fileData: Uint8Array | null = null;

        if (item.zipPath.startsWith('http')) {
          // Download from URL
          console.log(`🌐 Processing URL item ${i + 1}/${totalItems}: ${item.zipPath.substring(0, 50)}...`);
          const downloadResult = await this.downloadFromUrl(item.zipPath);
          if (downloadResult) {
            fileData = downloadResult.data;
            // Update the item with the actual file size
            item.sizeBytes = downloadResult.size;
            console.log(`✅ Got ${downloadResult.size} bytes for item ${i + 1}`);
          } else {
            console.log(`❌ Failed to download item ${i + 1}`);
          }
        } else {
          // Extract from ZIP file
          console.log(`📁 Processing ZIP item ${i + 1}/${totalItems}: ${item.zipPath}`);
          const zipFile = await this.findZipFileForItem(item, zipFiles);
          if (zipFile) {
            fileData = await this.extractFileFromZip(item, zipFile);
          }
        }

        if (fileData) {
          // Create organized path structure
          const date = new Date(item.createdAtIso);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          
          // Generate safe filename
          const fileName = this.generateSafeFileName(item);
          const organizedPath = `by-date/${year}/${year}-${month}/${year}-${month}-${day}/${fileName}`;
          zipData[organizedPath] = fileData;
          copiedCount++;
          console.log(`✅ Added item ${i + 1} to ZIP (${copiedCount} total copied): ${fileName}`);
        } else {
          failedCount++;
          console.log(`❌ Failed item ${i + 1} (${failedCount} total failed)`);
        }
      } catch (error) {
        console.error(`❌ Failed to process ${item.zipPath}:`, error);
        failedCount++;
      }
    }

    // Create manifest.json
    const manifest = {
      dest: 'download-zip',
      copiedCount,
      failedCount,
      totalItems,
      mode: 'at-risk' as const,
      runStartedIso: new Date().toISOString(),
      runEndedIso: new Date().toISOString(),
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    zipData['manifest.json'] = new TextEncoder().encode(manifestJson);

    // Create the final ZIP
    this.updateProgress({
      percent: 95,
      copiedCount,
      skippedCount,
      failedCount,
      status: 'Creating ZIP file...',
    });

    const finalZip = zipSync(zipData);

    // Log performance summary for download ZIP
    console.log(`📊 Download ZIP Performance Summary:`);
    console.log(`   ✅ Successfully saved: ${copiedCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failedCount} (${((failedCount / (copiedCount + skippedCount + failedCount)) * 100).toFixed(1)}%)`);
    console.log(`   Total files processed: ${copiedCount + skippedCount + failedCount}`);

    // Send the ZIP data back to main thread for download
    self.postMessage({
      type: 'download-zip',
      data: { zipData: finalZip, filename: 'snap-memories-backup.zip' }
    });

    this.updateProgress({
      percent: 100,
      copiedCount,
      skippedCount,
      failedCount,
      status: 'Complete',
    });
  }

  private async findZipFileForItem(item: MemoryItem, zipFiles: File[]): Promise<File | null> {
    // If zipPath is a URL (Snapchat download link), we don't need to find it in ZIP files
    if (item.zipPath.startsWith('http')) {
      return null; // Will be handled by downloadFromUrl
    }
    
    for (const zipFile of zipFiles) {
      try {
        const arrayBuffer = await zipFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const unzipped = unzipSync(uint8Array);
        
        if (unzipped[item.zipPath]) {
          return zipFile;
        }
      } catch (error) {
        console.error(`Failed to check ZIP file ${zipFile.name}:`, error);
      }
    }
    return null;
  }

  private async extractFileFromZip(item: MemoryItem, zipFile: File): Promise<Uint8Array | null> {
    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const unzipped = unzipSync(uint8Array);
      
      return unzipped[item.zipPath] || null;
    } catch (error) {
      console.error(`Failed to extract ${item.zipPath}:`, error);
      return null;
    }
  }

  private async downloadFromUrl(url: string, retryCount = 0): Promise<{ data: Uint8Array; size: number } | null> {
    const downloadStart = performance.now();
    const maxRetries = 2;
    
    try {
      console.log(`📥 Downloading from URL: ${url.substring(0, 100)}...`);
      
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SnapSaver/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const downloadTime = performance.now() - downloadStart;
      
      // Basic file validation
      if (data.length === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      // Track performance metrics
      this.performanceMetrics.downloadTimes.push(downloadTime);
      this.performanceMetrics.totalBytes += data.length;
      this.performanceMetrics.slowestDownload = Math.max(this.performanceMetrics.slowestDownload, downloadTime);
      this.performanceMetrics.fastestDownload = Math.min(this.performanceMetrics.fastestDownload, downloadTime);
      
      const speedMBps = (data.length / 1024 / 1024) / (downloadTime / 1000);
      console.log(`✅ Downloaded ${data.length} bytes in ${downloadTime.toFixed(0)}ms (${speedMBps.toFixed(2)} MB/s)`);
      return { data, size: data.length };
      
    } catch (error) {
      if (retryCount < maxRetries && (error instanceof Error && error.name === 'AbortError')) {
        console.log(`🔄 Retrying download (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.downloadFromUrl(url, retryCount + 1);
      }
      
      console.error(`❌ Failed to download from ${url}:`, error);
      return null;
    }
  }

  private sanitizeFileName(fileName: string): string {
    // Remove or replace invalid characters
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars with underscore
      .replace(/\s+/g, '_')           // Replace spaces with underscore
      .replace(/_{2,}/g, '_')         // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
      .substring(0, 200);             // Limit length to 200 chars
  }

  private generateSafeFileName(item: MemoryItem): string {
    const extension = item.mediaType === 'video' ? '.mp4' : '.jpg';
    const timestamp = new Date(item.createdAtIso).getTime();
    const date = new Date(item.createdAtIso);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Try to extract a meaningful name from the URL or use timestamp
    let baseName = `snap_${dateStr}_${timestamp}`;
    
    // If we have an originalName, try to use it (sanitized)
    if (item.originalName && item.originalName.trim()) {
      const sanitized = this.sanitizeFileName(item.originalName);
      if (sanitized && sanitized.length > 0) {
        baseName = sanitized;
      }
    }
    
    return `${baseName}${extension}`;
  }

  private async saveFileToDirectory(
    item: MemoryItem,
    fileData: Uint8Array,
    baseDir: FileSystemDirectoryHandle
  ): Promise<boolean> {
    try {
      // Create date-based directory structure
      const date = new Date(item.createdAtIso);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const yearDir = await baseDir.getDirectoryHandle(String(year), { create: true });
      const monthDir = await yearDir.getDirectoryHandle(`${year}-${month}`, { create: true });
      const dayDir = await monthDir.getDirectoryHandle(`${year}-${month}-${day}`, { create: true });

      // Generate a safe filename
      const fileName = this.generateSafeFileName(item);
      console.log(`💾 Saving file: ${fileName}`);

      // Try to create the file, with fallback if filename is still invalid
      let fileHandle;
      try {
        fileHandle = await dayDir.getFileHandle(fileName, { create: true });
      } catch (error) {
        // If filename is still invalid, use a simple timestamp-based name
        const timestamp = new Date(item.createdAtIso).getTime();
        const extension = item.mediaType === 'video' ? '.mp4' : '.jpg';
        const fallbackName = `snap_${timestamp}${extension}`;
        console.log(`⚠️ Using fallback filename: ${fallbackName}`);
        fileHandle = await dayDir.getFileHandle(fallbackName, { create: true });
      }
      
      const writable = await fileHandle.createWritable();
      await writable.write(fileData);
      await writable.close();

      return true;
    } catch (error) {
      console.error(`❌ Failed to save ${item.zipPath}:`, error);
      return false;
    }
  }

  private async extractAndSaveFile(
    item: MemoryItem,
    zipFile: File,
    baseDir: FileSystemDirectoryHandle
  ): Promise<boolean> {
    try {
      const fileData = await this.extractFileFromZip(item, zipFile);
      if (!fileData) return false;

      return await this.saveFileToDirectory(item, fileData, baseDir);
    } catch (error) {
      console.error(`Failed to save ${item.zipPath}:`, error);
      return false;
    }
  }

  private async createManifest(
    destHandle: FileSystemDirectoryHandle,
    stats: { copiedCount: number; failedCount: number; totalItems: number; mode: string }
  ): Promise<void> {
    const manifest = {
      dest: 'file-system',
      copiedCount: stats.copiedCount,
      errorCount: stats.failedCount,
      runStartedIso: new Date().toISOString(),
      runEndedIso: new Date().toISOString(),
      mode: stats.mode,
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestData = new TextEncoder().encode(manifestJson);

    const fileHandle = await destHandle.getFileHandle('manifest.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Uint8Array(manifestData));
    await writable.close();
  }

  private updateProgress(progress: ExportProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    self.postMessage({ type: 'progress', data: progress });
  }

  cancel(): void {
    this.isCancelled = true;
  }
}

// Create worker instance
const worker = new ExportWorker();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'export':
        await worker.exportFiles(
          data.items,
          data.plan,
          data.zipFiles,
          (_progress) => {
            // Progress updates are handled in the worker methods
          }
        );
        self.postMessage({ type: 'complete', data: { success: true } });
        break;
      case 'cancel':
        worker.cancel();
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'complete', 
      data: { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    });
  }
});
