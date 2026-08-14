## ADDED Requirements

### Requirement: 按会话语言约束助手回复

聊天服务 SHALL 在每次开始生成时读取该会话的有效回复语言，并将明确的语言约束加入 system prompt。助手 SHALL 使用所选语言生成主要回复；代码、URL、专有名词和用户明确要求保留的原文可以保持原样。该语言约束不得改变既有消息记录。

#### Scenario: 中文回复

- **WHEN** 会话回复语言为 `zh-CN` 并发送一条消息
- **THEN** 发送给模型的 system prompt 包含中文回复约束，生成结果作为中文回复保存

#### Scenario: 英文回复

- **WHEN** 会话回复语言为 `en-US` 并发送一条消息
- **THEN** 发送给模型的 system prompt 包含 English 回复约束，生成结果作为英文回复保存

#### Scenario: 日文回复

- **WHEN** 会话回复语言为 `ja-JP` 并发送一条消息
- **THEN** 发送给模型的 system prompt 包含日本語回复约束，生成结果作为日文回复保存

#### Scenario: 生成期间语言快照

- **WHEN** 请求开始时会话语言为 `zh-CN`，随后用户切换为 `en-US`
- **THEN** 已开始的请求继续使用 `zh-CN` 的语言约束，后续新请求才使用 `en-US`

#### Scenario: 无效语言保护

- **WHEN** 聊天服务收到无效或缺失的会话语言
- **THEN** 聊天服务按 `zh-CN` 处理并生成中文约束，不向模型传入非法语言标识
