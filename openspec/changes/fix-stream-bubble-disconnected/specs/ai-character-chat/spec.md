## ADDED Requirements

### Requirement: 流式气泡 DOM 韧性

流式气泡 SHALL 存在于独立的 `#stream-container` DOM 容器中，与消息历史列表 `#message-list` 分离。系统 MUST 确保 `renderMessages()` 等消息区重渲染操作不触及 `#stream-container`，从而使流式气泡在消息历史重建时不被摧毁。流式结束后系统 SHALL 清空 `#stream-container` 并通过常规消息渲染路径展示 Markdown 全文。

#### Scenario: 消息区重渲染不摧毁流式气泡

- **WHEN** 流式进行中（`state.streaming === true`），`renderMessages()` 被调用
- **THEN** `#message-list` 的 innerHTML 被更新，但 `#stream-container` 及其子节点不受影响
- **AND** 流式气泡继续正常接收 delta 并追加文本

#### Scenario: 流式结束后清理容器

- **WHEN** 收到 `done` 或 `error` 事件
- **THEN** 系统清空 `#stream-container` 的内容
- **AND** 完整的 assistant 消息通过 `renderMessages()` 渲染到 `#message-list` 中展示 Markdown 全文

#### Scenario: 发送新消息时清理旧容器

- **WHEN** 用户发送新消息
- **THEN** 系统清空 `#stream-container` 并创建新的思考气泡
- **AND** 旧的流式气泡状态被完全重置

### Requirement: invoke 异常时 UI 兜底恢复

`sendMessage()` 的 catch 分支 SHALL 无条件恢复 UI 状态（移除原来永远为 false 的 `!state.streaming` 条件）。当 `api.sendChatMessage()` 的 invoke 意外失败时，系统 MUST 将发送按钮从"停止"恢复为"发送"，并重置 `state.streaming`。

#### Scenario: invoke 通信异常恢复 UI

- **WHEN** `api.sendChatMessage()` 的 invoke 调用因 IPC 通信异常而抛出错误
- **THEN** 系统将 `state.streaming` 设为 `false`
- **AND** 发送按钮从"■ 停止"恢复为"➤ 发送"
- **AND** header 状态从"思考中…"恢复为正常状态
