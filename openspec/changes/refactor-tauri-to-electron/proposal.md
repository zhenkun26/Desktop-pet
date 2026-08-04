# refactor-tauri-to-electron

## Why

Tauri v2 的事件系统在 spawn 任务中存在事件缓冲/丢失的运行时行为，导致「对话卡在思考中」从 1.5.1 到 1.7.0 连续修复 5 轮仍未根治——双通道投递、seq 去重、自愈看门狗、过期事件拦截全是给不可靠传输打的补丁，补丁本身又引入新 bug（看门狗秒/毫秒单位错误、切会话气泡分裂）。同时气泡绝对定位贴近窗口上沿的布局导致多行文本被裁切，也属于结构性问题。

参考项目 `kirineko/desktop-pet`（Electron + TypeScript）的架构从根本上免疫这两类问题：

1. **assistant 消息在 start 时即落库**（`status='streaming'`），每个 delta 都更新该行——数据库是单一事实来源，前端任何时候都能重载恢复，不依赖事件通道
2. **`sendChatMessage` 的 invoke Promise 挂到生成结束才 resolve**——完成信号不经过事件通道，事件只是增量优化
3. **气泡是 flex 文档流元素**（立绘仅 128×128 占窗口底部），结构性不可能被窗口边界裁切

用户决定放弃增量修补，按参考项目架构整体重构。

## What Changes

- **技术栈迁移**：Tauri v2 + Rust → Electron + electron-vite + TypeScript（参照 `kirineko/desktop-pet` 的目录结构与进程模型），删除 `src-tauri/`，业务逻辑全部移到 Electron 主进程（`src/main/services/`）
- **聊天服务重构**：复刻参考项目 `chat-service`——assistant 消息前置落库（start 时插入 `streaming` 行，delta 实时更新，结束置 `complete`/`cancelled`/`error`）；`send-chat-message` invoke 挂到生成结束；事件经 `onChatStream` 订阅 → `webContents.send` 定向投递聊天窗口
- **API Key 存储迁移**：自研 XOR 加密文件 → Electron `safeStorage`（系统钥匙串级加密），参考项目 `secrets-store` 实现
- **桌宠窗口布局重构**：`#app` 改为 flex 列布局（`justify-content: flex-end`），气泡为文档流元素位于立绘上方；立绘 128×128 不再撑满窗口；边界钳制回到「创建/显示时回收」，拖拽不钳制（与参考项目一致）
- **保留并移植胡桃特色**：胡桃人设 prompt、思考轮播文案气泡、时段问候、休息提醒 + 番茄钟（参考项目没有，用 TS 重写为 `timer-service`）、陪伴日记抽屉 UI、底部 Tab 布局
- **数据迁移**：首次启动时若检测到旧 Tauri 数据目录（`com.hutao-desktop-pet/chat.db`）且新库为空，自动 ATTACH 旧库迁移会话与消息（status 映射 `ok→complete`）；API Key 因加密方案不同需用户重新填入
- **版本**：重构发版 v2.0.0，删除旧版构建产物，`electron-builder` 产出 `.dmg` / `.app`

## Capabilities

### New Capabilities
- `electron-app-shell`：Electron 主进程应用外壳——透明置顶桌宠窗口（flex 布局）、聊天窗口单例管理、系统托盘、配置持久化、IPC 注册
- `chat-streaming-service`：前置落库的流式聊天服务——消息状态机（streaming/complete/cancelled/error）、invoke 挂到完成、定向事件投递、DeepSeek SSE 客户端
- `data-migration`：旧 Tauri 数据目录（chat.db）到新 Electron 库的一次性迁移

### Modified Capabilities
- `desktop-pet-window`：布局从「立绘撑满 + 气泡绝对定位」改为「flex 文档流 + 立绘 128×128」；边界钳制改为创建/显示时回收
- `ai-character-chat`：API Key 存储改 safeStorage；事件契约增加 `assistantMessageId` 与 `cancelled` 类型
- `companion-timer`：休息提醒 + 番茄钟从 Rust 移植为 TS `timer-service`（功能不变）

## Impact

- **删除**：`src-tauri/`（全部 Rust 代码）、旧 `src/`（Vite + Tauri API 前端）、`src-tauri/target/` 构建产物
- **新增**：`src/main/`、`src/preload/`、`src/renderer/`、`src/shared/`、`electron.vite.config.ts`、`electron-builder.yml`
- **依赖**：`electron`、`electron-vite`、`electron-builder`、`marked`、`dompurify`（数据库用 Electron 39 内置 `node:sqlite`，零原生依赖，实施变更见 tasks 3.1）
- **保留**：`pets-picture/hutao.png`、`openspec/`、`CHANGELOG.md`、`.claude/` `.kimi-code/` `.trae/`
- **数据**：旧 `chat.db` 只读迁移，不修改不删除；旧 `deepseek.key` 废弃（用户需重填 Key）
- **平台**：macOS（aarch64）优先
