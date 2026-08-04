## Context

仓库当前为空白 Tauri 项目（仅有 `pets-picture/hutao.png` + OpenSpec 脚手架）。参考项目 `kirineko/desktop-pet` 用 Electron 实现了同类功能，其前端动画/气泡/状态机逻辑可直接借鉴，但主进程层需要从 TypeScript 迁移到 Rust。Tauri v2 的多窗口、透明置顶、托盘、IPC 事件总线等能力已在社区案例中得到验证（如"提肛助手"等透明置顶桌宠应用），技术路径可行。

用户偏好（来自 user_profile）：Tauri v2 + Rust、SQLite、macOS 桌面、数据库加密/非明文存储、低登录摩擦。胡桃为单角色，无 Amazon 业务。

## Goals / Non-Goals

**Goals:**
- 用 Tauri v2 + Rust 复刻参考项目的"桌宠 + AI 对话"核心体验，单角色胡桃
- 前端代码尽量平移参考项目的 HTML/CSS/pet 交互逻辑，降低工作量
- API Key 走 macOS Keychain（`keyring` crate），满足非明文存储偏好
- 聊天历史走 `rusqlite`，与配置文件分离
- 双窗口架构（桌宠 + 聊天），通过 Tauri 事件总线联动

**Non-Goals:**
- 不复刻 Amazon 库存查询业务（参考项目的核心业务，本项目砍掉）
- 不做多角色切换（仅胡桃，数据结构不留 PetId 枚举扩展位，简化代码）
- 不做素材预处理（直接用 2MB 原图 + CSS `object-fit: contain`）
- 不做 Windows/Linux 适配（首要 macOS，后续可扩展）
- 不做像素风 `image-rendering: pixelated`（胡桃是高清立绘，非像素图）
- 不做 alert 视觉状态（无业务事件触发，砍掉）
- 不做应用内更新/CI 打包（MVP 阶段手动 `cargo tauri dev` 运行）

## Decisions

### 决策 1：双 WebviewWindow 架构（方案 X）

**选择**：两个独立 `tauri::WebviewWindow`——桌宠窗口（200×300 透明置顶）+ 聊天窗口（480×640 标准装饰）。

**理由**：
- 桌宠窗口需要 `transparent + decorations:false + always_on_top`，聊天窗口需要标准窗口装饰，两者配置冲突，无法合并
- 双窗口让"桌宠常驻桌面"的核心体验成立——关闭聊天窗口不影响桌宠
- 参考项目已验证此模型（Electron BrowserWindow × 3，本项目简化为 × 2）

**替代方案**：
- 单窗口 + 内嵌视图切换（方案 Y）：失去桌宠常驻感，否决
- 单窗口 + 多 webview：Tauri v2 的 multi-webview 在同一窗口内仍不稳定，否决

**实现要点**：
- 桌宠窗口：`tauri.conf.json` 中 `label: "pet"`，启动时创建
- 聊天窗口：`label: "chat"`，懒加载——首次点击"和我聊天"时创建，已存在则 `set_focus`
- 两个窗口加载同一前端 bundle，通过 URL 查询参数区分入口（`?window=pet` / `?window=chat`）

### 决策 2：前端复用参考项目动画体系

**选择**：直接平移参考项目 `style.css` 中的 `idle-bob / drag / click-bounce / busy-bob` keyframes 和 `.pet-image.state-*` class 体系。

**理由**：
- 参考项目的 CSS 动画已经打磨过，效果可接受
- 胡桃立绘虽非像素风，但 `transform: rotate/scale/translateY` 同样适用
- 唯一调整：去掉 `image-rendering: pixelated`（胡桃是高清立绘）

**替代方案**：
- 用精灵图逐帧动画：需要拆分 `hutao.png` 为多帧，工作量大，否决
- 用 Lottie/Rive 矢量动画：需要重新制作动画资源，超 MVP 范围

### 决策 3：IPC 用 Tauri 命令 + 事件双通道

**选择**：
- **命令（invoke）**：前端 → 主进程的请求/响应（如 `send_chat_message`、`set_api_key`、`move_window`）
- **事件（emit/listen）**：主进程 → 前端的推送（如 `chat-stream-delta`、`chat-stream-done`、`config-changed`、`business-state`）

**理由**：
- Tauri v2 的 `#[tauri::command]` 适合同步请求，`app_handle.emit` 适合流式推送
- 参考项目用 Electron `ipcMain.handle` + `webContents.send`，模型完全对应
- 流式 SSE delta 必须用事件推送（前端不能阻塞等 SSE 结束）

**替代方案**：
- 全用命令 + 轮询：流式体验差，否决
- 全用事件（双向）：请求/响应语义混乱，调试困难

### 决策 4：API Key 用 keyring crate 存 macOS Keychain

> **⚠ 已于 v1.1.1 推翻**：实测发现 macOS 数据保护钥匙串把条目访问权绑定到签名二进制的 cdhash，ad-hoc 签名的应用每次重新构建后旧 Key 不可见（"保存成功但读取不到"）。已改为 AES-256-GCM 加密文件（密钥由 kern.hostuuid + 应用盐派生，0600 权限），详见 `src-tauri/src/chat/secrets.rs` 头部注释。以下内容为历史决策存档。

**选择**：`keyring` crate，service name = `com.hutao-desktop-pet.deepseek`，account = `default`。

