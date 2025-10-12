use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MediaType {
    Photo,
    Video,
    Unknown,
}

impl From<&str> for MediaType {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "photo" | "image" => MediaType::Photo,
            "video" => MediaType::Video,
            _ => MediaType::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryItem {
    pub id: String,
    pub created_at_iso: String,
    pub zip_path: String,
    pub size_bytes: Option<u64>,
    pub media_type: MediaType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub items: Vec<MemoryItem>,
    pub total_bytes: u64,
    pub missing_sizes_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskSummary {
    pub safe_floor_bytes: u64,
    pub safe_count: usize,
    pub safe_bytes: u64,
    pub at_risk_count: usize,
    pub at_risk_bytes: u64,
    pub at_risk_start_iso: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportPlan {
    pub mode: ExportMode,
    pub dest_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportMode {
    AtRisk,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub percent: f64,
    pub copied_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub current_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestSummary {
    pub dest: String,
    pub copied_count: usize,
    pub error_count: usize,
    pub run_started_iso: String,
    pub run_ended_iso: String,
    pub mode: ExportMode,
}

impl MemoryItem {
    pub fn created_at(&self) -> Result<OffsetDateTime, time::Error> {
        OffsetDateTime::parse(&self.created_at_iso, &time::format_description::well_known::Rfc3339)
    }
}
