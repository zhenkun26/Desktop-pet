// API Key 加密存储模块（keyring → macOS Keychain）

use keyring::Entry;

const SERVICE_NAME: &str = "com.hutao-desktop-pet.deepseek";
const ACCOUNT_NAME: &str = "default";

pub fn set_api_key(key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("创建 Keychain 条目失败: {}", e))?;
    entry
        .set_password(key)
        .map_err(|e| format!("保存 API Key 失败: {}", e))
}

pub fn get_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("创建 Keychain 条目失败: {}", e))?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取 API Key 失败: {}", e)),
    }
}

pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("创建 Keychain 条目失败: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除 API Key 失败: {}", e)),
    }
}

/// 返回脱敏的 API Key 状态
pub fn get_api_key_status() -> Result<ApiKeyStatus, String> {
    match get_api_key()? {
        Some(key) => {
            let masked = mask_key(&key);
            Ok(ApiKeyStatus { configured: true, masked })
        }
        None => Ok(ApiKeyStatus {
            configured: false,
            masked: "未配置".to_string(),
        }),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub configured: bool,
    pub masked: String,
}

/// 脱敏：前4后4，中间用 **** 代替
fn mask_key(key: &str) -> String {
    let len = key.len();
    if len <= 8 {
        return "****".to_string();
    }
    let prefix = &key[..4];
    let suffix = &key[len - 4..];
    format!("{}****{}", prefix, suffix)
}
