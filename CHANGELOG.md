# Changelog

本文件记录「胡桃桌宠」(Hutao Desktop Pet) 项目的版本变更历史。

- 遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定
- 采用 [语义化版本](https://semver.org/lang/zh-CN/) 2.0.0
- 版本内容来源：从 `openspec/changes/<change-name>/proposal.md` 与 `tasks.md` 提取，发版时整合写入

## [Unreleased]

<!-- 下次发版前在此段落累积未发布的变更。发版时将本段落内容剪切到新版本号段落下，并清空本段落。 -->

## [1.0.0] - 2026-07-29

首个正式版本。基于参考项目 `kirineko/desktop-pet`（Electron）重写为 Tauri v2 + Rust 架构，单角色胡桃，保留 AI 角色对话，砍掉 Amazon 库存查询业务。

### Added

- **Tauri v2 项目骨架**：Rust 主进程（`src-tauri/`）+ Vite 前端，替代 Electron 方案
- **透明置顶桌宠窗口**：200×300，`transparent` + `decorations:false` + `always_on_top` + `skip_taskbar`，加载 `pets-picture/hutao.png` 立绘
- **四种视觉状态动画**：`idle`（呼吸摇摆）/ `drag`（倾斜跟随）/ `click`（挤压弹跳）/ `busy`（思考抖动），CSS keyframes 驱动
- **拖拽移动窗口**：按住立绘拖动移动窗口位置，松开时持久化位置
- **单击气泡菜单**：单击立绘弹出"想做什么呢？"气泡，含「和我聊天 / 角色设定 / 退出」
- **右键上下文菜单**：和我聊天、角色设定、始终置顶（切换）、隐藏宠物、退出
- **系统托盘**：显示/隐藏宠物、打开聊天、始终置顶（切换）、退出；macOS 点击托盘图标显示/聚焦宠物
- **可见性切换**：隐藏时窗口完全不可见但应用常驻，启动时强制显示避免锁死
- **配置持久化**：`config.json` 存储 alwaysOnTop / windowX / windowY / visible
- **独立聊天窗口**：480×640，三视图切换（对话 / 角色设定 / API 设置），与桌宠窗口通过事件总线联动
- **AI 角色对话**：DeepSeek `deepseek-v4-flash` 非思考模式，SSE 流式回复
- **胡桃角色人设**：内置 `coreIdentity`（往生堂第七十七任堂主）+ `speechStyle`（自称本堂主、称呼旅行者）
- **用户可配置角色字段**：userCallName / relationship / personalityBias / tonePreference / extraNotes
- **API Key 加密存储**：`keyring` crate 存入 macOS Keychain，非明文，支持设置/修改/删除/在线测试
- **多会话聊天历史**：`rusqlite` 维护 `chat.db`，会话级 CRUD，消息按会话组织，重启后恢复
- **会话标题自动更新**：首条用户消息取前 20 字符作为会话标题
- **Markdown 渲染**：assistant 消息支持代码块/列表/链接，`marked` + `dompurify` 安全渲染
- **流式回复实时渲染**：逐 token 追加到消息气泡，自动滚动到底部
- **停止生成**：流式过程中可中止，已生成内容保留为 cancelled 消息
- **错误处理**：missing_api_key / invalid_api_key / rate_limited / network / content_filter / aborted 等错误码
- **窗口位置 clamp**：持久化位置越界时回收到主显示器右下角默认位置
- **状态优先级**：busy 中拖拽显示 drag，松开后恢复 busy；busy 中单击仍能弹出气泡菜单
- **桌宠气泡 busy 占位**：AI 流式回复中桌宠气泡显示"胡桃正在想…"

### Known Limitations

- **仅支持 macOS**：Windows/Linux 适配未做，`keyring` 跨平台能力已预留
- **未做透明窗口点击穿透**：整个 200×300 矩形可点击，立绘透明区域不穿透到桌面（推迟到后续版本）
- **未做 Dock 置顶**：`always_on_top` 为普通级别，无法浮在 macOS Dock 之上（参考项目 Electron `screen-saver` level 的对应能力未实现）
- **未做 CI 自动打包**：MVP 阶段仅支持本地 `cargo tauri build`，无 GitHub Actions 自动发版
- **未做应用内更新**：无自动更新机制，新版本需用户手动下载替换
- **单角色硬编码**：仅胡桃一只，未做多角色切换数据结构，未来加角色需重构
- **素材未预处理**：直接用 2MB 原图（2290×2474），CSS `object-fit: contain` 缩放显示，未做体积优化
- **DeepSeek 模型名硬编码**：`deepseek-v4-flash` 写死在 Rust 常量中，模型名变更需改代码重新编译

### 版本维护规则

后续每次发版遵循以下规则：

1. 在 `[Unreleased]` 段落累积日常变更，按 `### Added` / `### Changed` / `### Fixed` / `### Removed` 分类（按需使用，无变更的子节可省略）
2. 发版时（打 `v*` 标签前）：
   - 在 `[Unreleased]` 之下、最新已发布版本之上，插入新版本段落 `## [x.y.z] - YYYY-MM-DD`
   - 将 `[Unreleased]` 累积的内容剪切到新版本段落下
   - 清空 `[Unreleased]` 段落（保留空占位）
3. 版本号遵循语义化版本：
   - MAJOR：不兼容的 API/行为变更
   - MINOR：向后兼容的新功能
   - PATCH：向后兼容的 bug 修复
4. 每个版本条目内容应从对应的 `openspec/changes/<change-name>/proposal.md` 提取「What Changes」，从 `tasks.md` 提取实际完成情况
5. 已发布版本的内容不可修改（如需更正，在新版本中用 `### Fixed` 说明）

<!-- 链接定义区（Keep a Changelog 推荐） -->

[Unreleased]: https://github.com/yuzheng/my-desktop-pet/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yuzheng/my-desktop-pet/releases/tag/v1.0.0
