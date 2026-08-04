> 实施状态说明：下述 1.1–4.1 的 DOM 解耦修复已随 Electron 重构（`refactor-tauri-to-electron`）在 `src/renderer/chat.ts` 中以等价设计落地；5.x 为对新构建的验证任务，原 `cargo tauri dev` 改为 `npm run dev`。

## 1. DOM 重构：新增 `#message-list` 和 `#stream-container`

- [x] 1.1 修改 `buildLayout()` 中的 `#message-area` HTML，内部新增 `<div id="message-list"></div>` 和 `<div id="stream-container"></div>` 两个子容器
- [x] 1.2 验证 CSS：确认 `#message-area` 的 flex/gap/overflow 样式在新增子容器后行为不变（消息区间距、滚动条）

## 2. 重构 `renderMessages()`：只操作 `#message-list`

- [x] 2.1 将 `renderMessages()` 中的 `document.getElementById("message-area")` 改为 `document.getElementById("message-list")`，`area` 重命名为 `list`
- [x] 2.2 将 `scrollToBottom()` 的调用恢复为基于 `#message-area` 的 `scrollHeight`（`#message-list` 的高度变化会自动撑开父容器）
- [x] 2.3 移除 `renderMessages()` 中 359-363 行的流式气泡 guard 逻辑（`dropStreamBubble` / `createStreamBubble` / `area.appendChild(bubble)` 等不再需要）
- [x] 2.4 移除 guard 中用到的 `dropStreamBubble` 导入或依赖检查（确保该函数仍被其他地方使用）

## 3. 流式气泡改为操作 `#stream-container`

- [x] 3.1 `sendMessage()` 中原来 `document.getElementById("message-area")!.appendChild(createStreamBubble(true))` 改为 `document.getElementById("stream-container")!.appendChild(...)`，添加创建前 `innerHTML = ""` 清空旧容器
- [x] 3.2 `appendStreamDelta()` 中移除 483-492 行的 `isConnected` 检测和自动重建逻辑（流式容器解耦后永不断开）
- [x] 3.3 `dropStreamBubble()` 中添加清空 `#stream-container` 的 `innerHTML = ""`，确保容器清理干净
- [x] 3.4 `handleStreamEvent` 中 `start` case（634-639 行）的兜底创建改为操作 `#stream-container`
- [x] 3.5 `handleStreamEvent` 中 `done` / `error` case 的 `dropStreamBubble()` 调用保持不变（函数内部已改为清空 `#stream-container`）

## 4. 修复 `sendMessage()` catch 兜底

- [x] 4.1 将 `sendMessage()` catch 中的 `if (!state.streaming) { setStreamingUI(false); }` 改为无条件 `setStreamingUI(false)`

## 5. 验证

- [ ] 5.1 手动测试：发送消息 → 确认思考气泡出现（红色轮播文案 + 灰色计时）→ 流式输出正常 → 完成渲染 Markdown
- [ ] 5.2 手动测试：流式进行中切换会话再切回 → 确认流式气泡不受影响
- [ ] 5.3 手动测试：流式过程中停止生成 → 确认 cancelled 消息正确渲染
- [ ] 5.4 手动测试：流式过程中点击桌宠气泡菜单触发其他操作 → 确认无异常
- [ ] 5.5 运行 `npm run dev` 验证完整流程正常工作
