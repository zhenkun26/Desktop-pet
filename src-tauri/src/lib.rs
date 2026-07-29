mod chat;
mod commands;
mod config;
mod tray;

use chat::AbortRegistry;
use config::PetConfig;
use std::sync::{Arc, Mutex};
use tauri::{Manager, PhysicalPosition};

const PET_W: i32 = 200;
const PET_H: i32 = 300;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(PetConfig::default()))
        .setup(|app| {
            let handle = app.handle();

            // 加载配置，启动时强制可见
            let mut config = config::load_config(handle);
            config.visible = true;
            *handle
                .state::<Mutex<PetConfig>>()
                .lock()
                .unwrap() = config.clone();

            // 设置 pet 窗口位置和置顶
            if let Some(pet_win) = handle.get_webview_window("pet") {
                let (x, y) = config::clamp_to_visible(
                    &pet_win,
                    config.window_x.unwrap_or(0),
                    config.window_y.unwrap_or(0),
                    PET_W,
                    PET_H,
                );
                let _ = pet_win.set_position(PhysicalPosition::new(x, y));
                let _ = pet_win.set_always_on_top(config.always_on_top);

                // 持久化 clamp 后的位置
                let state = handle.state::<Mutex<PetConfig>>();
                let mut cfg = state.lock().unwrap();
                cfg.window_x = Some(x);
                cfg.window_y = Some(y);
            }

            // 初始化聊天数据库
            let db_path = handle
                .path()
                .app_data_dir()
                .expect("failed to get app_data_dir")
                .join("chat.db");
            std::fs::create_dir_all(db_path.parent().unwrap())
                .expect("failed to create app_data_dir");
            let database = Arc::new(
                chat::db::Database::new(&db_path)
                    .expect("failed to initialize chat database"),
            );
            handle.manage(database);

            // 初始化 abort 管理器
            handle.manage(Arc::new(AbortRegistry::new()));

            // 创建系统托盘
            tray::create_tray(handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 桌宠窗口命令
            commands::get_config,
            commands::move_window,
            commands::save_position,
            commands::show_pet,
            commands::hide_pet,
            commands::toggle_visible,
            commands::set_always_on_top,
            commands::show_context_menu,
            commands::open_chat,
            // 聊天会话命令
            commands::list_conversations,
            commands::create_conversation,
            commands::rename_conversation,
            commands::delete_conversation,
            commands::get_conversation_messages,
            // 人设命令
            commands::get_persona_profile,
            commands::update_persona_profile,
            // API Key 命令
            commands::get_api_key_status,
            commands::set_api_key,
            commands::clear_api_key,
            commands::test_api_key,
            // 聊天消息命令
            commands::send_chat_message,
            commands::stop_chat_generation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
