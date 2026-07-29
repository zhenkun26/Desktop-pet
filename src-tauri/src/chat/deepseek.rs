// DeepSeek API 客户端模块

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

use super::persona::DEEPSEEK_MODEL;

const DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ChatErrorCode {
    MissingApiKey,
    InvalidApiKey,
    RateLimited,
    Network,
    ContentFilter,
    Aborted,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatError {
    pub code: ChatErrorCode,
    pub message: String,
}

impl std::fmt::Display for ChatError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl Error for ChatError {}

/// 构建请求 body
fn build_body(messages: &[ChatMessage]) -> serde_json::Value {
    serde_json::json!({
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "stream": true,
        "thinking": { "type": "disabled" }
    })
}

/// 流式聊天补全
///
/// 返回完整回复文本，通过 on_delta 回调实时推送增量
pub async fn stream_chat_completion(
    api_key: &str,
    messages: Vec<ChatMessage>,
    on_delta: impl Fn(&str) + Send + 'static,
    abort: tokio::sync::oneshot::Receiver<()>,
) -> Result<String, ChatError> {
    let client = Client::new();
    let body = build_body(&messages);

    let response = client
        .post(format!("{}/chat/completions", DEEPSEEK_BASE_URL))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() || e.is_connect() {
                ChatError {
                    code: ChatErrorCode::Network,
                    message: "网络连接失败，请检查网络后重试".to_string(),
                }
            } else {
                ChatError {
                    code: ChatErrorCode::Network,
                    message: format!("请求失败: {}", e),
                }
            }
        })?;

    let status = response.status();
    if !status.is_success() {
        let body_text = response.text().await.unwrap_or_default();
        return Err(map_http_error(status.as_u16(), &body_text));
    }

    // SSE 流解析
    let mut full = String::new();
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    // 创建 abort future
    tokio::pin!(abort);

    loop {
        tokio::select! {
            _ = &mut abort => {
                return Err(ChatError {
                    code: ChatErrorCode::Aborted,
                    message: "已停止生成".to_string(),
                });
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        // 按行处理 SSE
                        while let Some(newline_pos) = buffer.find('\n') {
                            let line = buffer[..newline_pos].trim().to_string();
                            buffer = buffer[newline_pos + 1..].to_string();

                            if line.is_empty() || line.starts_with(':') {
                                continue;
                            }
                            if let Some(json_str) = line.strip_prefix("data: ") {
                                if json_str.trim() == "[DONE]" {
                                    return Ok(full);
                                }
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                                    if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                        if !content.is_empty() {
                                            full.push_str(content);
                                            on_delta(content);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        return Err(ChatError {
                            code: ChatErrorCode::Network,
                            message: format!("读取回复时中断: {}", e),
                        });
                    }
                    None => {
                        // 流结束，处理 buffer 中剩余内容
                        if !buffer.is_empty() {
                            if let Some(json_str) = buffer.trim().strip_prefix("data: ") {
                                if json_str.trim() != "[DONE]" {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                                        if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                            if !content.is_empty() {
                                                full.push_str(content);
                                                on_delta(content);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return Ok(full);
                    }
                }
            }
        }
    }
}

fn map_http_error(status: u16, body_text: &str) -> ChatError {
    match status {
        401 | 403 => ChatError {
            code: ChatErrorCode::InvalidApiKey,
            message: "API Key 无效或已失效，请重新配置".to_string(),
        },
        429 => ChatError {
            code: ChatErrorCode::RateLimited,
            message: "请求过于频繁，请稍后再试".to_string(),
        },
        _ if body_text.contains("content_filter") => ChatError {
            code: ChatErrorCode::ContentFilter,
            message: "回复被内容安全策略过滤".to_string(),
        },
        _ => ChatError {
            code: ChatErrorCode::Unknown,
            message: format!("DeepSeek 请求失败（{}）", status),
        },
    }
}

/// 测试 API Key 连通性
pub async fn test_api_key(api_key: &str) -> Result<(bool, String), ChatError> {
    let client = Client::new();
    let body = serde_json::json!({
        "model": DEEPSEEK_MODEL,
        "messages": [{"role": "user", "content": "ping"}],
        "stream": false,
        "thinking": { "type": "disabled" },
        "max_tokens": 1
    });

    let response = client
        .post(format!("{}/chat/completions", DEEPSEEK_BASE_URL))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|_| ChatError {
            code: ChatErrorCode::Network,
            message: "网络连接失败，请检查网络后重试".to_string(),
        })?;

    if response.status().is_success() {
        Ok((true, "连接成功".to_string()))
    } else {
        let status = response.status().as_u16();
        let body_text = response.text().await.unwrap_or_default();
        let err = map_http_error(status, &body_text);
        Ok((false, err.message))
    }
}
