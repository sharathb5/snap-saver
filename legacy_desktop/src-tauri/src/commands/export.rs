use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use anyhow::{Result, Context};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use time::OffsetDateTime;
use zip::ZipArchive;

use crate::model::{MemoryItem, ExportMode, ExportProgress};
use crate::db::ManifestDb;

pub struct ExportState {
    pub is_running: bool,
    pub progress: ExportProgress,
    pub run_id: Option<String>,
}

impl Default for ExportState {
    fn default() -> Self {
        Self {
            is_running: false,
            progress: ExportProgress {
                percent: 0.0,
                copied_count: 0,
                skipped_count: 0,
                failed_count: 0,
                current_file: None,
            },
            run_id: None,
        }
    }
}

pub fn start_export(
    app_handle: AppHandle,
    state: Arc<Mutex<ExportState>>,
    items: Vec<MemoryItem>,
    mode: ExportMode,
    dest_dir: String,
    zip_paths: Vec<String>,
) -> Result<String> {
    
    // Initialize database
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or_else(|| anyhow::anyhow!("Failed to get app data directory"))?;
    let db_path = app_data_dir.join("manifest.sqlite");
    let db = ManifestDb::new(db_path)?;
    
    // Start export run
    let run_id = db.start_run(&dest_dir, &mode)?;
    
    // Store run_id in state
    {
        let mut state = state.lock().unwrap();
        state.is_running = true;
        state.run_id = Some(run_id.clone());
    }
    
    // Store state in app state (this is already managed in main.rs)
    
    // Start export in background thread
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        if let Err(e) = perform_export(
            app_handle_clone,
            state,
            items,
            mode,
            dest_dir,
            zip_paths,
            db,
            run_id,
        ) {
            eprintln!("Export failed: {}", e);
        }
    });
    
    Ok(run_id)
}

fn perform_export(
    app_handle: AppHandle,
    state: Arc<Mutex<ExportState>>,
    items: Vec<MemoryItem>,
    mode: ExportMode,
    dest_dir: String,
    zip_paths: Vec<String>,
    db: ManifestDb,
    run_id: String,
) -> Result<()> {
    // Create destination directory structure
    let by_date_dir = Path::new(&dest_dir).join("by-date");
    fs::create_dir_all(&by_date_dir)?;
    
    // Create logs directory
    let logs_dir = Path::new(&dest_dir).join("logs");
    fs::create_dir_all(&logs_dir)?;
    
    // Get items to export
    let items_to_export = crate::commands::risk::get_items_for_export(items, mode)?;
    let total_items = items_to_export.len();
    
    if total_items == 0 {
        // No items to export
        let mut state = state.lock().unwrap();
        state.is_running = false;
        state.progress.percent = 100.0;
        db.finish_run(&run_id)?;
        return Ok(());
    }
    
    // Create ZIP archives map for efficient access
    let mut zip_archives: HashMap<String, ZipArchive<File>> = HashMap::new();
    for zip_path in &zip_paths {
        let file = File::open(zip_path)?;
        let archive = ZipArchive::new(file)?;
        zip_archives.insert(zip_path.clone(), archive);
    }
    
    let mut copied_count = 0;
    let mut skipped_count = 0;
    let mut failed_count = 0;
    
    for (index, item) in items_to_export.iter().enumerate() {
        // Check if export was cancelled
        {
            let state = state.lock().unwrap();
            if !state.is_running {
                break;
            }
        }
        
        // Update progress
        let percent = (index as f64 / total_items as f64) * 100.0;
        {
            let mut state = state.lock().unwrap();
            state.progress.percent = percent;
            state.progress.copied_count = copied_count;
            state.progress.skipped_count = skipped_count;
            state.progress.failed_count = failed_count;
            state.progress.current_file = Some(item.zip_path.clone());
        }
        
        // Emit progress event
        let _ = app_handle.emit("export-progress", &state.lock().unwrap().progress);
        
        // Check if file already exists (idempotent)
        if let Some(existing_hash) = db.get_existing_hash(&item.id)? {
            // File already processed, skip
            skipped_count += 1;
            continue;
        }
        
        // Find the ZIP file containing this item
        let zip_path = zip_paths.iter()
            .find(|path| {
                if let Some(archive) = zip_archives.get(*path) {
                    archive.file_names().any(|name| name == item.zip_path)
                } else {
                    false
                }
            });
        
        let zip_path = match zip_path {
            Some(path) => path,
            None => {
                eprintln!("Could not find ZIP file for item: {}", item.zip_path);
                failed_count += 1;
                continue;
            }
        };
        
        // Extract and process the file
        match extract_and_save_item(
            &mut zip_archives.get_mut(zip_path).unwrap(),
            item,
            &by_date_dir,
        ) {
            Ok((dest_path, sha256)) => {
                // Record the copy in database
                db.insert_hash(&item.id, &sha256, &dest_path.to_string_lossy())?;
                db.insert_copy(&item.id, &dest_path.to_string_lossy(), &sha256)?;
                copied_count += 1;
            }
            Err(e) => {
                eprintln!("Failed to extract {}: {}", item.zip_path, e);
                failed_count += 1;
            }
        }
        
        // Update database progress
        db.update_run_progress(&run_id, copied_count, failed_count)?;
        
        // Small delay to prevent overwhelming the system
        thread::sleep(Duration::from_millis(10));
    }
    
    // Final progress update
    {
        let mut state = state.lock().unwrap();
        state.is_running = false;
        state.progress.percent = 100.0;
        state.progress.copied_count = copied_count;
        state.progress.skipped_count = skipped_count;
        state.progress.failed_count = failed_count;
        state.progress.current_file = None;
    }
    
    // Emit final progress
    let _ = app_handle.emit("export-progress", &state.lock().unwrap().progress);
    
    // Finish the run
    db.finish_run(&run_id)?;
    
    // Create manifest.json
    create_manifest_json(&dest_dir, &db, &run_id)?;
    
    Ok(())
}

