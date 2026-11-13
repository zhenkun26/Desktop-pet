## Why

当前仓库只有一个 `pets-picture/hutao.png` 素材和 OpenSpec 脚手架，没有任何可运行的应用。用户希望以参考项目 `kirineko/desktop-pet`（Electron + 像素桌宠 + AI 对话）为蓝本，做一个**技术栈契合自身偏好**（Tauri v2 + Rust）、**单角色**（原神胡桃）、**保留 AI 角色对话**的桌面宠物。砍掉参考项目的 Amazon 库存查询业务，让架构更聚焦。

## What Changes

- **新增 Tauri v2 项目骨架**：在仓库根目录初始化 `src-tauri/`（Rust 主进程）+ 前端（HTML/CSS/TS，复用参考项目的 pet/bubble 动画思路），替代直接 fork Electron 项目。
- **新增透明置顶桌宠窗口**：单窗口 200×300，`transparent: true` + `decorations: false` + `always_on_top: true` + `skip_taskbar: true`，加载 `pets-picture/hutao.png`，CSS keyframes 模拟 `idle / drag / click / busy` 四种视觉状态（砍掉参考项目的 `alert`，AI 出错时可后续复用）。
- **新增桌宠交互**：拖拽移动窗口、单击弹出"想做什么呢？"气泡菜单（和我聊天 / 角色设定 / 退出）、右键/托盘菜单、位置持久化、可见性切换、置顶切换。
- **新增第二窗口：聊天窗口**：480×640，承载"对话 / 角色设定 / API 设置"三个视图；通过 Tauri 事件总线与宠物窗口联动（聊天中 → 宠物进入 `busy` 状态）。
- **新增 AI 角色对话能力**：沿用 DeepSeek（`deepseek-v4-flash` 非思考模式，SSE 流式回复），胡桃专属 `coreIdentity` + `speechStyle` 人设 prompt，用户可配置 `userCallName / relationship / personalityBias / tonePreference / extraNotes`。
- **新增 API Key 加密存储**：用 `keyring` crate 将 DeepSeek API Key 存入 macOS Keychain（非明文，契合用户安全偏好），支持设置 / 修改 / 删除 / 在线测试。
- **新增聊天历史持久化**：用 `rusqlite` 维护 `chat.db`，按会话（conversation）组织消息，支持多会话、重命名、删除。
- **新增系统托盘**：Tauri `tray-icon` 提供显示/隐藏宠物、打开聊天、始终置顶、退出等菜单项。
- **不做**：Amazon 库存查询、多角色切换（仅胡桃单角色）、像素风素材处理（直接用 2MB 原图 + `object-fit: contain`）。

## Capabilities

### New Capabilities
- `desktop-pet-window`: 透明置顶桌宠窗口的创建、显示、隐藏、拖拽、位置持久化、视觉状态（idle/drag/click/busy）切换、托盘菜单、单击气泡菜单。
- `ai-character-chat`: 基于 DeepSeek 的角色对话，包含胡桃人设 prompt、用户可配置的角色设定、API Key 加密存储与测试、流式回复、多会话聊天历史持久化。
- `chat-window`: 独立聊天窗口（对话 / 角色设定 / API 设置三视图），与宠物窗口通过事件总线联动（聊天中驱动宠物 busy 状态）。

### Modified Capabilities
<!-- 无现有 capability，全部为新增 -->

## Impact

- **新增代码**：`src-tauri/`（Rust 主进程、IPC 命令、窗口管理、ChatService、Keyring、rusqlite）、前端（HTML/CSS/TS，pet/bubble/chat/persona/api 视图）。
- **依赖**：Tauri v2、`tauri-plugin-shell`（可选，外部链接）、`keyring`、`rusqlite`、`reqwest`（SSE 流式）、`serde`。前端用 Vite 构建。
- **素材**：直接复用 `pets-picture/hutao.png`，无预处理。
- **平台**：首要支持 macOS（用户开发环境）；Windows/Linux 可后续适配。
- **构建产物**：`.dmg` / `.app`（macOS）。
- **不影响**：现有 `openspec/` 脚手架、`.claude/` `.kimi-code/` `.trae/` 命令定义。
