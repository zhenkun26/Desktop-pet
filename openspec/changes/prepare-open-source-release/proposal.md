## Why

项目将上传 GitHub 公开。当前仓库没有 remote，缺少 README / LICENSE / CONTRIBUTING / SECURITY，`.gitignore` 未覆盖构建产物（`out/`、`release/`），没有测试与 CI，`electron-builder.yml` 还残留已废弃的 `better-sqlite3` 配置；公开前需要一套仓库卫生、贡献与审查机制，避免把个人配置、构建产物和版权风险带进公开仓库。

## What Changes

- **仓库卫生**：`.gitignore` 补充 `out/`、`release/`；清理 `electron-builder.yml` 中 `asarUnpack: node_modules/better-sqlite3/**` 残留；敏感信息扫描（gitleaks 基线检查，当前无 key）
- **开源文档**：新增 `LICENSE`（MIT，与 package.json 一致）、`README.md`（项目介绍、快速开始、开发指南、OpenSpec 工作流）、`docs/CONTRIBUTING.md`（OpenSpec 优先、conventional commits、代码规范）、`docs/SECURITY.md`、PR / issue 模板、`CODEOWNERS`
- **CI（GitHub Actions）**：typecheck（`tsc --noEmit`）+ build（`electron-vite build`）+ 单元测试（vitest，随测试基建补齐）+ 敏感信息扫描；macOS 打包作为手动触发 workflow
- **AGENTS.md 入库**：把当前 Codex 自定义规范落进仓库根目录，让协作者共享同一套代码规范与 OpenSpec 流程
- **.npmrc 决策**：移除个人 electron 镜像配置（或替换为官方源），避免影响他人构建
- **版权声明**：README 明确胡桃立绘/美术资源版权归 miHoYo、仅供个人学习
- **GitHub 上线（手动步骤，记入 tasks）**：创建公开仓库、推送、开启 main 分支保护（禁直推、PR + 1 approve + 状态检查）、配置 Secret
- **版本说明**：本变更不发版；下次发版建议 2.0.2，三处同步（package.json、聊天窗口标题、CHANGELOG）

## Capabilities

### New Capabilities
<!-- 纯工程/仓库治理变更，无应用行为变化 -->

### Modified Capabilities
<!-- 无应用能力变化 -->

> 本变更不涉及应用运行时行为，已在 `.openspec.yaml` 声明 `skip_specs: true`。

## Impact

- **修改**：`.gitignore`、`electron-builder.yml`；删除 `.npmrc`（个人镜像）与废弃的根 `vite.config.ts`
- **新增**：`LICENSE`、`README.md`、`docs/CONTRIBUTING.md`、`docs/SECURITY.md`、`.github/`（workflows、CODEOWNERS、PR/issue 模板）、仓库根 `AGENTS.md`
- **外部系统**：GitHub 仓库创建与分支保护（需要 GitHub 账号权限，任务中列出手动步骤）
- **依赖**：`vitest`（devDependency）、CI 使用 GitHub Actions
