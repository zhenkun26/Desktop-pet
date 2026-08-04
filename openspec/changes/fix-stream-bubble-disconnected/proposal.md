## Why

用户发送消息后，对话框中的思考气泡（胡桃头像 + 红色轮播文案 + 灰色计时）一闪而过后消失，后续流式输出无任何 DOM 更新，UI 像卡死一样。实际上后端流式事件正常到达、消息已存入数据库——切换会话再回来就能看到完整输出。根因是 `renderMessages()` 使用 `innerHTML = ""` 清空消息区时误伤了紧耦合的流式气泡 DOM 节点，恢复逻辑在 `streamBubbleReady` 状态不一致时会创建错误类型的气泡（思考→流式切换时重建为思考气泡），导致已累积文本丢失。另外 `sendMessage()` 的 catch 兜底条件 `!state.streaming` 永远为 false（上文刚设为 true），使 invoke 异常时 UI 永久卡死。

> **实施状态说明（2026-08-04）**：该修复的等价设计已随 `refactor-tauri-to-electron` 的 Electron 重构落地——`src/renderer/chat.ts` 以独立 `#stream-container` 承载流式气泡，`renderMessages()` 仅管理 `#message-list`，`sendMessage()` catch 无条件恢复 UI。本文档中 `src/chat/*` 路径为旧 Tauri 代码库的历史描述，验证任务见 tasks.md（按 Electron 构建执行）。

## What Changes

- **流式气泡 DOM 解耦**：在 `message-area` 内新增独立的 `#stream-container` 容器，流式气泡只操作该容器，不受 `renderMessages()` 清空消息历史的影响
- **`renderMessages()` 精细化**：不再用 `innerHTML = ""` 全局清空，改为仅管理消息列表（`#message-list`），流式容器完全不受波及
- **修复 catch 兜底**：`sendMessage()` 的 catch 中移除永远为 false 的条件，确保 invoke 异常时也能恢复 UI 状态
- **移除脆弱的"恢复重建"逻辑**：`appendStreamDelta` 中的 `isConnected` 检测和自动重建不再需要（解耦后气泡永不断开），简化代码
- **移除 `renderMessages()` 中的流式气泡重建逻辑**：原来 359-363 行的 guard 不再需要

## Capabilities

### New Capabilities
<!-- 纯 bug 修复，无新增 capability -->

### Modified Capabilities
- `ai-character-chat`: 流式气泡渲染要求从"追加到 message-area"细化为"使用独立 DOM 容器 `#stream-container`，不受消息历史重渲染影响"。思考气泡在发送后立即可见并持续到首个 delta 到达，期间轮播红色文案 + 灰色计时。流式输出结束后容器清理，消息通过常规渲染路径展示 Markdown 全文。

## Impact

- **修改文件**：`src/chat/main.ts`（HTML 布局 + 流式气泡管理 + renderMessages 重构）、`src/chat/style.css`（可能需要微调 `#stream-container` 样式）
- **不影响**：Rust 后端、桌宠窗口、API 层、计时器模块
- **风险**：低。改动局限在前端聊天窗口的 DOM 管理，不涉及后端或 IPC 协议
