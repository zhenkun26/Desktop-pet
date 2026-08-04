# design.md — refactor-tauri-to-electron

## 总体架构

```
桌宠窗口 (renderer/index.html)   聊天窗口 (renderer/chat.html)
        ↕ IPC (ipcRenderer.invoke / webContents.send)
┌─────────────────────────────────────────────────┐
│ Electron 主进程 (src/main/)                      │
│  ├─ index.ts        窗口/托盘/拖拽/配置/IPC 注册  │
│  ├─ chat.ts         聊天窗口单例 + 流事件定向转发  │
│  ├─ store.ts        config.json 持久化           │
│  └─ services/                                    │
│      ├─ chat/chat-service.ts   流式聊天状态机     │
│      ├─ chat/chat-db.ts        node:sqlite       │
│      ├─ chat/deepseek-client.ts SSE 客户端       │
│      ├─ chat/secrets-store.ts  safeStorage       │
│      ├─ chat/personas.ts       胡桃人设          │
│      └─ timer/timer-service.ts 休息提醒+番茄钟    │
└─────────────────────────────────────────────────┘
```

## 关键设计决策

### D1. 消息状态机：前置落库（根治「卡在思考中」）

```
sendChatMessage(input)
  │
  ├─ insertMessage(user,   status='complete')
  ├─ insertMessage(assistant, status='streaming', content='')  ← 关键：立即落库
  ├─ emit start { assistantMessageId }
  │
  ├─ onDelta: updateMessage(content+=delta)  ← 每个 delta 同步 DB
  │            emit delta
  │
  ├─ 成功: updateMessage(status='complete') → emit done → return {ok:true}
  ├─ abort: updateMessage(status='cancelled') → emit cancelled
  └─ 失败: updateMessage(status='error')      → emit error
       ↑ invoke 的 Promise 直到这里才 resolve —— 完成信号不依赖事件通道
```

前端三重恢复保障（任一生效即不会卡死）：
1. `await sendChatMessage()` resolve/reject → 重载消息
2. `chat-stream` 事件（done/cancelled/error）→ 重载消息
3. 切入会话 / 窗口重开 → `getConversationMessages` 返回含 `status` 的完整状态，renderer 发现 `streaming` 行可直接恢复或标记

### D2. 事件投递：定向而非广播

主进程 `chat-service` 内部用 listener 集合 `emit`；`chat.ts` 在创建聊天窗口时订阅一次，把事件 `webContents.send('chat-stream', event)` 定向投递。桌宠窗口只订阅 `business-event`（busy/idle），由 chat-service 状态变化驱动。不使用全局事件总线。

### D3. 桌宠窗口布局：flex 文档流（根治气泡裁切）

```
#app (200×300, display:flex, flex-direction:column, justify-content:flex-end)
  ├─ .bubble     position:relative（文档流）, max-width:168px
  └─ .pet-stage  168px 高, 立绘 128×128 object-fit:contain
```

气泡多高都只是在文档流中向上占据空间，结构性不可能被窗口上沿裁切。分段轮播（每段约 2s）保留在 PetController 层。

### D4. 边界策略：与参考项目一致

- 拖拽中：`move-window` 只做 `setPosition(x+dx, y+dy)`，**不钳制**（保留拖出屏的自由）
- 窗口创建 / `show-pet` 时：`clampToVisibleWorkArea` 回收完全出屏的窗口
- 不做拖拽中强钳制（1.7.0 的 `clamp_fully_visible` 废弃——过度设计且影响拖拽手感）

### D5. 数据迁移

- 新库：`userData/chat.db`（Electron `app.getPath('userData')`）
- 首次初始化时：若新库 conversations 为空且 `~/Library/Application Support/com.hutao-desktop-pet/chat.db` 存在 → `ATTACH` 旧库，复制 conversations/messages/personas，status 映射 `ok→complete`，`cancelled/error` 保留
- 旧库只读，不修改不删除
- API Key：旧 `deepseek.key` 为自研加密无法被 safeStorage 解密，迁移后用户在「🔑 API」页重填一次（UI 已有未配置引导）

### D6. 番茄钟/休息提醒移植

`timer-service.ts`：30s ticker（`TICK_SECS = 30`），`restIntervalSecs` 活动计时到点 emit `rest-reminder`；番茄钟 work/break 状态机 emit `pomodoro-tick` / `pomodoro-done`。事件经 `webContents.send` 同时投递桌宠与聊天窗口。功能与 Rust 版一致（45 分钟默认提醒、25/5 番茄钟）。

### D7. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 构建 | electron-vite | 参考项目同款，main/preload/renderer 三端统一 |
| 数据库 | node:sqlite（内置） | Electron 39 内置 Node ≥22.13 自带，同步 API 与 better-sqlite3 同形状，零原生编译（实施变更：better-sqlite3 在本机 node-gyp 编译失败——Python 3.13 移除 distutils，见 tasks 3.1） |
| 密钥 | Electron safeStorage | 系统级加密，参考项目 secrets-store 同款 |
| 打包 | electron-builder → dmg (arm64) | 参考项目同款 |
| 渲染层 | 复用现有胡桃 UI（chat.css、pet 动效、分段轮播） | 已验证，只换 IPC 调用层 |

## 风险与缓解

- **node:sqlite 版本门槛**：依赖 Electron 39+（内置 Node ≥22.13）的 `DatabaseSync`；chat-db 使用宽松类型封装，SQL 一律参数化，升级 Electron 大版本时需回归验证
- **旧数据迁移失败**：迁移包在 try/catch 中，失败不阻塞启动，仅记日志；旧库不动
- **窗口透明在 macOS 打包后失效**：`transparent: true` + `backgroundColor: '#00000000'` + `hasShadow: false`（参考项目已验证，无需 Tauri 时代的原生 hack）
