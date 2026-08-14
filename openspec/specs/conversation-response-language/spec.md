# conversation-response-language Specification / 会话回复语言规范

## Purpose

**目的 / Purpose**

为 Desktop-pet 提供可持久化的中文、英文、日文会话回复语言设置，让用户能够在总设置入口选择默认语言，并在会话进行中切换而不改写既有消息。

Provide Desktop-pet with persistent Chinese, English, and Japanese conversation-response language settings, so users can choose a default language in the global settings entry and switch languages during a conversation without rewriting existing messages.

## Requirements

**需求 / Requirements**

### Requirement: 支持的会话回复语言 / Supported Conversation Response Languages

系统 SHALL 支持且仅支持以下三种会话回复语言：`zh-CN`（中文）、`en-US`（English）和 `ja-JP`（日本語）。设置界面 SHALL 使用用户可识别的本地化标签展示这三个选项。

The system SHALL support exactly the following three conversation response languages: `zh-CN` (Chinese), `en-US` (English), and `ja-JP` (Japanese). The settings UI SHALL display these options with recognizable localized labels.

#### Scenario: 展示三种语言 / Display the Three Languages

- **WHEN** 用户打开总设置中的对话语言模块
- **WHEN** the user opens the conversation-language module in global settings
- **THEN** 系统展示中文、English、日本語三个可选项，且不展示未实现的语言
- **THEN** the system displays Chinese, English, and Japanese as the three selectable options, without displaying unsupported languages

#### Scenario: 非法语言值回退 / Fall Back from an Invalid Language Value

- **WHEN** 持久化配置、IPC 请求或数据库记录包含不在允许集合中的语言值
- **WHEN** persisted configuration, an IPC request, or a database record contains a language value outside the allowed set
- **THEN** 系统将该值视为无效并回退为 `zh-CN`，不得把非法值传入模型请求
- **THEN** the system treats the value as invalid and falls back to `zh-CN`; the invalid value MUST NOT be passed to a model request

### Requirement: 默认语言与会话语言 / Default and Conversation Languages

系统 SHALL 持久化一个默认回复语言，用于创建新会话；每个会话 SHALL 保存自己的回复语言。旧版本没有语言字段的配置和会话 SHALL 兼容为 `zh-CN`，不得修改已有消息内容。

The system SHALL persist a default response language for creating new conversations; each conversation SHALL store its own response language. Configuration and conversations from older versions without a language field SHALL be treated as `zh-CN`, and existing message content MUST NOT be modified.

#### Scenario: 新会话继承默认语言 / New Conversations Inherit the Default Language

- **WHEN** 用户将默认回复语言设置为 `en-US` 后创建新会话
- **WHEN** the user sets the default response language to `en-US` and creates a new conversation
- **THEN** 新会话的回复语言为 `en-US`，并在后续消息中生效
- **THEN** the new conversation has `en-US` as its response language, which applies to subsequent messages

#### Scenario: 旧会话兼容 / Backward Compatibility for Existing Conversations

- **WHEN** 系统读取没有回复语言字段的旧会话
- **WHEN** the system reads an older conversation without a response-language field
- **THEN** 系统将其解释为 `zh-CN`，会话消息和会话时间线保持不变
- **THEN** the system interprets it as `zh-CN`, while preserving the conversation messages and timeline

#### Scenario: 不同会话相互隔离 / Isolate Different Conversations

- **WHEN** 用户将当前会话切换为 `ja-JP` 后打开另一个仍为 `en-US` 的会话
- **WHEN** the user switches the current conversation to `ja-JP` and opens another conversation that remains `en-US`
- **THEN** 两个会话分别保留各自语言，切换一个会话不得改变另一个会话
- **THEN** each conversation retains its own language, and switching one conversation MUST NOT change the other

### Requirement: 会话中途切换仅影响后续消息 / Mid-Conversation Switching Affects Only Subsequent Messages

系统 SHALL 允许用户在总设置中的对话语言模块切换当前会话语言。切换 SHALL 不翻译、不重写、不删除既有消息；从切换完成后新发起的消息开始使用新语言。

The system SHALL allow users to switch the current conversation language in the conversation-language module of global settings. Switching SHALL NOT translate, rewrite, or delete existing messages; the new language starts with messages sent after the switch completes.

#### Scenario: 切换后发送新消息 / Send a New Message after Switching

- **WHEN** 当前会话已有中文消息，用户将语言切换为 `ja-JP` 并发送下一条消息
- **WHEN** the current conversation contains Chinese messages, the user switches the language to `ja-JP`, and sends the next message
- **THEN** 已有中文消息保持原样，新的助手回复使用 `ja-JP` 作为目标语言
- **THEN** existing Chinese messages remain unchanged, and the new assistant response uses `ja-JP` as its target language

#### Scenario: 生成进行中切换 / Switch While Generation Is in Progress

- **WHEN** 助手正在生成回复时用户将语言从 `zh-CN` 切换为 `en-US`
- **WHEN** the user switches the language from `zh-CN` to `en-US` while the assistant is generating a response
- **THEN** 当前进行中的请求继续使用开始生成时的语言；切换只对下一次发送生效
- **THEN** the in-progress request continues using the language captured at generation start; the switch applies only to the next send

#### Scenario: 没有当前会话时切换 / Switch without an Active Conversation

- **WHEN** 用户在未打开会话时修改对话语言
- **WHEN** the user changes the conversation language without an open conversation
- **THEN** 系统仅更新新会话的默认语言，不创建空会话或修改历史会话
- **THEN** the system updates only the default language for new conversations, without creating an empty conversation or modifying historical conversations
