## 背景 / Context

当前设置数据写入 `config.json`，会话数据写入 SQLite `conversations` 表；聊天服务在发送时读取会话、人设和最近消息后构建 system prompt。`SendChatMessageInput` 目前只携带会话 ID 和用户文本，DeepSeek/SSE 客户端不需要为本变更增加新的网络协议。

Settings data is currently written to `config.json`, while conversation data is stored in the SQLite `conversations` table. When sending, the chat service reads the conversation, persona, and recent messages to build the system prompt. `SendChatMessageInput` currently carries only the conversation ID and user text, so this change does not require a new network protocol for the DeepSeek/SSE client.

## 目标 / 非目标 / Goals / Non-Goals

**目标 / Goals:**

- 在现有总设置入口提供中文、英文、日文三个回复语言选项。 / Provide Chinese, English, and Japanese response-language options in the existing global settings entry.
- 同时维护“新会话默认语言”和“当前会话语言”，保证旧会话与不同会话相互隔离。 / Maintain both the “new conversation default language” and the “current conversation language,” keeping legacy and separate conversations isolated.
- 在主进程发送请求时对语言做最终校验并快照，保证生成期间切换只影响下一条消息。 / Validate and snapshot the language at the main-process send boundary so a switch during generation affects only the next message.
- 以可回滚、幂等的 SQLite 增量迁移兼容已有用户数据。 / Preserve existing user data through a reversible, idempotent SQLite incremental migration.

**非目标 / Non-Goals:**

- 不翻译已有消息、用户输入、Markdown 内容或角色资料。 / Do not translate existing messages, user input, Markdown content, or character profiles.
- 不修改 DeepSeek API、模型选择、SSE 协议或 API Key 存储方式。 / Do not modify the DeepSeek API, model selection, SSE protocol, or API-key storage method.
- 不引入 translate.js、第三方翻译服务、离线模型或完整 UI 国际化。 / Do not introduce translate.js, third-party translation services, offline models, or full UI internationalization.

## 决策 / Decisions

### 1. 语言同时存在于全局默认配置和会话记录 / Store Language in Both Global Defaults and Conversation Records

新增 `ChatLanguage = 'zh-CN' | 'en-US' | 'ja-JP'`。`config.json` 增加 `defaultResponseLanguage`，用于新会话；`conversations` 增加 `response_language`，用于已有会话。

Add `ChatLanguage = 'zh-CN' | 'en-US' | 'ja-JP'`. Add `defaultResponseLanguage` to `config.json` for new conversations and `response_language` to `conversations` for existing conversations.

设置页有当前会话时，修改操作同时更新该会话；没有当前会话时，只更新默认值。这样既满足“总设置界面”入口，又保证不同会话可以使用不同语言。

When a conversation is active, settings changes update that conversation; without an active conversation, they update only the default. This provides a global-settings entry while allowing different conversations to use different languages.

备选方案是只存全局语言，但会导致打开旧会话时语言随全局设置漂移；不采用。

The alternative of storing only a global language would make an old conversation's language drift with the global setting, so it is not adopted.

### 2. 语言在主进程发送边界快照 / Snapshot Language at the Main-Process Send Boundary

聊天服务在开始生成时读取并规范化会话语言，然后把快照传给 `buildSystemPrompt`。生成期间的设置变化只更新数据库，不修改当前请求已构建的 prompt。

At generation start, the chat service reads and normalizes the conversation language, then passes the snapshot to `buildSystemPrompt`. Settings changes during generation update only the database and do not modify the prompt already built for the current request.

备选方案是把语言随每次 renderer 请求传入；这允许 renderer 绕过会话状态，也容易造成流式生成中途语义变化，不采用。

The alternative of passing the language with every renderer request would let the renderer bypass conversation state and could change semantics mid-stream, so it is not adopted.

### 3. 使用结构化语言指令，不做文本翻译 / Use Structured Language Instructions Instead of Text Translation

提示词为每种语言提供固定的回复约束，并明确代码、URL、专有名词和用户引用原文的保留规则。既有聊天记录继续按原文保存和展示。

The prompt provides fixed response constraints for each language and explicitly defines preservation rules for code, URLs, proper nouns, and quoted user text. Existing chat history continues to be stored and displayed verbatim.

备选方案是引入翻译接口或 DOM 翻译；这会扩大数据外发和 Electron 供应链边界，与本 change 不接入翻译服务的目标冲突，不采用。

The alternative of adding a translation API or DOM translation would expand data egress and the Electron supply-chain boundary, conflicting with this change's goal of using no translation service, so it is not adopted.

### 4. 使用幂等增量迁移 / Use an Idempotent Incremental Migration

启动数据库时通过 `PRAGMA table_info(conversations)` 检查 `response_language` 是否存在；缺失时在事务中执行带 `DEFAULT 'zh-CN'` 的 `ALTER TABLE`。读取时仍对空值或非法值做 `zh-CN` 回退，迁移不得改写 `messages` 表。

At database startup, use `PRAGMA table_info(conversations)` to check whether `response_language` exists. If it is missing, run an `ALTER TABLE` with `DEFAULT 'zh-CN'` inside a transaction. Reads still fall back to `zh-CN` for null or invalid values, and the migration MUST NOT rewrite the `messages` table.

如果迁移失败，必须记录可诊断错误并阻止语言字段被当作已迁移成功，避免出现静默的部分状态；恢复方式是保留原数据库并重试同一幂等迁移。

If migration fails, the system MUST record a diagnosable error and MUST NOT treat the language field as successfully migrated, avoiding silent partial state. Recovery preserves the original database and retries the same idempotent migration.

### 5. 设置页只增加功能卡片，不重做 UI 国际化 / Add a Feature Card without Redesigning UI Internationalization

在现有 API 设置所在的总设置入口增加“对话语言”卡片和三项选择，保留现有中文 UI 文案。完整的界面语言包属于后续独立 change。

Add a “Conversation Language” card with three choices to the global settings entry that already contains API settings, while retaining the existing Chinese UI copy. A complete UI language pack belongs in a separate future change.

## 风险与权衡 / Risks / Trade-offs

- **模型不严格遵守语言** → 使用固定语言指令，增加三语 prompt 单测和人工冒烟矩阵；本 change 不承诺语言检测或自动重试。 / **The model may not strictly follow the language** → use fixed language instructions and add three-language prompt unit tests plus a manual smoke matrix; this change does not promise language detection or automatic retries.
- **旧数据库缺少新列** → 启动时执行幂等迁移，默认中文，不修改历史消息。 / **Legacy databases lack the new column** → run an idempotent startup migration, default to Chinese, and leave historical messages unchanged.
- **设置变化与流式生成竞争** → 在生成开始时复制语言快照，更新操作不触碰活动 AbortController 或流式消息。 / **Settings changes race with streaming generation** → copy the language snapshot at generation start; updates do not touch the active AbortController or streaming message.
- **会话与默认值语义混淆** → 设置页明确显示“新会话默认语言”和“当前会话语言”，无当前会话时只更新默认值。 / **Conversation and default semantics may be confused** → clearly show “new conversation default language” and “current conversation language” in settings; without an active conversation, update only the default.
- **后续扩展更多语言成本** → 语言枚举、标签和 prompt 约束集中定义，避免把语言字符串散落在 renderer 和 service 中。 / **The cost of adding more languages later** → centralize the language enum, labels, and prompt constraints instead of scattering language strings across the renderer and service.
