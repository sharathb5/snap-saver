import { unzipSync, Unzipped } from 'fflate';
import { MemoryItem, MediaType, ScanResult } from '../lib/types';

// Worker for parsing ZIP files and extracting memory metadata
class UnzipWorker {
  async scanZipFiles(files: File[]): Promise<ScanResult> {
    const allItems: MemoryItem[] = [];
    let totalBytes = 0;
    let missingSizesCount = 0;

    console.log(`🔍 SCAN START: Processing ${files.length} ZIP file(s)`);

    for (const file of files) {
      try {
        console.log(`📁 Processing ZIP file: ${file.name} (${file.size} bytes)`);
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const unzipped = unzipSync(uint8Array);

        const fileList = Object.keys(unzipped);
        console.log(`📋 ZIP contains ${fileList.length} files:`, fileList);

        // Find and parse index files
        const indexFiles = this.findIndexFiles(unzipped);
        console.log(`🎯 Found ${indexFiles.length} index files:`, indexFiles.map(([path]) => path));
        
        if (indexFiles.length === 0) {
          console.warn(`⚠️  No index files found in ${file.name}! Available files:`, fileList);
        }
        
        for (const [indexPath, indexData] of indexFiles) {
          console.log(`🔍 Parsing index file: ${indexPath} (${indexData.length} bytes)`);
          const items = this.parseIndexFile(indexData, indexPath);
          console.log(`✅ Extracted ${items.length} memory items from ${indexPath}`);
          
          for (const item of items) {
            // Generate stable ID if not present
            if (!item.id) {
              item.id = this.generateStableId(item.zipPath, item.createdAtIso);
            }
            
            // Count missing sizes
            if (item.sizeBytes === undefined) {
              missingSizesCount++;
            } else {
              totalBytes += item.sizeBytes;
            }
            
            allItems.push(item);
            console.log(`📸 Memory item: ${item.zipPath} (${item.mediaType}, ${item.sizeBytes || 'unknown size'} bytes)`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to process ZIP file ${file.name}:`, error);
        // Continue with other files
      }
    }

    // Remove duplicates based on ID
    const seenIds = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      if (seenIds.has(item.id)) {
        console.log(`🔄 Removing duplicate: ${item.zipPath}`);
        return false;
      }
      seenIds.add(item.id);
      return true;
    });

    console.log(`🎉 SCAN COMPLETE: Found ${uniqueItems.length} unique memories (${totalBytes} bytes total, ${missingSizesCount} missing sizes)`);

    return {
      items: uniqueItems,
      totalBytes,
      missingSizesCount,
    };
  }

  async debugZipContents(files: File[]): Promise<any> {
    const debugInfo: any = {
      files: [],
      totalFiles: 0,
      htmlFiles: [],
      jsonFiles: [],
      sampleContent: null
    };

    for (const file of files) {
      try {
        console.log(`🔍 DEBUG: Processing ZIP file: ${file.name}`);
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const unzipped = unzipSync(uint8Array);

        const fileInfo = {
          name: file.name,
          size: file.size,
          filesInZip: Object.keys(unzipped).length,
          fileList: Object.keys(unzipped),
          htmlFiles: Object.keys(unzipped).filter(path => path.endsWith('.html')),
          jsonFiles: Object.keys(unzipped).filter(path => path.endsWith('.json'))
        };

        debugInfo.files.push(fileInfo);
        debugInfo.totalFiles += fileInfo.filesInZip;

        // Get sample HTML content (prioritize HTML over JSON)
        const htmlFiles = Object.keys(unzipped).filter(path => path.endsWith('.html'));
        const jsonFiles = Object.keys(unzipped).filter(path => path.endsWith('.json'));
        
        if (htmlFiles.length > 0 && !debugInfo.sampleContent) {
          // Prioritize memories_history.html for analysis
          const memoriesFile = htmlFiles.find(f => f.includes('memories_history'));
          const targetFile = memoriesFile || htmlFiles[0];
          const htmlData = unzipped[targetFile];
          const htmlText = new TextDecoder().decode(htmlData);
          
          // Enhanced analysis for memories_history.html
          const analysis = this.analyzeHtmlContent(htmlText, targetFile);
          
          debugInfo.sampleContent = {
            fileName: targetFile,
            type: 'html',
            length: htmlText.length,
            preview: htmlText.substring(0, 1000) + '...',
            ...analysis
          };
        } else if (jsonFiles.length > 0 && !debugInfo.sampleContent) {
          const firstJsonFile = jsonFiles[0];
          const jsonData = unzipped[firstJsonFile];
          const jsonText = new TextDecoder().decode(jsonData);
          
          try {
            const parsed = JSON.parse(jsonText);
            debugInfo.sampleContent = {
              fileName: firstJsonFile,
              type: 'json',
              structure: Object.keys(parsed),
              sampleItem: Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0],
              fullContent: parsed
            };
          } catch (e) {
            debugInfo.sampleContent = {
              fileName: firstJsonFile,
              type: 'json',
              error: 'Failed to parse JSON',
              rawContent: jsonText.substring(0, 500) + '...'
            };
          }
        }

        debugInfo.htmlFiles.push(...htmlFiles);
        debugInfo.jsonFiles.push(...jsonFiles);

      } catch (error) {
        debugInfo.files.push({
          name: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return debugInfo;
  }

  private findIndexFiles(unzipped: Unzipped): Array<[string, Uint8Array]> {
    const indexFiles: Array<[string, Uint8Array]> = [];
    
    for (const [path, data] of Object.entries(unzipped)) {
      // Look for HTML files that contain memory data
      if (path.endsWith('.html') && (
        path.includes('memories_history') || 
        path.includes('memories') || 
        path.includes('index') ||
        path === 'memories_history.html' ||
        path === 'index.html' ||
        path.startsWith('html/')
      )) {
        indexFiles.push([path, data]);
      }
    }
    
    return indexFiles;
  }

  private parseIndexFile(data: Uint8Array, zipName: string): MemoryItem[] {
    try {
      const html = new TextDecoder().decode(data);
      console.log('Parsing HTML file, length:', html.length);
      
      const items: MemoryItem[] = [];
      
      // Special handling for memories_history.html - this is where the actual memory data lives
      if (zipName.includes('memories_history.html') || zipName.includes('memories_history')) {
        console.log('🔍 Parsing memories_history.html - looking for embedded memory data');
        
        // Look for common Snapchat memory data patterns
        const memoryData = this.extractMemoryDataFromHistory(html);
        items.push(...memoryData);
      } else {
        // For other HTML files, use generic parsing
        items.push(...this.parseGenericHtml(html, zipName));
      }
      
      console.log(`Parsed ${items.length} items from HTML in ${zipName}`);
      return items;
    } catch (error) {
      console.error('Failed to parse HTML file:', error);
      return [];
    }
  }

  private extractMemoryDataFromHistory(html: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    console.log('🔍 Extracting memory data from memories_history.html');
    console.log(`📄 HTML length: ${html.length} characters`);
    
    // First, let's see what's actually in the HTML
    console.log('📋 HTML preview (first 500 chars):', html.substring(0, 500));
    
    // Look for any patterns that might contain memory data
    console.log('🔍 Looking for common memory data patterns...');
    
    // Check for any JavaScript variables (not just memory-related)
    const allJsVars = html.match(/(?:var|let|const)\s+\w+\s*=/gi);
    console.log(`📜 Found ${allJsVars ? allJsVars.length : 0} JavaScript variables total:`, allJsVars);
    
    // Check for any arrays in the HTML
    const arrayPatterns = html.match(/\[[\s\S]{10,}\]/g);
    console.log(`📋 Found ${arrayPatterns ? arrayPatterns.length : 0} array patterns`);
    
    // Check for any objects with curly braces
    const objectPatterns = html.match(/\{[\s\S]{10,}\}/g);
    console.log(`📦 Found ${objectPatterns ? objectPatterns.length : 0} object patterns`);
    
    // Method 1: Look for JavaScript variables containing memory data
    const jsVarMatches = html.match(/(?:var|let|const)\s+(\w*[Mm]emories?\w*)\s*=\s*(\[[\s\S]*?\]);/gi);
    console.log(`🔍 Method 1 - JavaScript variables: Found ${jsVarMatches ? jsVarMatches.length : 0} matches`);
    if (jsVarMatches) {
      for (const match of jsVarMatches) {
        const arrayMatch = match.match(/=\s*(\[[\s\S]*?\]);/);
        if (arrayMatch) {
          try {
            const memoryArray = JSON.parse(arrayMatch[1]);
            console.log(`✅ Parsed JS memory array with ${memoryArray.length} items`);
            const parsedItems = this.parseMemoryArray(memoryArray, 'memories_history.html');
            items.push(...parsedItems);
            console.log(`📸 Added ${parsedItems.length} memory items from JS variable`);
          } catch (e) {
            console.log('❌ Failed to parse JS memory variable:', e);
          }
        }
      }
    }
    
    // Method 2: Look for JSON data in script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    console.log(`🔍 Method 2 - Script tags: Found ${scriptMatches ? scriptMatches.length : 0} script tags`);
    if (scriptMatches) {
      for (let i = 0; i < scriptMatches.length; i++) {
        const scriptMatch = scriptMatches[i];
        const scriptContent = scriptMatch.replace(/<\/?script[^>]*>/gi, '');
        console.log(`📜 Script ${i + 1}: ${scriptContent.length} characters`);
        console.log(`📜 Script ${i + 1} preview (first 200 chars):`, scriptContent.substring(0, 200));
        
        // Look for any variables in this script
        const scriptVars = scriptContent.match(/(?:var|let|const)\s+\w+\s*=/gi);
        console.log(`📜 Script ${i + 1} variables:`, scriptVars);
        
        // Look for large JSON objects that might contain memory data
        const jsonMatches = scriptContent.match(/\{[\s\S]{100,}\}/g);
        if (jsonMatches) {
          console.log(`🔍 Found ${jsonMatches.length} large JSON objects in script ${i + 1}`);
          for (let j = 0; j < jsonMatches.length; j++) {
            const jsonStr = jsonMatches[j];
            console.log(`📦 JSON ${j + 1} preview (first 200 chars):`, jsonStr.substring(0, 200));
            try {
              const json = JSON.parse(jsonStr);
              console.log(`📦 JSON ${j + 1} keys:`, Object.keys(json));
              const parsedItems = this.parseJsonData(json, 'memories_history.html');
              if (parsedItems.length > 0) {
                console.log(`✅ Found ${parsedItems.length} items in script ${i + 1}, JSON ${j + 1}`);
                items.push(...parsedItems);
              }
            } catch (e) {
              console.log(`❌ Failed to parse JSON ${j + 1} in script ${i + 1}:`, e);
            }
          }
        }
      }
    }
    
    // Method 3: Look for data attributes with memory information
    const dataMatches = html.match(/data-[^=]*="[^"]{50,}"/gi);
    console.log(`🔍 Method 3 - Data attributes: Found ${dataMatches ? dataMatches.length : 0} data attributes`);
    if (dataMatches) {
      for (const dataMatch of dataMatches) {
        const value = dataMatch.match(/="([^"]*)"/)?.[1];
        if (value && value.length > 50) {
          try {
            const decoded = decodeURIComponent(value);
            const json = JSON.parse(decoded);
            const parsedItems = this.parseJsonData(json, 'memories_history.html');
            if (parsedItems.length > 0) {
              console.log(`✅ Found ${parsedItems.length} items in data attribute`);
              items.push(...parsedItems);
            }
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
    }
    
    // Method 4: Look for HTML tables with memory data
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    console.log(`🔍 Method 4 - Table rows: Found ${tableRows ? tableRows.length : 0} table rows`);
    console.log(`🔍 DEBUG: This is the NEW enhanced table parsing code!`);
    if (tableRows && tableRows.length > 1) { // More than just header row
      let tableItems = 0;
      
      // Let's examine the first few table rows to understand the structure
      console.log(`📋 First table row preview:`, tableRows[0].substring(0, 300));
      if (tableRows.length > 1) {
        console.log(`📋 Second table row preview:`, tableRows[1].substring(0, 300));
      }
      
      // Process ALL rows to get all memories
      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        // Only log every 100th row to avoid console spam
        if (i % 100 === 0 || i < 3) {
          console.log(`🔍 Processing table row ${i + 1}/${tableRows.length}:`, row.substring(0, 200));
        }
        const item = this.parseTableRow(row, 'memories_history.html');
        if (item) {
          items.push(item);
          tableItems++;
          // Only log successful extractions for first few rows
          if (i < 3) {
            console.log(`✅ Extracted item from row ${i + 1}:`, item);
          }
        } else if (i < 3) {
          console.log(`❌ Failed to extract item from row ${i + 1}`);
        }
      }
      console.log(`✅ Extracted ${tableItems} items from table rows (processed all ${tableRows.length} rows)`);
    } else {
      console.log(`❌ No table rows found or only header row`);
    }
    
    console.log(`🎉 Total extracted items from memories_history.html: ${items.length}`);
    return items;
  }

  private parseGenericHtml(html: string, zipName: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    // Generic HTML parsing for non-memories files
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    
    if (scriptMatches) {
      for (const scriptMatch of scriptMatches) {
        const scriptContent = scriptMatch.replace(/<\/?script[^>]*>/gi, '');
        
        // Look for JSON data in script tags
        const jsonMatches = scriptContent.match(/\{[\s\S]*\}/g);
        if (jsonMatches) {
          for (const jsonStr of jsonMatches) {
            try {
              const json = JSON.parse(jsonStr);
              const parsedItems = this.parseJsonData(json, zipName);
              items.push(...parsedItems);
            } catch (e) {
              // Not valid JSON, continue
            }
          }
        }
      }
    }
    
    return items;
  }

  private parseJsonData(json: any, zipName: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    // Try different JSON structures that Snapchat might use
    if (json['Saved Media']) {
      items.push(...this.parseSavedMedia(json['Saved Media'], zipName));
    }
    
    if (json['Memories']) {
      items.push(...this.parseMemories(json['Memories'], zipName));
    }
    
    if (json['saved_media']) {
      items.push(...this.parseSavedMedia(json['saved_media'], zipName));
    }
    
    if (json['memories']) {
      items.push(...this.parseMemories(json['memories'], zipName));
    }
    
    if (json['data']) {
      items.push(...this.parseSavedMedia(json['data'], zipName));
    }
    
    if (Array.isArray(json)) {
      items.push(...this.parseMediaArray(json, zipName));
    }
    
    // If it's a flat object with media items, try to parse it directly
    if (typeof json === 'object' && !Array.isArray(json) && items.length === 0) {
      // Look for any array properties that might contain media
      for (const [key, value] of Object.entries(json)) {
        if (Array.isArray(value)) {
          console.log(`Found array property: ${key} with ${value.length} items`);
          items.push(...this.parseMediaArray(value, zipName));
        }
      }
    }
    
    return items;
  }

  private parseTableRow(rowHtml: string, zipName: string): MemoryItem | null {
    // Extract data from table row - this is a fallback for when JSON parsing fails
    // Look for common patterns in HTML tables
    const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    
    if (!cells || cells.length < 2) {
      return null;
    }
    
    // Extract text content from cells
    const cellTexts = cells.map(cell => {
      const text = cell.replace(/<\/?td[^>]*>/gi, '').replace(/<[^>]*>/g, '').trim();
      return text;
    });
    
    // Try to find a file path and date
    let zipPath = '';
    let createdAt = '';
    let sizeBytes: number | undefined = undefined;
    let mediaType: MediaType = 'unknown';
    
        // Extract data from each cell based on position
        if (cellTexts.length >= 4) {
          // Cell 0: Date
          createdAt = cellTexts[0];
          
          // Cell 1: Media Type
          if (cellTexts[1].toLowerCase().includes('photo') || cellTexts[1].toLowerCase().includes('image')) {
            mediaType = 'photo';
          } else if (cellTexts[1].toLowerCase().includes('video')) {
            mediaType = 'video';
          }
          
          // Cell 2: Location (not the file path)
          // Cell 3: Download link - this contains the actual file path
          
          // Extract file path from download link
          // Look for onclick="downloadMemories('URL')" pattern - be more flexible with the regex
          const downloadMatch = rowHtml.match(/onclick="downloadMemories\('([^']+)'\)/);
          if (downloadMatch) {
            zipPath = downloadMatch[1];
          } else {
            // Look for any Snapchat download URL in the entire row
            const snapchatUrlMatch = rowHtml.match(/https:\/\/www\.snapchat\.com\/dmd\/mm\?[^"'\s]+/);
            if (snapchatUrlMatch) {
              zipPath = snapchatUrlMatch[0];
            } else {
              // Look for any URL in the entire row
              const urlMatch = rowHtml.match(/https?:\/\/[^\s"']+/);
              if (urlMatch) {
                zipPath = urlMatch[0];
              }
            }
          }
        }
    
    // Fallback: look for any file paths in any cell
    if (!zipPath) {
      for (const text of cellTexts) {
        if (text.includes('/') || text.includes('\\') || text.includes('.')) {
          zipPath = text;
          break;
        }
      }
    }
    
    if (!zipPath) {
      return null;
    }
    
    const item = {
      id: '',
      createdAtIso: this.normalizeTimestamp(createdAt),
      zipPath,
      sizeBytes, // Will be undefined for Snapchat URLs - will be filled during download
      mediaType,
      originalName: zipPath.split('/').pop() || zipPath.split('\\').pop(),
    };
    
    return item;
  }

  private parseSavedMedia(savedMedia: any, zipName: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    if (Array.isArray(savedMedia)) {
      for (const media of savedMedia) {
        const item = this.parseMediaItem(media, zipName);
        if (item) items.push(item);
      }
    }
    
    return items;
  }

  private parseMemories(memories: any, zipName: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    if (Array.isArray(memories)) {
      for (const memory of memories) {
        const item = this.parseMediaItem(memory, zipName);
        if (item) items.push(item);
      }
    }
    
    return items;
  }

  private parseMediaArray(mediaArray: any[], zipName: string): MemoryItem[] {
    const items: MemoryItem[] = [];
    
    for (const media of mediaArray) {
      const item = this.parseMediaItem(media, zipName);
      if (item) items.push(item);
    }
    
    return items;
  }

  private parseMediaItem(media: any, _zipName: string): MemoryItem | null {
    // Extract common fields with fallbacks - try many possible field names
    const zipPath = media.Path || media.path || media.file_path || media.filePath || 
                   media.filename || media.file_name || media.name || '';
    
    if (!zipPath) {
      console.log('No path found in media item:', Object.keys(media));
      return null;
    }
    
    const createdAt = media.Date || media.date || media.created_at || media['Date Created'] || 
                     media.timestamp || media.time || media.createdAt || '';
    const createdAtIso = this.normalizeTimestamp(createdAt);
    
    const sizeBytes = media['File Size'] || media.file_size || media.size || 
                     media.fileSize || media.size_bytes || media.length;
    
    const mediaTypeStr = media['Media Type'] || media.media_type || media.type || 
                        media.mediaType || media.content_type || media.mime_type || 'unknown';
    const mediaType = this.parseMediaType(mediaTypeStr);
    
    console.log('Parsed media item:', { zipPath, createdAt, sizeBytes, mediaTypeStr });
    
    return {
      id: '', // Will be generated later
      createdAtIso,
      zipPath,
      sizeBytes: sizeBytes ? Number(sizeBytes) : undefined,
      mediaType,
      originalName: zipPath.split('/').pop(),
    };
  }

  private parseMediaType(typeStr: string): MediaType {
    const type = typeStr.toLowerCase();
    if (type === 'photo' || type === 'image') return 'photo';
    if (type === 'video') return 'video';
    return 'unknown';
  }

  private normalizeTimestamp(timestamp: string): string {
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    try {
      // Try to parse the timestamp
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Fall through to current time
    }
    
    return new Date().toISOString();
  }

  private analyzeHtmlContent(html: string, fileName: string): any {
    const analysis: any = {
      scriptTags: (html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []).length,
      tableRows: (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).length,
      dataAttributes: (html.match(/data-[^=]*="[^"]*"/gi) || []).length
    };
    
    // Special analysis for memories_history.html
    if (fileName.includes('memories_history')) {
      analysis.isMemoriesFile = true;
      
      // Look for JavaScript memory variables
      const jsVarMatches = html.match(/(?:var|let|const)\s+(\w*[Mm]emories?\w*)\s*=\s*(\[[\s\S]*?\]);/gi);
      analysis.memoryVariables = jsVarMatches ? jsVarMatches.length : 0;
      
      // Look for large JSON objects in scripts
      const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      let largeJsonObjects = 0;
      if (scriptMatches) {
        for (const scriptMatch of scriptMatches) {
          const scriptContent = scriptMatch.replace(/<\/?script[^>]*>/gi, '');
          const jsonMatches = scriptContent.match(/\{[\s\S]{100,}\}/g);
          if (jsonMatches) largeJsonObjects += jsonMatches.length;
        }
      }
      analysis.largeJsonObjects = largeJsonObjects;
      
      // Look for file paths in the HTML
      const filePathMatches = html.match(/[a-zA-Z0-9_\/\-\.]+\.(jpg|jpeg|png|gif|mp4|mov|avi|mkv)/gi);
      analysis.mediaFileReferences = filePathMatches ? filePathMatches.length : 0;
      
      // Look for date patterns
      const dateMatches = html.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/gi);
      analysis.dateReferences = dateMatches ? dateMatches.length : 0;
    }
    
    return analysis;
  }

  private generateStableId(zipPath: string, createdAt: string): string {
    const input = `${zipPath}:${createdAt}`;
    // Simple hash function (in a real app, you might want to use a proper hash)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Create worker instance
const worker = new UnzipWorker();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'scan':
        const result = await worker.scanZipFiles(data.files);
        self.postMessage({ type: 'scan-result', data: result });
        break;
      case 'debug-zip':
        const debugResult = await worker.debugZipContents(data.files);
        self.postMessage({ type: 'debug-result', data: debugResult });
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
});
