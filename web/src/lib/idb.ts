// IndexedDB helper for hash cache and manifest storage

interface HashRecord {
  id: string;
  sha256: string;
  filePath: string;
  timestamp: number;
}

interface ManifestRecord {
  id: string;
  manifest: any;
  timestamp: number;
}

const DB_NAME = 'SnapSaverDB';
const DB_VERSION = 1;
const HASH_STORE = 'hashes';
const MANIFEST_STORE = 'manifests';

class IDBManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create hashes store
        if (!db.objectStoreNames.contains(HASH_STORE)) {
          const hashStore = db.createObjectStore(HASH_STORE, { keyPath: 'id' });
          hashStore.createIndex('sha256', 'sha256', { unique: false });
          hashStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create manifests store
        if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
          const manifestStore = db.createObjectStore(MANIFEST_STORE, { keyPath: 'id' });
          manifestStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async getHash(itemId: string): Promise<string | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([HASH_STORE], 'readonly');
      const store = transaction.objectStore(HASH_STORE);
      const request = store.get(itemId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as HashRecord | undefined;
        resolve(result?.sha256 || null);
      };
    });
  }

  async setHash(itemId: string, sha256: string, filePath: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([HASH_STORE], 'readwrite');
      const store = transaction.objectStore(HASH_STORE);
      
      const record: HashRecord = {
        id: itemId,
        sha256,
        filePath,
        timestamp: Date.now(),
      };

      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async saveManifest(manifestId: string, manifest: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MANIFEST_STORE], 'readwrite');
      const store = transaction.objectStore(MANIFEST_STORE);
      
      const record: ManifestRecord = {
        id: manifestId,
        manifest,
        timestamp: Date.now(),
      };

      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getManifest(manifestId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MANIFEST_STORE], 'readonly');
      const store = transaction.objectStore(MANIFEST_STORE);
      const request = store.get(manifestId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as ManifestRecord | undefined;
        resolve(result?.manifest || null);
      };
    });
  }

  async clearOldRecords(olderThanDays: number = 30): Promise<void> {
    if (!this.db) await this.init();

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    // Clear old hashes
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([HASH_STORE], 'readwrite');
      const store = transaction.objectStore(HASH_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    // Clear old manifests
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([MANIFEST_STORE], 'readwrite');
      const store = transaction.objectStore(MANIFEST_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

// Singleton instance
export const idb = new IDBManager();