**理由**：
- 满足用户"非明文存储"硬性偏好
- macOS Keychain 是系统级加密存储，比自管 AES + 配置文件更安全
- `keyring` crate 跨平台，未来扩展 Windows/Linux 无需改代码

**替代方案**：
- 自管 AES-256-GCM + 配置文件：需要管理密钥派生，复杂度高，安全性反而不如系统钥匙串
- Tauri `secure-storage` 插件：社区维护，不如 `keyring` 成熟

### 决策 5：聊天历史用 rusqlite，配置用 JSON 文件

**选择**：
- `chat.db`（rusqlite）：会话、消息、角色设定（带 updatedAt）
- `config.json`（serde_json）：窗口位置、alwaysOnTop、visible（非敏感数据）

**理由**：
- 聊天历史是结构化、可查询、可批量删除的数据，适合 SQLite
- 配置是少量扁平字段，JSON 文件足够，无需引入数据库开销
- 参考项目也是同样拆分（chat.db + config 文件）
- 数据库文件存放在 Tauri `app_data_dir`

**替代方案**：
- 全用 SQLite：配置也要建表，过度工程
- 全用 JSON：消息列表查询/分页性能差

### 决策 6：胡桃人设内置为 Rust 常量

**选择**：在 Rust 主进程中定义 `const HUTAO_CORE_IDENTITY` 和 `const HUTAO_SPEECH_STYLE`，运行时与用户可配置字段合并生成 system prompt。

**理由**：
- coreIdentity/speechStyle 不可被用户修改（spec 已规定），硬编码最简单
- 避免 prompt 注入风险（若从数据库读取，用户可能篡改）
- 参考项目用 TypeScript 对象 `BUILTIN_PERSONAS`，本项目对应为 Rust 常量

### 决策 7：SSE 流式用 reqwest + 手写解析

**选择**：`reqwest` 发起 POST，`response.bytes_stream()` 获取异步流，手动按行解析 `data: {...}` SSE 帧。

**理由**：
- DeepSeek API 兼容 OpenAI SSE 格式，无需专门 SDK
- `reqwest` 已是 Tauri 生态标配，依赖少
- 手写解析 < 50 行 Rust，比引入 `eventsource-stream` 等 crate 更可控

### 决策 8：托盘用 tauri-plugin-tray（或 Tauri v2 内置 tray-icon）

**选择**：Tauri v2 内置 `TrayIconBuilder`。

**理由**：
- Tauri v2 把 tray 合并进核心，不再需要 plugin
- 参考项目用 Electron `Tray`，API 模型对应

## Risks / Trade-offs

- **[风险] Tauri v2 macOS 透明窗口 + always_on_top 无法浮在 Dock 之上** → 参考项目用 Electron `setAlwaysOnTop(true, 'screen-saver')` 实现 Dock 置顶，Tauri 默认 `always_on_top` 是普通级别。**缓解**：MVP 接受普通置顶（浮在普通窗口之上即可），后续若需要 Dock 置顶可用 `objc` crate 调 NSWindow 私有 API。
- **[风险] 2MB PNG 原图加载性能** → 胡桃立绘 2290×2474，2MB。**缓解**：CSS `object-fit: contain` 缩放到 128×128 显示，GPU 解码一次后缓存；启动时立绘加载延迟 < 200ms 可接受。
- **[风险] keyring 在 CI/无头环境失败** → macOS Keychain 在无 GUI 环境会拒绝访问。**缓解**：仅影响开发期测试，MVP 不做 CI；运行时捕获 keyring 错误降级提示用户手动配置。
- **[风险] DeepSeek `deepseek-v4-flash` 模型名可能变动** → 参考项目写死模型名。**缓解**：将模型名提取为 Rust 常量，便于后续调整。
- **[权衡] 双窗口 vs 单窗口** → 双窗口带来"常驻感"但 IPC 复杂度上升。已选双窗口，接受复杂度。
- **[权衡] 单角色硬编码 vs 多角色数据结构** → 单角色简化代码但未来加角色需重构。用户已确认只做胡桃，接受。
- **[风险] Tauri v2 透明窗口在 macOS 的点击穿透** → 需要确保立绘透明区域能穿透到桌面。**缓解**：Tauri v2 支持 `set_ignore_cursor_events` 配合前端 hit-test；MVP 阶段若实现复杂可先不做穿透，让整个 200×300 矩形可点击（体验略差但不阻塞）。

## Migration Plan

无历史数据需要迁移（全新项目）。部署步骤：
1. `cargo tauri dev` 本地运行验证
2. `cargo tauri build` 产出 `.app` / `.dmg`
3. 首次运行用户需在 API 设置视图配置 DeepSeek API Key

回滚策略：删除生成的 `src-tauri/` 和前端代码即可回到当前空白仓库状态；`pets-picture/` 和 `openspec/` 不受影响。

## Open Questions

- DeepSeek `deepseek-v4-flash` 模型名在 2026 年是否仍有效？开发时需用 `curl` 先验证一次。若失效，替换为 DeepSeek 当前可用模型即可（spec 只规定"DeepSeek 模型"，未绑定具体版本）。
- macOS 透明窗口点击穿透是否需要在 MVP 实现？若实现复杂可推迟到 v2，先让整个窗口矩形可点击。
