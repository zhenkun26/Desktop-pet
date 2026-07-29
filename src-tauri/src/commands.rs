use crate::chat::{self, db, persona, secrets, AbortRegistry, SendChatInput};
use crate::config::{self, PetConfig};
use std::sync::{Arc, Mutex};
use tauri::menu::ContextMenu;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

const PET_LABEL: &str = "pet";
const PET_W: i32 = 200;
const PET_H: i32 = 300;
const PET_ID: &str = "hutao";

#[tauri::command]
pub fn get_config(app: AppHandle) -> PetConfig {
    let state = app.state::<Mutex<PetConfig>>();
    let cfg = state.lock().unwrap();
    cfg.clone()
}

#[tauri::command]
pub fn move_window(app: AppHandle, dx: i32, dy: i32) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        if let Ok(pos) = win.outer_position() {
            let _ = win.set_position(PhysicalPosition::new(pos.x + dx, pos.y + dy));
        }
    }
}

#[tauri::command]
pub fn save_position(app: AppHandle) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        if let Ok(pos) = win.outer_position() {
            let state = app.state::<Mutex<PetConfig>>();
            let mut cfg = state.lock().unwrap();
            cfg.window_x = Some(pos.x);
            cfg.window_y = Some(pos.y);
            config::save_config(&app, &cfg);
        }
    }
}

#[tauri::command]
pub fn show_pet(app: AppHandle) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        // clamp 位置
        if let Ok(pos) = win.outer_position() {
            let (x, y) = config::clamp_to_visible(&win, pos.x, pos.y, PET_W, PET_H);
            if x != pos.x || y != pos.y {
                let _ = win.set_position(PhysicalPosition::new(x, y));
                let state = app.state::<Mutex<PetConfig>>();
                let mut cfg = state.lock().unwrap();
                cfg.window_x = Some(x);
                cfg.window_y = Some(y);
                config::save_config(&app, &cfg);
            }
        }
        let _ = win.show();
        let _ = win.set_focus();
        let state = app.state::<Mutex<PetConfig>>();
        let mut cfg = state.lock().unwrap();
        cfg.visible = true;
        config::save_config(&app, &cfg);
    }
}

#[tauri::command]
pub fn hide_pet(app: AppHandle) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        let _ = win.hide();
        let state = app.state::<Mutex<PetConfig>>();
        let mut cfg = state.lock().unwrap();
        cfg.visible = false;
        config::save_config(&app, &cfg);
    }
}

#[tauri::command]
pub fn toggle_visible(app: AppHandle) {
    let state = app.state::<Mutex<PetConfig>>();
    let visible = state.lock().unwrap().visible;
    drop(state);
    if visible {
        hide_pet(app.clone());
    } else {
        show_pet(app.clone());
    }
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, value: bool) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        let _ = win.set_always_on_top(value);
        let state = app.state::<Mutex<PetConfig>>();
        let mut cfg = state.lock().unwrap();
        cfg.always_on_top = value;
        config::save_config(&app, &cfg);
    }
}

#[tauri::command]
pub fn show_context_menu(app: AppHandle) {
    if let Some(win) = app.get_webview_window(PET_LABEL) {
        let menu = crate::tray::build_menu(&app);
        let window = win.as_ref().window();
        let _ = menu.popup(window);
    }
}

#[tauri::command]
pub async fn open_chat(app: AppHandle, options: Option<crate::tray::OpenChatOptions>) {
    let opts = options.unwrap_or_default();

    // 单例逻辑：若 chat 窗口已存在则聚焦，否则创建
    if let Some(chat_win) = app.get_webview_window("chat") {
        let _ = chat_win.show();
        let _ = chat_win.set_focus();
        let _ = app.emit("chat-open-options", &opts);
    } else {
        // 创建 chat 窗口
        let chat_win = tauri::webview::WebviewWindowBuilder::new(
            &app,
            "chat",
            tauri::WebviewUrl::App("index.html?window=chat".into()),
        )
        .title("胡桃桌宠 - 聊天")
        .inner_size(480.0, 640.0)
        .min_inner_size(380.0, 480.0)
        .build();

        match chat_win {
            Ok(_win) => {
                // 窗口创建后延迟 emit，等前端加载并注册监听器
                let app_clone = app.clone();
                let opts_clone = opts.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    let _ = app_clone.emit("chat-open-options", &opts_clone);
                });
            }
            Err(e) => {
                eprintln!("创建聊天窗口失败: {}", e);
            }
        }
    }
}

// ===== Chat 命令 =====

#[tauri::command]
pub fn list_conversations(app: AppHandle) -> Result<Vec<db::Conversation>, String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    database.list_conversations(PET_ID).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_conversation(
    app: AppHandle,
    title: Option<String>,
) -> Result<db::Conversation, String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    database
        .create_conversation(PET_ID, title.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_conversation(
    app: AppHandle,
    conversation_id: String,
    title: String,
) -> Result<(), String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    database
        .rename_conversation(&conversation_id, &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_conversation(app: AppHandle, conversation_id: String) -> Result<(), String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    database
        .delete_conversation(&conversation_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_conversation_messages(
    app: AppHandle,
    conversation_id: String,
) -> Result<Vec<db::Message>, String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    database
        .get_conversation_messages(&conversation_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_persona_profile(app: AppHandle) -> Result<persona::PersonaProfile, String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    let persona_json = database.get_persona(PET_ID).map_err(|e| e.to_string())?;
    let overrides = persona_json
        .as_deref()
        .and_then(|s| serde_json::from_str::<persona::PersonaProfileFields>(s).ok());
    let profile = persona::merge_persona_profile(
        PET_ID,
        overrides,
        chrono::Utc::now().timestamp(),
    );
    Ok(profile)
}

#[tauri::command]
pub fn update_persona_profile(
    app: AppHandle,
    fields: persona::PersonaProfileFields,
) -> Result<persona::PersonaProfile, String> {
    let database = app.state::<Arc<db::Database>>().inner().clone();
    let sanitized = persona::sanitize_persona_fields(fields);
    let json = serde_json::to_string(&sanitized).map_err(|e| e.to_string())?;
    database
        .save_persona(PET_ID, &json)
        .map_err(|e| e.to_string())?;
    let profile = persona::merge_persona_profile(
        PET_ID,
        Some(sanitized),
        chrono::Utc::now().timestamp(),
    );
    Ok(profile)
}

// ===== API Key 命令 =====

#[tauri::command]
pub fn get_api_key_status() -> Result<secrets::ApiKeyStatus, String> {
    secrets::get_api_key_status()
}

#[tauri::command]
pub fn set_api_key(api_key: String) -> Result<(), String> {
    secrets::set_api_key(&api_key)
}

#[tauri::command]
pub fn clear_api_key() -> Result<(), String> {
    secrets::delete_api_key()
}

#[tauri::command]
pub async fn test_api_key(api_key: Option<String>) -> Result<(bool, String), String> {
    let key = match api_key {
        Some(k) => k,
        None => match secrets::get_api_key()? {
            Some(k) => k,
            None => {
                return Ok((false, "未配置 API Key".to_string()));
            }
        },
    };
    let (ok, msg) = chat::deepseek::test_api_key(&key)
        .await
        .map_err(|e| e.message)?;
    Ok((ok, msg))
}

// ===== 聊天消息命令 =====

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    input: SendChatInput,
) -> Result<(), String> {
    chat::service::send_chat_message(app, input)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn stop_chat_generation(app: AppHandle) -> Result<(), String> {
    let registry = app.state::<Arc<AbortRegistry>>().inner().clone();
    registry.abort_current().await;
    Ok(())
}
