## Why

`chat-service.ts` 的 `emit` / `emitBusiness` 用空 `catch` 吞掉订阅方异常——隔离语义是对的（一个监听器失败不能打断生成流、不能拖垮其他监听器），但错误被完全静默：既没有 error 对象，也没有监听器身份与事件通道信息。当前订阅方少（窗口定向转发），风险尚低；但随着日志、遥测、多角色事件路由等监听器加入，任何监听器 bug 都将无法定位。

## What Changes

- **事件派发封装 `safeEmit`**：保留"逐监听器隔离、互不影响、不打断生成"的语义，同时把异常记录到日志——包含事件通道（`chat-stream` / `business-event`）、监听器名（`listener.name`，匿名函数标记为 `<anonymous>`）与完整 error 对象
- **可选 `onListenerError` 钩子**：chat-service 暴露注册入口，供未来遥测/诊断面板消费监听器错误，默认不注册、不影响现有行为
- **单元测试**：一个监听器抛错时——其他监听器仍收到事件、生成流程不中断、错误被记录（mock console.error 断言）

## Capabilities

### New Capabilities
<!-- 无新增 capability -->

### Modified Capabilities
- `chat-streaming-service`: 事件投递要求从"忽略订阅方异常"细化为"隔离订阅方异常并记录诊断信息（通道、监听器、错误），任何单个监听器失败不得影响其他监听器与生成流程"

## Impact

- **新增**：`src/main/services/chat/event-emitter.ts`（纯事件派发模块：`safeEmit` + `onListenerError`，不依赖 Electron，可直接单测）
- **修改**：`src/main/services/chat/chat-service.ts`（`emit` / `emitBusiness` → `safeEmit` 调用，重新导出 `onListenerError`）
- **新增**：`src/main/services/chat/event-emitter.test.ts`（单元测试，无 Electron 运行时依赖）
- **依赖**：无新增
- **兼容性**：非破坏；`onChatStream` / `onBusinessEvent` 订阅与取消语义不变
