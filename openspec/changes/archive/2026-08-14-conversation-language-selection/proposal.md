## 为什么 / Why

Desktop-pet 当前的角色对话默认使用中文，用户无法在会话开始前选择希望胡桃使用的语言，也无法在对话过程中切换后续回复语言。需要提供中文、英文、日文三种可验证的会话级语言设置，同时保持现有 DeepSeek 调用链，不引入 translate.js 或额外翻译接口。

Desktop-pet currently defaults character conversations to Chinese, so users cannot choose Hu Tao's response language before a conversation or switch the language of subsequent replies during a conversation. We need verifiable conversation-level settings for Chinese, English, and Japanese while preserving the existing DeepSeek call chain and introducing neither translate.js nor an additional translation API.

## 变更内容 / What Changes

- 在总设置入口增加“对话语言”设置模块，提供中文、English、日本語三项选择。 / Add a “Conversation Language” module to global settings with Chinese, English, and Japanese options.
- 新建会话时使用当前默认语言；会话保存自身的回复语言设置。 / Use the current default language for new conversations; each conversation stores its own response-language setting.
- 用户在对话中切换语言时，只更新后续消息使用的语言，不修改既有消息内容或历史记录。 / When the user switches language during a conversation, update only the language for subsequent messages without changing existing message content or history.
- 将已验证的语言标识传入 system prompt，约束助手使用所选语言回复；代码、URL、专有名词和用户明确引用的原文按规则保留。 / Pass the validated language identifier into the system prompt so the assistant replies in the selected language while preserving code, URLs, proper nouns, and explicitly quoted user text according to the rules.
- 对旧会话提供兼容默认值（中文），不要求用户迁移或重写历史消息。 / Provide a backward-compatible default (Chinese) for old conversations without requiring migration or rewriting of historical messages.
- 增加语言枚举、持久化、IPC、提示词和渲染层的自动化测试。 / Add automated tests for the language enum, persistence, IPC, prompts, and renderer behavior.
- **不引入** translate.js、第三方翻译服务或新的网络接口；**不实现**离线大模型和完整界面国际化。 / **Do not introduce** translate.js, third-party translation services, or new network interfaces; **do not implement** offline models or full UI internationalization.

## 能力 / Capabilities

### 新增能力 / New Capabilities

- `conversation-response-language`: 管理三种会话回复语言、默认语言、会话级持久化以及中途切换仅影响后续消息的行为。 / `conversation-response-language`: Manage the three conversation response languages, the default language, conversation-level persistence, and the behavior that mid-conversation switches affect only subsequent messages.

### 修改能力 / Modified Capabilities

- `ai-character-chat`: system prompt 必须包含经过校验的会话回复语言约束，并在每条后续消息生成时读取当前会话语言；既有消息内容不得被自动翻译或改写。 / `ai-character-chat`: The system prompt MUST include the validated conversation response-language constraint, and each subsequent message generation MUST read the current conversation language; existing message content MUST NOT be automatically translated or rewritten.

## 影响范围 / Impact

- 共享类型与 preload IPC：新增语言枚举、设置读写及会话语言字段。 / Shared types and preload IPC: add the language enum, settings read/write operations, and conversation-language fields.
- Electron 主进程设置存储和 SQLite `conversations` 表：增加语言字段并为旧数据提供中文默认值。 / Electron main-process settings storage and the SQLite `conversations` table: add the language field and provide a Chinese default for legacy data.
- 聊天窗口设置模块、会话创建/切换流程和语言选择控件。 / Chat-window settings, conversation creation/switching flows, and the language selector control.
- `prompt-builder` 与 `chat-service`：使用会话语言构建提示词，保持现有 DeepSeek/SSE 接口不变。 / `prompt-builder` and `chat-service`: build prompts from the conversation language while preserving the existing DeepSeek/SSE interface.
- 单元测试、OpenSpec 契约和数据库兼容性验证；不新增依赖或外部服务。 / Unit tests, OpenSpec contracts, and database-compatibility verification; no new dependencies or external services.
