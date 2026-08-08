# Desktop-pet 技术决策记录

> 本文件只记录已经影响架构、数据契约或长期维护方式的选择。实现过程、故障调查和复盘放在 [PROBLEM_REVIEWS.md](PROBLEM_REVIEWS.md)。每条决策都保留证据链接；尚未完成的实机验证不会写成已通过。

## 索引

| ID | 决策 | 状态 | 主要证据 |
|---|---|---|---|
| ADR-DP-001 | Tauri v2/Rust 迁移到 Electron/TypeScript | accepted | `cf4d85d`、`refactor-tauri-to-electron` |
| ADR-DP-002 | 数据库事实源 + invoke 完结的流式协议 | accepted | `chat-service.ts`、重构 OpenSpec |
| ADR-DP-003 | 历史消息与流式气泡 DOM 解耦 | accepted | `fix-stream-bubble-disconnected` |
| ADR-DP-004 | 内置 `node:sqlite` 替代 better-sqlite3 | accepted | 重构 tasks 3.1、当前构建 |
| ADR-DP-005 | flex 文档流气泡与创建/显示时回收边界 | accepted | 重构 design D3/D4 |
| ADR-DP-006 | Electron safeStorage 作为当前 API Key 存储层 | accepted | CHANGELOG 2.0.0、`secrets-store.ts` |

## ADR-DP-001：从 Tauri v2/Rust 迁移到 Electron/TypeScript

- **背景**：1.5.1–1.7.0 的流式事件丢失、重复、乱序和看门狗问题持续产生补丁；旧版气泡绝对定位还存在结构性裁切。证据：[`CHANGELOG.md`](../CHANGELOG.md)、[`refactor-tauri-to-electron/proposal.md`](../openspec/changes/refactor-tauri-to-electron/proposal.md)。
- **候选方案**：继续修补 Tauri；保留 Tauri 但重写事件协议；迁移 Electron；暂时取消流式改为轮询。
- **选择**：Electron 39 + TypeScript + electron-vite；主进程承载聊天状态机，preload 使用类型化 `contextBridge`，renderer 只负责展示。
- **放弃**：Tauri/Rust 的小体积和原生栈；继续维护 seq、双通道和前端看门狗组合。
- **验证**：当前 `npm test` 81/81、`npx tsc --noEmit`、`npm run build` 通过；OpenSpec tasks 7.2/7.3 的 GUI 流式冒烟和旧库迁移仍待实机确认。
- **改判条件**：Electron 资源成本或 `node:sqlite` 版本门槛成为产品约束；或未来改成服务端流式协议后，当前桌面进程边界不再适用。

## ADR-DP-002：数据库事实源 + invoke 完结的流式协议

- **背景**：增量事件可能丢失，但消息最终状态必须可恢复。
- **候选方案**：仅依赖事件；双通道事件 + seq 去重 + 看门狗；数据库前置落库并让 invoke 持续到终结。
- **选择**：assistant 行在 start 时以 `streaming` 落库，delta 更新内容，终结时变为 `complete/error/cancelled`；`sendChatMessage` 直到终结才 resolve，事件仅用于增量显示。实现见 [`chat-service.ts`](../src/main/services/chat/chat-service.ts)。
- **放弃**：让 done 事件成为唯一完成信号；前端继续堆叠恢复 guard。
- **验证**：服务测试覆盖成功、取消、错误和监听器异常隔离；renderer 的统一 `finalizeStream()` 见 [`chat.ts`](../src/renderer/chat.ts)。完整 GUI 丢事件实测仍待补。
- **改判条件**：流式协议迁移到可确认、可重放的外部消息系统，且数据库事实源不再是本地 SQLite。

## ADR-DP-003：历史消息与流式气泡 DOM 解耦

- **背景**：历史消息可整体重渲染，流式气泡却有独立生命周期；共用容器会互相清理。
- **候选方案**：继续 `innerHTML` 并增强 guard；引入虚拟 DOM；使用 `#message-list` 与 `#stream-container` 两个容器。
- **选择**：历史渲染只操作 `#message-list`，思考/流式气泡只操作 `#stream-container`。依据 [`fix-stream-bubble-disconnected/design.md`](../openspec/changes/fix-stream-bubble-disconnected/design.md)。
- **放弃**：`isConnected` 检测和错误类型气泡重建；引入框架级渲染重写。
- **验证**：当前 HTML/renderer 实现已符合设计；OpenSpec 5.1–5.5 的手动 GUI 验证尚未完成。
- **改判条件**：未来引入组件框架并明确区分历史状态与瞬态状态的生命周期。

## ADR-DP-004：内置 `node:sqlite` 替代 better-sqlite3

- **背景**：重构实施中记录 better-sqlite3 在本机 node-gyp 编译失败，且 Electron 39 已提供内置 SQLite。
- **候选方案**：继续修复 native build；改用 `node:sqlite`；改用远程数据库。
- **选择**：使用 Electron 39 内置 Node 的 `node:sqlite`，同步 API + 参数化 SQL，避免 ABI 重编译。
- **放弃**：原生依赖的编译和打包维护成本；远程数据库超出桌面应用边界。
- **验证**：当前构建、数据库单元测试通过；重构 tasks 7.3 的旧库迁移实机验证仍待补。
- **改判条件**：Electron 版本不再提供兼容 API，或数据规模超出本地 SQLite 的适用边界。

## ADR-DP-005：flex 文档流气泡与创建/显示时回收边界

- **背景**：固定窗口中，绝对定位气泡在多行文本时会从顶部裁切；拖拽时持续钳制又影响自由移动。
- **候选方案**：继续绝对定位并调 offset；拖拽全程钳制；采用 flex 文档流，拖拽不钳制，仅创建/显示时回收完全出屏窗口。
- **选择**：采用参考项目的 flex 文档流和创建/显示时回收策略。
- **放弃**：为每种文本长度维护定位常量；拖拽过程强制限制每一帧位置。
- **验证**：实现和构建通过；多行气泡、拖出屏幕的 GUI 验证列在 tasks 7.2，尚未完成。
- **改判条件**：多显示器、辅助功能或窗口管理器行为证明当前回收策略不能稳定恢复窗口。

## ADR-DP-006：Electron safeStorage 作为当前 API Key 存储层

- **背景**：旧 Tauri 版本先后使用 keyring 和自管 AES；2.0.0 改为 Electron safeStorage。历史 cdhash 问题见 [`CHANGELOG.md`](../CHANGELOG.md)。
- **候选方案**：继续 keyring；自管 AES-256-GCM 文件；使用 Electron safeStorage。
- **选择**：当前版本使用 safeStorage，并在 UI/文档中声明系统钥匙串级加密。
- **放弃**：继续维护平台相关的自管密钥派生和旧格式迁移。
- **验证**：`secrets-store.test.ts` 覆盖存取、损坏降级和状态读取；没有把历史 cdhash 复现实验当作当前 safeStorage 已验证结论。
- **改判条件**：签名发布后仍出现跨构建不可读、无头环境无法使用，或需要跨设备/跨系统迁移密钥。
