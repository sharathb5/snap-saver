// Worker for computing SHA-256 hashes of file data

class HashWorker {
  async computeSHA256(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert to hex string
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hashHex;
  }

  async computeSHA256FromStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
      }
      
      // Combine all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Compute hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      const hashArray = new Uint8Array(hashBuffer);
      
      // Convert to hex string
      const hashHex = Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return hashHex;
    } finally {
      reader.releaseLock();
    }
  }
}

// Create worker instance
const worker = new HashWorker();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'hash-data':
        const hash = await worker.computeSHA256(data.data);
        self.postMessage({ 
          type: 'hash-result', 
          data: { hash, id: data.id }
        });
        break;
      case 'hash-stream':
        const streamHash = await worker.computeSHA256FromStream(data.stream);
        self.postMessage({ 
          type: 'hash-result', 
          data: { hash: streamHash, id: data.id }
        });
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      data: { 
        message: error instanceof Error ? error.message : 'Unknown error',
        id: data.id 
      }
    });
  }
});
