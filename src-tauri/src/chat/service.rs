// 聊天服务协调模块

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{oneshot, Mutex};

use super::db::{self, Conversation, Message};
use super::deepseek::{self, ChatError, ChatErrorCode, ChatMessage};
use super::persona::{self, PersonaProfileFields};
use super::secrets;

/// 流式事件
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatStreamEvent {
    Start {
        conversation_id: String,
        user_message_id: String,
    },
    Delta {
        conversation_id: String,
        delta: String,
    },
    Done {
        conversation_id: String,
        assistant_message_id: String,
        full_content: String,
    },
    Error {
        conversation_id: String,
        code: String,
        message: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatInput {
    pub conversation_id: String,
    pub content: String,
}

/// 全局 abort 管理器
pub struct AbortRegistry {
    pub current: Mutex<Option<oneshot::Sender<()>>>,
}

impl AbortRegistry {
    pub fn new() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }

    pub async fn abort_current(&self) {
        let mut guard = self.current.lock().await;
        if let Some(sender) = guard.take() {
            let _ = sender.send(());
        }
    }

    pub async fn set(&self, sender: oneshot::Sender<()>) {
        let mut guard = self.current.lock().await;
        // 如果已有进行中的请求，先 abort
        if let Some(old) = guard.take() {
            let _ = old.send(());
        }
        *guard = Some(sender);
    }

    pub async fn clear(&self) {
        let mut guard = self.current.lock().await;
        *guard = None;
    }
}

/// 发送聊天消息
pub async fn send_chat_message(
    app: AppHandle,
    input: SendChatInput,
) -> Result<(), ChatError> {
    let conversation_id = input.conversation_id.clone();
    let content = input.content.clone();

    // 1. 获取 API Key
    let api_key = secrets::get_api_key().map_err(|e| ChatError {
        code: ChatErrorCode::Network,
        message: e,
    })?;

    let api_key = match api_key {
        Some(k) => k,
        None => {
            return Err(ChatError {
                code: ChatErrorCode::MissingApiKey,
                message: "未配置 API Key，请先在设置中配置".to_string(),
            });
        }
    };

    // 2. 获取数据库
    let database = app.state::<Arc<db::Database>>().inner().clone();

    // 3. 保存 user 消息
    let user_msg = database
        .insert_message(&conversation_id, "user", &content, "ok", None)
        .map_err(|e| ChatError {
            code: ChatErrorCode::Unknown,
            message: format!("保存用户消息失败: {}", e),
        })?;

    // 4. 自动更新会话标题（首条消息时）
    let _ = database.update_conversation_title_if_default(&conversation_id, &content);

    // 5. 加载人设
    let persona_json = database.get_persona("hutao").ok().flatten();
    let overrides = persona_json
        .as_deref()
        .and_then(|s| serde_json::from_str::<PersonaProfileFields>(s).ok());
    let profile = persona::merge_persona_profile("hutao", overrides, chrono::Utc::now().timestamp());
    let system_prompt = persona::build_system_prompt(&profile);

    // 6. 加载历史消息
    let history = database
        .get_conversation_messages(&conversation_id)
        .map_err(|e| ChatError {
            code: ChatErrorCode::Unknown,
            message: format!("加载历史消息失败: {}", e),
        })?;

    // 构建 messages 数组
    let mut messages: Vec<ChatMessage> = vec![ChatMessage {
        role: "system".to_string(),
        content: system_prompt,
    }];
    for m in &history {
        // 跳过错误消息和被取消的消息（但保留成功的 user/assistant 消息）
        if m.status == "ok" {
            messages.push(ChatMessage {
                role: m.role.clone(),
                content: m.content.clone(),
            });
        }
    }

    // 7. emit start 事件 + business-state busy
    let _ = app.emit(
        "chat-stream",
        ChatStreamEvent::Start {
            conversation_id: conversation_id.clone(),
            user_message_id: user_msg.id.clone(),
        },
    );
    let _ = app.emit("business-state", serde_json::json!({ "state": "busy" }));

    // 8. 设置 abort
    let (abort_tx, abort_rx) = oneshot::channel::<()>();
    let registry = app.state::<Arc<AbortRegistry>>().inner().clone();
    registry.set(abort_tx).await;

    // 9. 流式调用 DeepSeek
    let app_clone = app.clone();
    let conv_id = conversation_id.clone();
    let result = deepseek::stream_chat_completion(
        &api_key,
        messages,
        move |delta: &str| {
            let _ = app_clone.emit(
                "chat-stream",
                ChatStreamEvent::Delta {
                    conversation_id: conv_id.clone(),
                    delta: delta.to_string(),
                },
            );
        },
        abort_rx,
    )
    .await;

    // 10. 清理 abort
    registry.clear().await;

    // 11. emit business-state idle
    let _ = app.emit("business-state", serde_json::json!({ "state": "idle" }));

    // 12. 处理结果
    match result {
        Ok(full_content) => {
            let assistant_msg = database
                .insert_message(&conversation_id, "assistant", &full_content, "ok", None)
                .map_err(|e| ChatError {
                    code: ChatErrorCode::Unknown,
                    message: format!("保存助手消息失败: {}", e),
                })?;

            let _ = app.emit(
                "chat-stream",
                ChatStreamEvent::Done {
                    conversation_id: conversation_id.clone(),
                    assistant_message_id: assistant_msg.id.clone(),
                    full_content: full_content.clone(),
                },
            );
            Ok(())
        }
        Err(e) => {
            // 保存错误消息
            if e.code != ChatErrorCode::Aborted {
                let _ = database.insert_message(
                    &conversation_id,
                    "assistant",
                    "",
                    "error",
                    Some(&format!("{:?}", e.code)),
                );
            } else {
                // aborted：保存已生成内容为 cancelled
                // 由于我们在 abort 时无法拿到已生成的 full content，这里简化处理
                let _ = database.insert_message(
                    &conversation_id,
                    "assistant",
                    "",
                    "cancelled",
                    None,
                );
            }

            let _ = app.emit(
                "chat-stream",
                ChatStreamEvent::Error {
                    conversation_id: conversation_id.clone(),
                    code: format!("{:?}", e.code),
                    message: e.message.clone(),
                },
            );
            Err(e)
        }
    }
}
