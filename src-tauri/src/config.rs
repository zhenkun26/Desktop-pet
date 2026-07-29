use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetConfig {
    pub always_on_top: bool,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub visible: bool,
}

impl Default for PetConfig {
    fn default() -> Self {
        Self {
            always_on_top: true,
            window_x: None,
            window_y: None,
            visible: true,
        }
    }
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> PetConfig {
    let Some(path) = config_path(app) else {
        return PetConfig::default();
    };
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => PetConfig::default(),
    }
}

pub fn save_config(app: &AppHandle, config: &PetConfig) {
    if let Some(path) = config_path(app) {
        if let Ok(s) = serde_json::to_string_pretty(config) {
            let _ = std::fs::write(path, s);
        }
    }
    let _ = app.emit("config-changed", config.clone());
}

/// 检查位置是否在任何显示器可视工作区内，越界则回收到主显示器右下角
pub fn clamp_to_visible(win: &WebviewWindow, x: i32, y: i32, w: i32, h: i32) -> (i32, i32) {
    if let Ok(monitors) = win.available_monitors() {
        for m in &monitors {
            let pos = m.position();
            let size = m.size();
            let mx = pos.x as i32;
            let my = pos.y as i32;
            let mw = size.width as i32;
            let mh = size.height as i32;
            if x + w > mx && x < mx + mw && y + h > my && y < my + mh {
                return (x, y);
            }
        }
    }
    // 回收到主显示器右下角
    if let Ok(Some(primary)) = win.primary_monitor() {
        let pos = primary.position();
        let size = primary.size();
        let x = pos.x as i32 + size.width as i32 - w - 24;
        let y = pos.y as i32 + 80;
        return (x, y);
    }
    (x, y)
}
