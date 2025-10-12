use std::collections::HashMap;
use anyhow::Result;
use time::OffsetDateTime;

use crate::model::{MemoryItem, RiskSummary, ExportMode};

const SAFE_FLOOR_BYTES: u64 = 5 * 1024 * 1024 * 1024; // 5 GiB

pub fn compute_risk_analysis(items: Vec<MemoryItem>) -> Result<RiskSummary> {
    if items.is_empty() {
        return Ok(RiskSummary {
            safe_floor_bytes: SAFE_FLOOR_BYTES,
            safe_count: 0,
            safe_bytes: 0,
            at_risk_count: 0,
            at_risk_bytes: 0,
            at_risk_start_iso: None,
        });
    }

    // Sort items by creation date (oldest first)
    let mut sorted_items = items;
    sorted_items.sort_by(|a, b| {
        let a_time = a.created_at().unwrap_or_else(|_| OffsetDateTime::now_utc());
        let b_time = b.created_at().unwrap_or_else(|_| OffsetDateTime::now_utc());
        a_time.cmp(&b_time)
    });

    // Calculate median sizes for items with missing sizes
    let median_sizes = calculate_median_sizes(&sorted_items);

    // Accumulate sizes and categorize items
    let mut safe_count = 0;
    let mut safe_bytes = 0u64;
    let mut at_risk_count = 0;
    let mut at_risk_bytes = 0u64;
    let mut at_risk_start_iso = None;

    for item in &sorted_items {
        let size = item.size_bytes.unwrap_or_else(|| {
            // Use median size for this media type if size is unknown
            median_sizes.get(&item.media_type).copied().unwrap_or(1024 * 1024) // Default 1MB
        });

        if safe_bytes + size <= SAFE_FLOOR_BYTES {
            // This item is safe
            safe_count += 1;
            safe_bytes += size;
        } else {
            // This item is at risk
            if at_risk_start_iso.is_none() {
                at_risk_start_iso = Some(item.created_at_iso.clone());
            }
            at_risk_count += 1;
            at_risk_bytes += size;
        }
    }

    Ok(RiskSummary {
        safe_floor_bytes: SAFE_FLOOR_BYTES,
        safe_count,
        safe_bytes,
        at_risk_count,
        at_risk_bytes,
        at_risk_start_iso,
    })
}

pub fn get_items_for_export(items: Vec<MemoryItem>, mode: ExportMode) -> Result<Vec<MemoryItem>> {
    match mode {
        ExportMode::AtRisk => {
            let risk_summary = compute_risk_analysis(items.clone())?;
            
            // Sort items by creation date (oldest first)
            let mut sorted_items = items;
            sorted_items.sort_by(|a, b| {
                let a_time = a.created_at().unwrap_or_else(|_| OffsetDateTime::now_utc());
                let b_time = b.created_at().unwrap_or_else(|_| OffsetDateTime::now_utc());
                a_time.cmp(&b_time)
            });

            // Calculate median sizes for items with missing sizes
            let median_sizes = calculate_median_sizes(&sorted_items);

            // Find the cutoff point
            let mut accumulated_bytes = 0u64;
            let mut cutoff_index = 0;

            for (i, item) in sorted_items.iter().enumerate() {
                let size = item.size_bytes.unwrap_or_else(|| {
                    median_sizes.get(&item.media_type).copied().unwrap_or(1024 * 1024)
                });

                if accumulated_bytes + size <= SAFE_FLOOR_BYTES {
                    accumulated_bytes += size;
                    cutoff_index = i + 1;
                } else {
                    break;
                }
            }

            // Return items from cutoff point onwards (at-risk items)
            Ok(sorted_items.into_iter().skip(cutoff_index).collect())
        }
        ExportMode::All => Ok(items),
    }
}

fn calculate_median_sizes(items: &[MemoryItem]) -> HashMap<MediaType, u64> {
    let mut type_sizes: HashMap<MediaType, Vec<u64>> = HashMap::new();

    // Collect sizes by media type
    for item in items {
        if let Some(size) = item.size_bytes {
            type_sizes.entry(item.media_type.clone()).or_default().push(size);
        }
    }

    // Calculate median for each type
    let mut median_sizes = HashMap::new();
    for (media_type, mut sizes) in type_sizes {
        if !sizes.is_empty() {
            sizes.sort_unstable();
            let median = if sizes.len() % 2 == 0 {
                (sizes[sizes.len() / 2 - 1] + sizes[sizes.len() / 2]) / 2
            } else {
                sizes[sizes.len() / 2]
            };
            median_sizes.insert(media_type, median);
        }
    }

    median_sizes
}
