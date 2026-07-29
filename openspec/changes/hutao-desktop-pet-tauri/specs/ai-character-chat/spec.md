## Purpose

提供基于 DeepSeek 的角色对话能力，让胡桃桌宠以原神往生堂堂主的人设与用户进行流式对话，支持用户自定义称呼/关系/性格/语气，API Key 加密存储于系统钥匙串，对话历史持久化到本地 SQLite。

## ADDED Requirements

### Requirement: 胡桃角色人设

系统 SHALL 内置胡桃（原神）的角色设定，作为 AI 对话的 system prompt 基础。人设 MUST 包含 `coreIdentity`（核心身份：往生堂第七十七任堂主、古灵精怪、爱开玩笑、纠正"晦气"误解、与旅行者关系亲密）和 `speechStyle`（语气风格：自称"本堂主"或"胡桃"、称呼用户"旅行者"、常用"哎嘿""嘿嘿""哎呀呀"、偶尔用动作描写如 *叉着腰*）。系统 MUST 将此人设与用户可配置的字段合并生成最终 system prompt。

#### Scenario: 默认人设加载

- **WHEN** 用户首次打开角色设定视图且未配置任何字段
- **THEN** 系统显示默认值：称呼="旅行者"、关系="老朋友"、性格="mischievous"、语气="playful"
- **AND** 这些默认值与胡桃 coreIdentity 合成 system prompt

#### Scenario: 人设不可被用户清空 coreIdentity

- **WHEN** 用户编辑角色设定字段
- **THEN** `coreIdentity` 和 `speechStyle` 不可被用户修改（系统内置）
- **AND** 用户只能修改 `userCallName / relationship / personalityBias / tonePreference / extraNotes` 五个字段

### Requirement: 用户可配置角色字段

系统 SHALL 允许用户配置五个角色字段：`userCallName`（称呼，≤32 字符）、`relationship`（关系，≤64 字符）、`personalityBias`（性格倾向，枚举：caring/mischievous/shy/confident/sleepy）、`tonePreference`（语气偏好，枚举：gentle/energetic/tsundere/soft/playful）、`extraNotes`（额外备注，≤500 字符）。系统 MUST 对输入做长度截断和枚举值校验，非法枚举值回退到默认。

#### Scenario: 保存角色设定

- **WHEN** 用户在角色设定视图修改字段并点击保存
- **THEN** 系统对字段做 sanitize（trim + 截断 + 枚举校验）
- **AND** 持久化到 chat.db 的 persona 表，带 `updatedAt` 时间戳
- **AND** 后续对话使用新人设生成 system prompt

#### Scenario: 非法枚举值兜底

- **WHEN** 用户提交的 `personalityBias` 不在允许枚举内
- **THEN** 系统回退到默认值 `mischievous`
- **AND** 不报错，静默修正

### Requirement: DeepSeek 流式对话

系统 SHALL 通过 DeepSeek API（模型 `deepseek-v4-flash`，非思考模式，`stream: true`）实现流式对话。请求 MUST 以 Bearer token 形式携带 API Key（不在 body 中明文传输）。系统 MUST 解析 SSE 流的 `delta.content` 增量并通过事件总线实时推送给前端。流式过程中发生网络错误、内容过滤、配额超限时 MUST 生成对应的错误事件。

#### Scenario: 正常流式回复

- **WHEN** 用户发送一条消息
- **THEN** 系统先返回 `start` 事件（含 conversationId、userMessageId、assistantMessageId）
- **AND** 逐 token 返回 `delta` 事件
- **AND** 流结束后返回 `done` 事件（含完整 assistant 消息内容）
- **AND** 用户消息和 assistant 消息都持久化到 chat.db

#### Scenario: API Key 缺失

- **WHEN** 用户发送消息但未配置 API Key
- **THEN** 系统返回错误事件，code = `missing_api_key`
- **AND** 不发起 HTTP 请求

#### Scenario: API Key 无效

- **WHEN** DeepSeek 返回 401
- **THEN** 系统返回错误事件，code = `invalid_api_key`
- **AND** 不再重试

#### Scenario: 用户主动停止生成

- **WHEN** 用户在流式回复过程中点击"停止"
- **THEN** 系统中止 HTTP 请求
- **AND** 返回 `cancelled` 事件
- **AND** 已生成的部分内容保留为一条 status=`cancelled` 的 assistant 消息

### Requirement: API Key 加密存储

系统 SHALL 使用 macOS Keychain（通过 `keyring` crate）存储 DeepSeek API Key，禁止明文落盘。系统 MUST 支持设置、修改、删除、查询 API Key 状态（是否已配置 + 脱敏显示如 `sk-***...***abcd`）。系统 MUST 支持在线测试 API Key 有效性（发起一次最小请求）。

#### Scenario: 首次设置 API Key

- **WHEN** 用户在 API 设置视图输入 API Key 并保存
- **THEN** 系统将 Key 写入 macOS Keychain
- **AND** 返回脱敏状态（configured=true、masked="sk-***...***abcd"）

#### Scenario: 修改 API Key

- **WHEN** 用户在已配置状态下输入新 Key 并保存
- **THEN** 系统覆盖 Keychain 中的旧 Key
- **AND** 后续对话使用新 Key

#### Scenario: 删除 API Key

- **WHEN** 用户点击"删除 API Key"
- **THEN** 系统从 Keychain 删除 Key
- **AND** 返回 configured=false

#### Scenario: 在线测试 API Key

- **WHEN** 用户点击"测试连接"
- **THEN** 系统用当前 Key 发起一次最小 DeepSeek 请求
- **AND** 返回 {ok: true, message: "连接成功"} 或 {ok: false, message: 错误详情}

### Requirement: 多会话聊天历史

系统 SHALL 使用 SQLite（chat.db）持久化对话历史，按会话（conversation）组织。每个会话属于固定角色（hutao），包含标题、创建时间、更新时间、最后消息预览。消息记录 MUST 包含 role（user/assistant/system）、content、createdAt、status（complete/streaming/error/cancelled）、errorCode（可选）。系统 SHALL 支持创建、重命名、删除会话，以及列出会话和获取会话消息。

#### Scenario: 创建新会话

- **WHEN** 用户点击"新建会话"
- **THEN** 系统创建一条 conversation 记录（petId=hutao、title="新对话"、createdAt=now）
- **AND** 返回会话对象

#### Scenario: 会话标题自动更新

- **WHEN** 会话中产生第一条用户消息
- **THEN** 系统将消息前 20 字符作为会话标题（若原标题为"新对话"）
- **AND** 更新 lastMessagePreview

#### Scenario: 删除会话级联

- **WHEN** 用户删除某个会话
- **THEN** 系统删除该会话及其所有消息记录
- **AND** 不影响其他会话

#### Scenario: 应用重启后恢复历史

- **WHEN** 应用重启后用户打开聊天窗口
- **THEN** 系统列出该角色的所有历史会话
- **AND** 选择某个会话可加载其全部消息
