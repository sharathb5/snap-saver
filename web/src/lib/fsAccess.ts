// File System Access API helpers with feature detection

export interface FSAccessCapabilities {
  hasFileSystemAccess: boolean;
  hasDirectoryPicker: boolean;
  hasFilePicker: boolean;
}

export async function getFSAccessCapabilities(): Promise<FSAccessCapabilities> {
  const hasFileSystemAccess = 'showDirectoryPicker' in window;
  const hasDirectoryPicker = hasFileSystemAccess && 'showDirectoryPicker' in window;
  const hasFilePicker = hasFileSystemAccess && 'showOpenFilePicker' in window;

  return {
    hasFileSystemAccess,
    hasDirectoryPicker,
    hasFilePicker,
  };
}

export async function requestDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    return null;
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null; // User cancelled
    }
    throw error;
  }
}

export async function writeFileToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  path: string,
  data: ArrayBuffer
): Promise<void> {
  const pathParts = path.split('/');
  const fileName = pathParts.pop()!;
  
  // Navigate to the directory, creating subdirectories as needed
  let currentHandle = directoryHandle;
  
  for (const part of pathParts) {
    if (part) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      } catch (error) {
        throw new Error(`Failed to create directory ${part}: ${error}`);
      }
    }
  }
  
  // Write the file
  try {
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (error) {
    throw new Error(`Failed to write file ${fileName}: ${error}`);
  }
}

export async function createDirectoryStructure(
  directoryHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<FileSystemDirectoryHandle> {
  const pathParts = basePath.split('/').filter(part => part);
  let currentHandle = directoryHandle;
  
  for (const part of pathParts) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${part}: ${error}`);
    }
  }
  
  return currentHandle;
}

export function getBrowserRecommendation(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return "Chrome (recommended for large exports)";
  } else if (userAgent.includes('edg')) {
    return "Edge (recommended for large exports)";
  } else if (userAgent.includes('firefox')) {
    return "Firefox (download ZIP mode only)";
  } else if (userAgent.includes('safari')) {
    return "Safari (download ZIP mode only)";
  } else {
    return "Your browser (download ZIP mode only)";
  }
}

export async function getFolderInfo(handle: FileSystemDirectoryHandle): Promise<{ name: string; path: string }> {
  // Unfortunately, File System Access API doesn't provide the full path
  // We can only get the folder name and provide helpful instructions
  const name = handle.name;
  
  // Try to get more context if possible
  let path = name;
  
  // On macOS, we can provide helpful instructions
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if (isMac) {
    path = `~/Desktop/${name}`; // Most common location, but not guaranteed
  }
  
  return { name, path };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
