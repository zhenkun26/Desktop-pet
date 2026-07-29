## 1. 创建 CHANGELOG.md 文件

- [x] 1.1 在仓库根目录创建 `CHANGELOG.md`，写入文件头部说明：项目名称、本文件用途、遵循 [Keep a Changelog](https://keepachangelog.com/) 约定、语义化版本号
- [x] 1.2 写入 `## [Unreleased]` 占位段落（空内容，供下次发版前累积变更）
- [x] 1.3 写入 `## [1.0.0] - 2026-07-29` 段落（发布日期暂定为 v1.0 实际交付日，可后续调整）

## 2. 填充 v1.0.0 内容

- [x] 2.1 在 v1.0.0 段落下写 `### Added` 子节，列出 `hutao-desktop-pet-tauri` change 交付的核心功能：Tauri v2 桌宠窗口（透明置顶/拖拽/4 态动画）、胡桃角色立绘、AI 角色对话（DeepSeek 流式）、API Key Keychain 加密存储、多会话聊天历史（SQLite）、系统托盘、单击气泡菜单、聊天窗口三视图
- [x] 2.2 若有已知限制（如仅支持 macOS、未做点击穿透、未做 CI 打包），在 v1.0.0 段落下写 `### Known Limitations` 子节记录
- [x] 2.3 在文件底部写 `### 版本维护规则` 说明段落：后续每次发版前在 `[Unreleased]` 下方插入新版本号段落，包含 `### Added` / `### Changed` / `### Fixed` / `### Removed` 子节（按需），并将 `[Unreleased]` 清空

## 3. 验证与文档引导

- [x] 3.1 在 `CHANGELOG.md` 顶部或底部添加一行指向 `openspec/changes/` 的说明，引导维护者从 OpenSpec change 的 proposal/tasks 中提取版本内容
- [x] 3.2 人工校对 v1.0.0 条目与 `hutao-desktop-pet-tauri` 的 proposal.md 功能列表一致
- [x] 3.3 运行 `openspec validate add-changelog` 确认 change 仍合法（skip_specs 生效）
