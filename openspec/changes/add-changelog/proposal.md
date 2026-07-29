## Why

项目即将发布 v1.0（见 `hutao-desktop-pet-tauri` change），但目前仓库根目录没有 `CHANGELOG.md`，用户无法追踪每个版本的更新内容、bug 修复与破坏性变更。需要在 v1.0 发布前建立一份标准化的版本描述文案，并约定后续每次发布都在文末追加新版本条目，形成持续维护的版本历史。

## What Changes

- **新增 `CHANGELOG.md`**：在仓库根目录创建版本描述文案，采用 [Keep a Changelog](https://keepachangelog.com/) 风格结构。
- **v1.0.0 初始条目**：记录首个正式版本，对应 `hutao-desktop-pet-tauri` change 交付的功能（Tauri v2 桌宠、胡桃角色、AI 对话、Keychain 加密、聊天历史等）。
- **约定追加规则**：后续每次发布 MUST 在文件顶部（`## [Unreleased]` 之下、最新已发布版本之上）追加新版本段落，包含版本号、发布日期、`### Added` / `### Changed` / `### Fixed` / `### Removed` 等子节。
- **不含 spec 级行为变化**：本变更仅为文档新增，不改变任何应用功能或对外接口，已设置 `skip_specs: true`。

## Capabilities

### New Capabilities
<!-- 无。纯文档变更，skip_specs: true -->

### Modified Capabilities
<!-- 无 -->

## Impact

- **新增文件**：仓库根目录 `CHANGELOG.md`。
- **不影响**：任何应用代码、构建产物、依赖、API、spec。
- **维护约定**：后续每次发版（打 `v*` 标签前）必须更新此文件；CI 不强制校验（MVP 阶段），但建议未来加 `changelog-reminder` workflow。
- **关联 change**：v1.0.0 条目内容依赖 `hutao-desktop-pet-tauri` 的最终交付功能，若该 change 范围调整，v1.0.0 条目需同步调整。
