pub mod scan;
pub mod risk;
pub mod export;

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};
use anyhow::Result;
use crate::commands::export::ExportState;

use crate::model::{ScanResult, RiskSummary, ExportMode, ExportProgress};

#[tauri::command]
pub async fn scan_zips(zip_paths: Vec<String>) -> Result<ScanResult, String> {
    scan::scan_zip_files(zip_paths)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compute_risk(items: Vec<crate::model::MemoryItem>) -> Result<RiskSummary, String> {
    risk::compute_risk_analysis(items)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_start(
    app_handle: AppHandle,
    state: State<'_, Arc<Mutex<ExportState>>>,
    items: Vec<crate::model::MemoryItem>,
    mode: ExportMode,
    dest_dir: String,
    zip_paths: Vec<String>,
) -> Result<String, String> {
    export::start_export(app_handle, state.inner().clone(), items, mode, dest_dir, zip_paths)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_cancel(
    state: State<'_, Arc<Mutex<ExportState>>>,
) -> Result<(), String> {
    export::cancel_export(state.inner().clone())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_export_progress(
    state: State<'_, Arc<Mutex<ExportState>>>,
) -> Result<ExportProgress, String> {
    let state = state.inner().lock().unwrap();
    Ok(state.progress.clone())
}
