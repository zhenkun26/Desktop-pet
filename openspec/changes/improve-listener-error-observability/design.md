## Context

现状见 proposal.md — Why：`chat-service.ts` 的 `emit` / `emitBusiness` 用空 `catch` 吞掉监听器异常，错误无任何痕迹。当前监听器集合由 `onChatStream` / `onBusinessEvent` 注册，订阅方目前只有窗口定向转发（极少抛错），但该集合面向未来扩展（日志、遥测、多角色事件路由）。

## Goals / Non-Goals

**Goals:**
- 保留"逐监听器隔离"语义：一个监听器失败不影响其他监听器、不打断生成流、不抛到 IPC 调用栈
- 让监听器异常可观测：日志包含事件通道、监听器标识与完整错误
- 为未来遥测留一个可选消费点，不引入新的外部依赖

**Non-Goals:**
- 不改变 `onChatStream` / `onBusinessEvent` 的订阅与取消语义
- 不做渲染层 uncaught error 的统一兜底（那是另一个层面，另议）
- 不新增事件总线或全局错误上报服务

## Decisions

**D1. 用 `safeEmit(channel, listeners, event)` 统一封装派发**
替代两处重复的 `for + try/catch`。逐监听器 try/catch 保留；catch 中记录 `channel`、`listener.name ?? '<anonymous>'` 与完整 error。备选：把异常重新抛出——会中断剩余监听器，与"隔离"目标冲突，否决。

**D2. 可选 `onListenerError` 订阅钩子**
与流式/业务事件同一套 listener 集合模式，默认无消费者，钩子自身包 try/catch 防止递归抛错。备选：全局 `process.on('uncaughtException')`——粒度太粗，否决。

**D3. 单元测试聚焦隔离与记录**
用 mock 的 listener 集合驱动 `safeEmit`：一个抛错 + 一个正常，断言正常监听器收到事件、`console.error` 被调用且包含 channel 与监听器名、生成主流程函数不受影响。不依赖 Electron 运行时（listener 集合为纯逻辑，可直接测试）。

## Risks / Trade-offs

- [日志噪音] → 只在异常时记录，正常路径零开销
- [匿名监听器难以定位] → 记录 `<anonymous>` 并附错误堆栈；后续可要求监听器显式命名
- [错误订阅钩子自身抛错] → 钩子调用包 try/catch，异常只记日志
