pub mod manifest;

use std::path::PathBuf;
use tauri::PathResolver;
use anyhow::Result;

pub use manifest::ManifestDb;

pub fn init(path_resolver: &PathResolver) -> Result<()> {
    let app_data_dir = path_resolver
        .app_data_dir()
        .ok_or_else(|| anyhow::anyhow!("Failed to get app data directory"))?;
    
    std::fs::create_dir_all(&app_data_dir)?;
    
    let db_path = app_data_dir.join("manifest.sqlite");
    let _db = ManifestDb::new(db_path)?;
    
    Ok(())
}
