// Prevents an extra console window from appearing alongside the app on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::Manager;

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
    let mut builder = tauri::Builder::default();

    // Single-instance must be the FIRST plugin. On a second launch, focus the
    // existing window rather than opening a duplicate on the same local database.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        // Remember window size/position/maximized across launches.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // A native application menu. Critically, the Edit submenu restores the
            // standard clipboard/undo shortcuts in the macOS WebView (Cut/Copy/
            // Paste/Select-All), which are otherwise missing without a menu.
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let file = SubmenuBuilder::new(app, "File").quit().build()?;
            let window = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;
            let menu = MenuBuilder::new(app).items(&[&file, &edit, &window]).build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![write_file_bytes, read_file_bytes])
        .run(tauri::generate_context!())
        .expect("error while running the Parchment desktop app");
}
