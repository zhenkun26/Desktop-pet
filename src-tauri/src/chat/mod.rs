// 聊天模块入口
pub mod db;
pub mod deepseek;
pub mod persona;
pub mod secrets;
pub mod service;

pub use service::{AbortRegistry, ChatStreamEvent, SendChatInput};
