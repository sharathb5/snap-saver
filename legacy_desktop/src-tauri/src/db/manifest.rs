use rusqlite::{Connection, Result as SqlResult, params};
use serde_json;
use std::path::Path;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::model::{MemoryItem, ExportMode, ManifestSummary};

pub struct ManifestDb {
    conn: Connection,
}

impl ManifestDb {
    pub fn new<P: AsRef<Path>>(path: P) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        let db = ManifestDb { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqlResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                created_at_iso TEXT NOT NULL,
                zip_path TEXT NOT NULL,
                size_bytes INTEGER,
                media_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS hashes (
                item_id TEXT PRIMARY KEY,
                sha256 TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items (id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS copies (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                dest_path TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                copied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items (id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                dest_dir TEXT NOT NULL,
                mode TEXT NOT NULL,
                started_at DATETIME NOT NULL,
                ended_at DATETIME,
                copied_count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'running'
            )",
            [],
        )?;

        Ok(())
    }

    pub fn insert_items(&self, items: &[MemoryItem]) -> SqlResult<()> {
        let tx = self.conn.transaction()?;
        
        for item in items {
            tx.execute(
                "INSERT OR REPLACE INTO items (id, created_at_iso, zip_path, size_bytes, media_type) 
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    item.id,
                    item.created_at_iso,
                    item.zip_path,
                    item.size_bytes,
                    serde_json::to_string(&item.media_type).unwrap()
                ],
            )?;
        }
        
        tx.commit()?;
        Ok(())
    }

    pub fn get_existing_hash(&self, item_id: &str) -> SqlResult<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT sha256 FROM hashes WHERE item_id = ?1")?;
        let mut rows = stmt.query([item_id])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn insert_hash(&self, item_id: &str, sha256: &str, file_path: &str) -> SqlResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO hashes (item_id, sha256, file_path) VALUES (?1, ?2, ?3)",
            params![item_id, sha256, file_path],
        )?;
        Ok(())
    }

    pub fn insert_copy(&self, item_id: &str, dest_path: &str, sha256: &str) -> SqlResult<String> {
        let copy_id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO copies (id, item_id, dest_path, sha256) VALUES (?1, ?2, ?3, ?4)",
            params![copy_id, item_id, dest_path, sha256],
        )?;
        Ok(copy_id)
    }

    pub fn start_run(&self, dest_dir: &str, mode: &ExportMode) -> SqlResult<String> {
        let run_id = Uuid::new_v4().to_string();
        let now = OffsetDateTime::now_utc();
        
        self.conn.execute(
            "INSERT INTO runs (id, dest_dir, mode, started_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                run_id,
                dest_dir,
                serde_json::to_string(mode).unwrap(),
                now.to_string()
            ],
        )?;
        
        Ok(run_id)
    }

    pub fn update_run_progress(&self, run_id: &str, copied_count: usize, error_count: usize) -> SqlResult<()> {
        self.conn.execute(
            "UPDATE runs SET copied_count = ?1, error_count = ?2 WHERE id = ?3",
            params![copied_count, error_count, run_id],
        )?;
        Ok(())
    }

    pub fn finish_run(&self, run_id: &str) -> SqlResult<()> {
        let now = OffsetDateTime::now_utc();
        self.conn.execute(
            "UPDATE runs SET ended_at = ?1, status = 'completed' WHERE id = ?2",
            params![now.to_string(), run_id],
        )?;
        Ok(())
    }

    pub fn get_manifest_summary(&self, run_id: &str) -> SqlResult<Option<ManifestSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT dest_dir, mode, started_at, ended_at, copied_count, error_count 
             FROM runs WHERE id = ?1"
        )?;
        let mut rows = stmt.query([run_id])?;
        
        if let Some(row) = rows.next()? {
            let dest_dir: String = row.get(0)?;
            let mode_str: String = row.get(1)?;
            let started_at: String = row.get(2)?;
            let ended_at: Option<String> = row.get(3)?;
            let copied_count: usize = row.get(4)?;
            let error_count: usize = row.get(5)?;
            
            let mode: ExportMode = serde_json::from_str(&mode_str)?;
            
            Ok(Some(ManifestSummary {
                dest: dest_dir,
                copied_count,
                error_count,
                run_started_iso: started_at,
                run_ended_iso: ended_at.unwrap_or_else(|| OffsetDateTime::now_utc().to_string()),
                mode,
            }))
        } else {
            Ok(None)
        }
    }
}
