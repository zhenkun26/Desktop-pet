## Context

当前 `src/chat/main.ts` 的流式气泡管理采用"手动 append 到 message-area + `renderMessages()` 中用 guard 恢复"的紧耦合模式。`renderMessages()` 通过 `innerHTML = ""` 清空整个消息区，流式气泡（独立于 `state.messages` 数组之外）会被摧毁。虽然 359-363 行有恢复逻辑，但在 `streamBubbleReady` 状态不一致时（思考→流式切换后重建为思考气泡）会丢失已累积的流式文本。参见 proposal.md 的详细 bug 分析。

参考项目 `kirineko/desktop-pet` 无此问题——它使用独立 DOM 容器管理动画气泡，不参与消息列表的 innerHTML 替换。

## Goals / Non-Goals

**Goals:**
- 将流式气泡容器与消息历史列表 DOM 解耦
- 消除 `renderMessages()` 对流式气泡的误伤
- 修复 catch 兜底条件永远为 false 的问题
- 移除不再需要的脆弱的 `isConnected` 检测和自动重建逻辑
- 保持现有思考气泡 UI 行为不变（红色轮播文案 + 灰色计时）

**Non-Goals:**
- 不改动 Rust 后端
- 不改动 IPC 事件协议
- 不改动桌宠窗口代码
- 不改动 CSS 动画效果

## Decisions

### 决策 1：使用独立 `#stream-container` 容器

**选择**：在 `.chat-view` 的 `#message-area` 内新增两个子容器：
- `#message-list`：消息历史列表（`renderMessages()` 只操作这个）
- `#stream-container`：流式气泡专属容器（`renderMessages()` 永不触碰）

**DOM 结构**：
```html
<div id="message-area">
  <div id="message-list">
    <!-- renderMessages() 渲染的消息 -->
  </div>
  <div id="stream-container">
    <!-- 流式气泡，由 createStreamBubble/dropStreamBubble 管理 -->
  </div>
</div>
```

**理由**：
- `renderMessages()` 只需要操作 `#message-list`，流式容器完全不受影响
- 不再需要 `isConnected` 检测和自动重建（流式气泡永不断开）
- 不再需要 `renderMessages()` 359-363 行的 guard（`state.streaming` 重建逻辑）

**替代方案**：
- 继续用 innerHTML + 增强 guard → 治标不治本，修复后的 guard 仍可能被边缘场景击穿
- 使用虚拟 DOM / 框架 → 超范围，本项目坚持 vanilla TS

### 决策 2：`renderMessages()` 重构为只操作 `#message-list`

**选择**：`renderMessages()` 改为查找 `#message-list` 而非 `#message-area`，只在此容器内做 innerHTML 清理和重建。

**理由**：
- 改动最小化——只需修改选择器和移除流式气泡 guard
- 向后兼容——所有现有 `renderMessages()` 调用点无需变更参数

### 决策 3：移除 `appendStreamDelta` 中的 `isConnected` 检测

**选择**：删除 `appendStreamDelta` 中 483-492 行的 bubble 失联检测和自动重建逻辑。

**理由**：
- 流式容器解耦后，bubble 永不断开，检测永远为 false
- 删除死代码降低维护成本

### 决策 4：修复 `sendMessage()` catch 条件

**选择**：将 `if (!state.streaming) { setStreamingUI(false); }` 改为无条件 `setStreamingUI(false)`（即移除 `if` 条件）。

**理由**：
- `state.streaming` 在上文 `setStreamingUI(true)` 中已设为 `true`，条件永远为 false
- invoke 异常时 UI 应无条件恢复，避免永久卡死

## Risks / Trade-offs

- **[风险] `#message-list` 选择器变更遗漏** → `renderMessages()` 内部和若干调用处可能直接查询 `#message-area`。**缓解**：所有对消息区的 DOM 查询需要审查并改为 `#message-list`。
- **[风险] CSS 滚动与 `#stream-container` 的关系** → 原来 `message-area` 直接包含消息和气泡，`scrollToBottom` 基于 `message-area` 的 `scrollHeight`。改为两个子容器后，需确认 `#stream-container` 在 `#message-list` 下方时，`message-area` 仍能正确滚动到底部。**缓解**：`#stream-container` 不占高度或 flex 布局自动撑开 `message-area` 的 `scrollHeight`，`scrollToBottom` 逻辑不变。
- **[权衡] 额外 DOM 层级** → 多两个 div 嵌套，轻微增加 DOM 深度。可接受，无性能影响。
