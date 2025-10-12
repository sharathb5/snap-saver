use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;
use anyhow::{Result, Context};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::model::{MemoryItem, MediaType, ScanResult};

pub fn scan_zip_files(zip_paths: Vec<String>) -> Result<ScanResult> {
    let mut all_items = Vec::new();
    let mut total_bytes = 0u64;
    let mut missing_sizes_count = 0usize;

    for zip_path in zip_paths {
        let file = File::open(&zip_path)
            .with_context(|| format!("Failed to open ZIP file: {}", zip_path))?;
        
        let mut archive = ZipArchive::new(file)
            .with_context(|| format!("Failed to read ZIP archive: {}", zip_path))?;

        // Find and parse index files
        let index_files = find_index_files(&mut archive)?;
        
        for index_file in index_files {
            let items = parse_index_file(&mut archive, &index_file, &zip_path)?;
            
            for mut item in items {
                // Generate stable ID if not present
                if item.id.is_empty() {
                    item.id = generate_stable_id(&item.zip_path, &item.created_at_iso);
                }
                
                // Count missing sizes
                if item.size_bytes.is_none() {
                    missing_sizes_count += 1;
                } else {
                    total_bytes += item.size_bytes.unwrap();
                }
                
                all_items.push(item);
            }
        }
    }

    // Remove duplicates based on ID
    let mut seen_ids = std::collections::HashSet::new();
    all_items.retain(|item| seen_ids.insert(item.id.clone()));

    Ok(ScanResult {
        items: all_items,
        total_bytes,
        missing_sizes_count,
    })
}

fn find_index_files(archive: &mut ZipArchive<File>) -> Result<Vec<String>> {
    let mut index_files = Vec::new();
    
    for i in 0..archive.len() {
        let file = archive.by_index(i)?;
        let name = file.name().to_string();
        
        // Look for common index file patterns
        if name.contains("memories_history") && name.ends_with(".json") {
            index_files.push(name);
        } else if name.contains("data") && name.ends_with(".json") && name.contains("export") {
            index_files.push(name);
        }
    }
    
    Ok(index_files)
}

fn parse_index_file(
    archive: &mut ZipArchive<File>,
    index_file: &str,
    zip_path: &str,
) -> Result<Vec<MemoryItem>> {
    let mut file = archive.by_name(index_file)
        .with_context(|| format!("Failed to read index file: {}", index_file))?;
    
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    
    let json: Value = serde_json::from_str(&contents)
        .with_context(|| format!("Failed to parse JSON from: {}", index_file))?;
    
    let mut items = Vec::new();
    
    // Try different JSON structures
    if let Some(saved_media) = json.get("Saved Media") {
        items.extend(parse_saved_media(saved_media, zip_path)?);
    }
    
    if let Some(memories) = json.get("Memories") {
        items.extend(parse_memories(memories, zip_path)?);
    }
    
    if let Some(media_list) = json.as_array() {
        items.extend(parse_media_array(media_list, zip_path)?);
    }
    
    Ok(items)
}

fn parse_saved_media(saved_media: &Value, zip_path: &str) -> Result<Vec<MemoryItem>> {
    let mut items = Vec::new();
    
    if let Some(media_array) = saved_media.as_array() {
        for media in media_array {
            if let Some(item) = parse_media_item(media, zip_path)? {
                items.push(item);
            }
        }
    }
    
    Ok(items)
}

fn parse_memories(memories: &Value, zip_path: &str) -> Result<Vec<MemoryItem>> {
    let mut items = Vec::new();
    
    if let Some(memories_array) = memories.as_array() {
        for memory in memories_array {
            if let Some(item) = parse_media_item(memory, zip_path)? {
                items.push(item);
            }
        }
    }
    
    Ok(items)
}

fn parse_media_array(media_array: &[Value], zip_path: &str) -> Result<Vec<MemoryItem>> {
    let mut items = Vec::new();
    
    for media in media_array {
        if let Some(item) = parse_media_item(media, zip_path)? {
            items.push(item);
        }
    }
    
    Ok(items)
}

fn parse_media_item(media: &Value, zip_path: &str) -> Result<Option<MemoryItem>> {
    // Extract common fields with fallbacks
    let zip_path_inner = media.get("Path")
        .or_else(|| media.get("path"))
        .or_else(|| media.get("file_path"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    if zip_path_inner.is_empty() {
        return Ok(None);
    }
    
    let created_at = media.get("Date")
        .or_else(|| media.get("date"))
        .or_else(|| media.get("created_at"))
        .or_else(|| media.get("Date Created"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    let created_at_iso = normalize_timestamp(created_at)?;
    
    let size_bytes = media.get("File Size")
        .or_else(|| media.get("file_size"))
        .or_else(|| media.get("size"))
        .and_then(|v| v.as_u64());
    
    let media_type_str = media.get("Media Type")
        .or_else(|| media.get("media_type"))
        .or_else(|| media.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    
    let media_type = MediaType::from(media_type_str);
    
    Ok(Some(MemoryItem {
        id: String::new(), // Will be generated later
        created_at_iso,
        zip_path: zip_path_inner,
        size_bytes,
        media_type,
    }))
}

fn normalize_timestamp(timestamp: &str) -> Result<String> {
    if timestamp.is_empty() {
        return Ok(OffsetDateTime::now_utc().to_string());
    }
    
    // Try different timestamp formats
    let formats = [
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%.fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
    ];
    
    for format in &formats {
        if let Ok(dt) = OffsetDateTime::parse(timestamp, &time::format_description::parse(format)?) {
            return Ok(dt.to_string());
        }
    }
    
    // If all parsing fails, use current time
    Ok(OffsetDateTime::now_utc().to_string())
}

fn generate_stable_id(zip_path: &str, created_at: &str) -> String {
    let input = format!("{}:{}", zip_path, created_at);
    let hash = sha2::Sha256::digest(input.as_bytes());
    format!("{:x}", hash)
}
