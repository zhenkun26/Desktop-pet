## 1. 事件派发重构

- [x] 1.1 新增 `src/main/services/chat/event-emitter.ts`：`safeEmit(channel, listeners, event)` 逐监听器 try/catch，异常记录事件通道、`listener.name ?? '<anonymous>'` 与完整 error（实现为纯模块，便于无 Electron 依赖的单测）
- [x] 1.2 `chat-service.ts` 的 `emit` / `emitBusiness` 改为调用 `safeEmit`，`onChatStream` / `onBusinessEvent` 的订阅与取消语义保持不变
- [x] 1.3 新增可选 `onListenerError` 订阅/取消入口（默认无消费者），钩子调用自身包 try/catch 防止递归抛错；`disposeChatService` 同步清空

## 2. 单元测试

- [x] 2.1 引入 vitest 测试基建（devDependency + `vitest.config.mts` + `test` 脚本）
- [x] 2.2 测试：单个监听器抛错时其余监听器仍收到事件、生成主流程不中断
- [x] 2.3 测试：异常被 `console.error` 记录且包含事件通道与监听器标识；`onListenerError` 钩子收到异常与通道信息；匿名监听器标记 `<anonymous>`；钩子自身异常被隔离
- [x] 2.4 测试：所有监听器正常时不产生额外错误日志

## 3. 验证

- [x] 3.1 `npx tsc --noEmit` 通过，`vitest run` 全绿（6/6）
- [x] 3.2 冒烟验证：开发模式日志已确认完整生成链路（前置落库→首个 delta→complete）且无监听器异常日志；窗口开关交互项待实机补验
