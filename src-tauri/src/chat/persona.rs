// 胡桃角色人设模块

use serde::{Deserialize, Serialize};

/// 胡桃核心身份设定
pub const HUTAO_CORE_IDENTITY: &str = "你是胡桃，璃月往生堂第七十七任堂主。你自称「本堂主」，性格古灵精怪、爱开玩笑，常把生死挂在嘴边却并不让人害怕。你最讨厌别人把往生堂和「晦气」联系在一起，会认真纠正。你和旅行者（用户）关系很好，喜欢突然出现在他身边。";

/// 胡桃说话风格
pub const HUTAO_SPEECH_STYLE: &str = "语气俏皮跳脱，自称「本堂主」或「胡桃」，称呼用户为「旅行者」。常用「哎嘿」「嘿嘿」「哎呀呀」等语气词。喜欢用顺口溜打趣。偶尔用 *叉着腰* / *凑近了看* 这样的动作描写。";

/// DeepSeek 模型名
pub const DEEPSEEK_MODEL: &str = "deepseek-v4-flash";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonaProfileFields {
    pub user_call_name: String,
    pub relationship: String,
    pub personality_bias: String,
    pub tone_preference: String,
    pub extra_notes: String,
}

impl Default for PersonaProfileFields {
    fn default() -> Self {
        Self {
            user_call_name: "旅行者".to_string(),
            relationship: "老朋友".to_string(),
            personality_bias: "mischievous".to_string(),
            tone_preference: "playful".to_string(),
            extra_notes: "".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonaProfile {
    pub pet_id: String,
    #[serde(flatten)]
    pub fields: PersonaProfileFields,
    pub updated_at: i64,
}

/// 性格偏向枚举
pub fn valid_personalities() -> &'static [&'static str] {
    &["caring", "mischievous", "shy", "confident", "sleepy"]
}

/// 语气偏好枚举
pub fn valid_tones() -> &'static [&'static str] {
    &["gentle", "energetic", "tsundere", "soft", "playful"]
}

/// 清洗并校验人设字段
pub fn sanitize_persona_fields(fields: PersonaProfileFields) -> PersonaProfileFields {
    let clamp = |s: &str, max: usize, fallback: &str| -> String {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            return fallback.to_string();
        }
        if trimmed.len() > max {
            trimmed[..max].to_string()
        } else {
            trimmed.to_string()
        }
    };

    let defaults = PersonaProfileFields::default();

    let personality = if valid_personalities().contains(&fields.personality_bias.as_str()) {
        fields.personality_bias
    } else {
        defaults.personality_bias
    };

    let tone = if valid_tones().contains(&fields.tone_preference.as_str()) {
        fields.tone_preference
    } else {
        defaults.tone_preference
    };

    PersonaProfileFields {
        user_call_name: clamp(&fields.user_call_name, 32, &defaults.user_call_name),
        relationship: clamp(&fields.relationship, 64, &defaults.relationship),
        personality_bias: personality,
        tone_preference: tone,
        extra_notes: clamp(&fields.extra_notes, 500, ""),
    }
}

/// 合并默认值与用户覆盖值
pub fn merge_persona_profile(
    pet_id: &str,
    overrides: Option<PersonaProfileFields>,
    updated_at: i64,
) -> PersonaProfile {
    let defaults = PersonaProfileFields::default();
    let fields = match overrides {
        Some(o) => PersonaProfileFields {
            user_call_name: if o.user_call_name.is_empty() {
                defaults.user_call_name
            } else {
                o.user_call_name
            },
            relationship: if o.relationship.is_empty() {
                defaults.relationship
            } else {
                o.relationship
            },
            personality_bias: if o.personality_bias.is_empty() {
                defaults.personality_bias
            } else {
                o.personality_bias
            },
            tone_preference: if o.tone_preference.is_empty() {
                defaults.tone_preference
            } else {
                o.tone_preference
            },
            extra_notes: o.extra_notes,
        },
        None => defaults,
    };

    PersonaProfile {
        pet_id: pet_id.to_string(),
        fields,
        updated_at,
    }
}

/// 构建 system prompt
pub fn build_system_prompt(profile: &PersonaProfile) -> String {
    let f = &profile.fields;
    let personality_desc = match f.personality_bias.as_str() {
        "caring" => "体贴温柔",
        "mischievous" => "古灵精怪",
        "shy" => "害羞内敛",
        "confident" => "自信开朗",
        "sleepy" => "软软困困",
        _ => "古灵精怪",
    };

    let tone_desc = match f.tone_preference.as_str() {
        "gentle" => "温柔",
        "energetic" => "元气",
        "tsundere" => "傲娇",
        "soft" => "软糯",
        "playful" => "俏皮",
        _ => "俏皮",
    };

    let mut prompt = String::new();
    prompt.push_str(HUTAO_CORE_IDENTITY);
    prompt.push_str("\n\n");
    prompt.push_str(HUTAO_SPEECH_STYLE);
    prompt.push_str("\n\n");
    prompt.push_str(&format!("## 用户关系\n"));
    prompt.push_str(&format!("- 你称呼用户为「{}」\n", f.user_call_name));
    prompt.push_str(&format!("- 你们的关系：{}\n", f.relationship));
    prompt.push_str(&format!("- 性格偏向：{}\n", personality_desc));
    prompt.push_str(&format!("- 语气偏好：{}\n", tone_desc));

    if !f.extra_notes.is_empty() {
        prompt.push_str(&format!("\n## 额外备注\n{}\n", f.extra_notes));
    }

    prompt.push_str("\n## 回复要求\n");
    prompt.push_str("- 保持角色设定，用胡桃的语气回复\n");
    prompt.push_str("- 回复简洁自然，不要过长\n");
    prompt.push_str("- 不要透露你是 AI 或语言模型\n");

    prompt
}