fn extract_and_save_item(
    archive: &mut ZipArchive<File>,
    item: &MemoryItem,
    base_dir: &Path,
) -> Result<(PathBuf, String)> {
    // Parse creation date for folder structure
    let created_at = item.created_at()
        .unwrap_or_else(|_| OffsetDateTime::now_utc());
    
    let year = created_at.year();
    let month = created_at.month() as u8;
    let day = created_at.day();
    
    // Create date-based directory structure
    let date_dir = base_dir
        .join(format!("{:04}", year))
        .join(format!("{:04}-{:02}", year, month))
        .join(format!("{:04}-{:02}-{:02}", year, month, day));
    
    fs::create_dir_all(&date_dir)?;
    
    // Extract filename from zip path
    let filename = Path::new(&item.zip_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown_file");
    
    let dest_path = date_dir.join(filename);
    
    // Extract file from ZIP
    let mut zip_file = archive.by_name(&item.zip_path)
        .with_context(|| format!("Failed to find file in ZIP: {}", item.zip_path))?;
    
    // Create temporary file for streaming
    let temp_path = dest_path.with_extension("tmp");
    let mut temp_file = File::create(&temp_path)?;
    
    // Stream and hash simultaneously
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192];
    
    loop {
        let bytes_read = zip_file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        
        hasher.update(&buffer[..bytes_read]);
        temp_file.write_all(&buffer[..bytes_read])?;
    }
    
    temp_file.flush()?;
    drop(temp_file);
    
    // Get final hash
    let sha256 = format!("{:x}", hasher.finalize());
    
    // Atomically move to final location
    fs::rename(&temp_path, &dest_path)?;
    
    Ok((dest_path, sha256))
}

fn create_manifest_json(dest_dir: &str, db: &ManifestDb, run_id: &str) -> Result<()> {
    if let Some(summary) = db.get_manifest_summary(run_id)? {
        let manifest_path = Path::new(dest_dir).join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&summary)?;
        fs::write(manifest_path, manifest_json)?;
    }
    
    Ok(())
}

pub fn cancel_export(state: Arc<Mutex<ExportState>>) -> Result<()> {
    let mut state = state.lock().unwrap();
    state.is_running = false;
    Ok(())
}
