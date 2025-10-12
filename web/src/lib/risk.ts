import { MemoryItem, RiskSummary } from './types';

const SAFE_FLOOR_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB

export function computeRiskAnalysis(items: MemoryItem[]): RiskSummary {
  if (items.length === 0) {
    return {
      safeFloorBytes: SAFE_FLOOR_BYTES,
      safeCount: 0,
      safeBytes: 0,
      atRiskCount: 0,
      atRiskBytes: 0,
      atRiskStartIso: undefined,
    };
  }

  // Sort items by creation date (oldest first)
  const sortedItems = [...items].sort((a, b) => {
    const aTime = new Date(a.createdAtIso).getTime();
    const bTime = new Date(b.createdAtIso).getTime();
    return aTime - bTime;
  });

  // Calculate median sizes for items with missing sizes
  const medianSizes = calculateMedianSizes(sortedItems);

  // Accumulate sizes and categorize items
  let safeCount = 0;
  let safeBytes = 0;
  let atRiskCount = 0;
  let atRiskBytes = 0;
  let atRiskStartIso: string | undefined;

  for (const item of sortedItems) {
    const size = item.sizeBytes ?? medianSizes.get(item.mediaType) ?? 1024 * 1024; // Default 1MB

    if (safeBytes + size <= SAFE_FLOOR_BYTES) {
      // This item is safe
      safeCount++;
      safeBytes += size;
    } else {
      // This item is at risk
      if (!atRiskStartIso) {
        atRiskStartIso = item.createdAtIso;
      }
      atRiskCount++;
      atRiskBytes += size;
    }
  }

  return {
    safeFloorBytes: SAFE_FLOOR_BYTES,
    safeCount,
    safeBytes,
    atRiskCount,
    atRiskBytes,
    atRiskStartIso,
  };
}

export function getItemsForExport(items: MemoryItem[], mode: "at-risk" | "all"): MemoryItem[] {
  if (mode === "all") {
    return items;
  }

  // For "at-risk" mode, we need to find the cutoff point
  const sortedItems = [...items].sort((a, b) => {
    const aTime = new Date(a.createdAtIso).getTime();
    const bTime = new Date(b.createdAtIso).getTime();
    return aTime - bTime;
  });

  const medianSizes = calculateMedianSizes(sortedItems);
  let accumulatedBytes = 0;
  let cutoffIndex = 0;

  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    const size = item.sizeBytes ?? medianSizes.get(item.mediaType) ?? 1024 * 1024;

    if (accumulatedBytes + size <= SAFE_FLOOR_BYTES) {
      accumulatedBytes += size;
      cutoffIndex = i + 1;
    } else {
      break;
    }
  }

  // Return items from cutoff point onwards (at-risk items)
  return sortedItems.slice(cutoffIndex);
}

function calculateMedianSizes(items: MemoryItem[]): Map<string, number> {
  const typeSizes = new Map<string, number[]>();

  // Collect sizes by media type
  for (const item of items) {
    if (item.sizeBytes !== undefined) {
      const sizes = typeSizes.get(item.mediaType) || [];
      sizes.push(item.sizeBytes);
      typeSizes.set(item.mediaType, sizes);
    }
  }

  // Calculate median for each type
  const medianSizes = new Map<string, number>();
  for (const [mediaType, sizes] of typeSizes) {
    if (sizes.length > 0) {
      sizes.sort((a, b) => a - b);
      const median = sizes.length % 2 === 0
        ? (sizes[sizes.length / 2 - 1] + sizes[sizes.length / 2]) / 2
        : sizes[Math.floor(sizes.length / 2)];
      medianSizes.set(mediaType, median);
    }
  }

  return medianSizes;
}
