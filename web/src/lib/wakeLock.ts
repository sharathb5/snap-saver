// Wake Lock API helper to keep screen on during long operations

class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;

  async requestWakeLock(): Promise<boolean> {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return false;
    }

    try {
      this.wakeLock = await (navigator as any).wakeLock.request('screen');
      
      this.wakeLock?.addEventListener('release', () => {
        console.log('Wake lock released');
        this.wakeLock = null;
      });

      console.log('Wake lock acquired');
      return true;
    } catch (error) {
      console.error('Failed to acquire wake lock:', error);
      return false;
    }
  }

  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('Wake lock released manually');
      } catch (error) {
        console.error('Failed to release wake lock:', error);
      }
    }
  }

  isWakeLockActive(): boolean {
    return this.wakeLock !== null;
  }
}

// Singleton instance
export const wakeLock = new WakeLockManager();
