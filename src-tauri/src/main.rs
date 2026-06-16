// Prevents an extra console window from appearing alongside the app on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;

/// Write raw bytes to an absolute path chosen by the user via the native save dialog.
/// Bytes arrive from the frontend as a JSON number array (Vec<u8>); fine for the
/// KB–low-MB documents Parchment exports.
#[tauri::command]
fn write_file_bytes(path: String, contents: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(&path, &contents).map_err(|e| e.to_string())
}

/// Read raw bytes from an absolute path chosen by the user via the native open dialog.
#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![write_file_bytes, read_file_bytes])
        .run(tauri::generate_context!())
        .expect("error while running the Parchment desktop app");
}
