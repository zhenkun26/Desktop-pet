use crate::config::PetConfig;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenChatOptions {
    pub view: String,
}

impl Default for OpenChatOptions {
    fn default() -> Self {
        Self {
            view: "chat".to_string(),
        }
    }
}

/// 构建右键/托盘共享菜单（每次调用重建以同步 checked 状态）
pub fn build_menu(app: &AppHandle) -> Menu<tauri::Wry> {
    let state = app.state::<Mutex<PetConfig>>();
    let cfg = state.lock().unwrap();

    let chat = MenuItem::with_id(app, "chat", "和我聊天", true, None::<&str>).unwrap();
    let persona =
        MenuItem::with_id(app, "persona", "角色设定", true, None::<&str>).unwrap();
    let sep1 = PredefinedMenuItem::separator(app).unwrap();
    let always_top = CheckMenuItem::with_id(
        app,
        "toggle_top",
        "始终置顶",
        true,
        cfg.always_on_top,
        None::<&str>,
    )
    .unwrap();
    let visible_label = if cfg.visible { "隐藏宠物" } else { "显示宠物" };
    let toggle_visible =
        MenuItem::with_id(app, "toggle_visible", visible_label, true, None::<&str>).unwrap();
    let sep2 = PredefinedMenuItem::separator(app).unwrap();
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).unwrap();

    Menu::with_items(
        app,
        &[
            &chat,
            &persona,
            &sep1,
            &always_top,
            &toggle_visible,
            &sep2,
            &quit,
        ],
    )
    .unwrap()
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app);
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("missing window icon");

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("胡桃桌宠")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(handle_tray_event)
        .build(app)?;

    Ok(())
}

fn handle_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "chat" => {
            let _ = app.emit(
                "chat-open-options",
                &OpenChatOptions {
                    view: "chat".to_string(),
                },
            );
        }
        "persona" => {
            let _ = app.emit(
                "chat-open-options",
                &OpenChatOptions {
                    view: "persona".to_string(),
                },
            );
        }
        "toggle_top" => {
            let state = app.state::<Mutex<PetConfig>>();
            let mut cfg = state.lock().unwrap();
            cfg.always_on_top = !cfg.always_on_top;
            let new_val = cfg.always_on_top;
            drop(cfg);
            if let Some(win) = app.get_webview_window("pet") {
                let _ = win.set_always_on_top(new_val);
            }
            let state = app.state::<Mutex<PetConfig>>();
            let cfg = state.lock().unwrap();
            crate::config::save_config(app, &cfg);
        }
        "toggle_visible" => {
            let state = app.state::<Mutex<PetConfig>>();
            let visible = state.lock().unwrap().visible;
            drop(state);
            if visible {
                crate::commands::hide_pet(app.clone());
            } else {
                crate::commands::show_pet(app.clone());
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn handle_tray_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        let app = tray.app_handle();
        let state = app.state::<Mutex<PetConfig>>();
        let visible = state.lock().unwrap().visible;
        drop(state);
        if !visible {
            crate::commands::show_pet(app.clone());
        } else if let Some(win) = app.get_webview_window("pet") {
            let _ = win.set_focus();
        }
    }
}
