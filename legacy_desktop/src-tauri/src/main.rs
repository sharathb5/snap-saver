// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod model;
mod db;

use commands::*;
use tauri::Manager;
use std::sync::{Arc, Mutex};
use commands::export::ExportState;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(ExportState::default())))
        .invoke_handler(tauri::generate_handler![
            scan_zips,
            compute_risk,
            export_start,
            export_cancel,
            get_export_progress
        ])
        .setup(|app| {
            // Initialize database
            db::init(&app.path_resolver())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
