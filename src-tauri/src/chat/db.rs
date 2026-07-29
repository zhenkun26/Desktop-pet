// 聊天历史数据库模块（rusqlite）

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub pet_id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_message_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub created_at: i64,
    pub status: String, // "ok" | "cancelled" | "error"
    pub error_code: Option<String>,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                pet_id TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '新对话',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                last_message_preview TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_conversations_pet ON conversations(pet_id);

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'ok',
                error_code TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

            CREATE TABLE IF NOT EXISTS personas (
                pet_id TEXT PRIMARY KEY,
                fields_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn list_conversations(&self, pet_id: &str) -> Result<Vec<Conversation>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, pet_id, title, created_at, updated_at, last_message_preview
             FROM conversations WHERE pet_id = ? ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([pet_id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                pet_id: row.get(1)?,
                title: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                last_message_preview: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_conversation(
        &self,
        pet_id: &str,
        title: Option<&str>,
    ) -> Result<Conversation, rusqlite::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let title = title.unwrap_or("新对话");
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO conversations (id, pet_id, title, created_at, updated_at, last_message_preview)
             VALUES (?, ?, ?, ?, ?, '')",
            rusqlite::params![id, pet_id, title, now, now],
        )?;
        Ok(Conversation {
            id,
            pet_id: pet_id.to_string(),
            title: title.to_string(),
            created_at: now,
            updated_at: now,
            last_message_preview: "".to_string(),
        })
    }

    pub fn rename_conversation(
        &self,
        id: &str,
        title: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![title, now, id],
        )?;
        Ok(())
    }

    pub fn delete_conversation(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        // 级联删消息（SQLite 默认未开启外键级联，手动删）
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", [id])?;
        conn.execute("DELETE FROM conversations WHERE id = ?", [id])?;
        Ok(())
    }

    pub fn get_conversation_messages(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<Message>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, created_at, status, error_code
             FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                status: row.get(5)?,
                error_code: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn insert_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
        status: &str,
        error_code: Option<&str>,
    ) -> Result<Message, rusqlite::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at, status, error_code)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![id, conversation_id, role, content, now, status, error_code],
        )?;
        // 更新会话的 updated_at 和 last_message_preview
        let preview: String = content.chars().take(50).collect();
        conn.execute(
            "UPDATE conversations SET updated_at = ?, last_message_preview = ? WHERE id = ?",
            rusqlite::params![now, preview, conversation_id],
        )?;
        Ok(Message {
            id,
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            created_at: now,
            status: status.to_string(),
            error_code: error_code.map(|s| s.to_string()),
        })
    }

    pub fn update_conversation_title_if_default(
        &self,
        conversation_id: &str,
        first_message: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        // 检查当前标题是否为默认值
        let current_title: String = conn
            .query_row(
                "SELECT title FROM conversations WHERE id = ?",
                [conversation_id],
                |row| row.get(0),
            )
            .unwrap_or_default();

        if current_title == "新对话" || current_title.is_empty() {
            let new_title: String = first_message.chars().take(20).collect();
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                rusqlite::params![new_title, now, conversation_id],
            )?;
        }
        Ok(())
    }

    pub fn get_persona(&self, pet_id: &str) -> Result<Option<String>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT fields_json FROM personas WHERE pet_id = ?",
            [pet_id],
            |row| row.get(0),
        );
        match result {
            Ok(json) => Ok(Some(json)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn save_persona(
        &self,
        pet_id: &str,
        fields_json: &str,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO personas (pet_id, fields_json, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(pet_id) DO UPDATE SET fields_json = excluded.fields_json, updated_at = excluded.updated_at",
            rusqlite::params![pet_id, fields_json, now],
        )?;
        Ok(())
    }
}

/// 获取数据库实例
pub fn get_db(app: &AppHandle) -> Option<std::sync::Arc<Database>> {
    app.state::<std::sync::Arc<Database>>().inner().clone().into()
}
