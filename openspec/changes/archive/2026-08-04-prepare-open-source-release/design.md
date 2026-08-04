## Context

仓库当前状态：无 remote、无 README/LICENSE/CONTRIBUTING/SECURITY、无测试与 CI、`.gitignore` 未覆盖 `out/`/`release/`、`electron-builder.yml` 残留 `better-sqlite3` asarUnpack、`.npmrc` 含个人 electron 镜像。详见 proposal.md — Why。

## Goals / Non-Goals

**Goals:**
- 公开前仓库卫生：构建产物不入库、无个人配置、无敏感信息
- 可运行的 CI：类型检查、构建、测试、敏感扫描
- 清晰的贡献与审查机制：PR 模板、CODEOWNERS、分支保护、OpenSpec 优先
- 版权风险显性化（胡桃素材归属 miHoYo）

**Non-Goals:**
- 本变更不发版（版本同步列在 tasks 的发布清单中）
- 不承诺 CI 在首次 push 前完全跑通（需要 GitHub 权限，列入手动步骤）

## Decisions

**D1. 仓库布局**
`LICENSE`（MIT，与 package.json 一致）、`README.md`、`docs/CONTRIBUTING.md`、`docs/SECURITY.md`、`AGENTS.md`（入库 Codex 规范）、`.github/workflows/ci.yml`、`.github/workflows/release-mac.yml`（`workflow_dispatch` 手动触发）、`.github/CODEOWNERS`、PR/issue 模板。

**D2. CI 内容**
`ci.yml`：`npm ci` → `tsc --noEmit` → `npm run build` → `vitest run`（配合 change `improve-listener-error-observability` 首批测试）→ gitleaks 扫描。备选：不引入测试 CI 直到有测试——与本仓库 AGENTS.md"先测试后交付"要求冲突，否决。

**D3. 敏感信息与个人配置**
gitleaks 默认规则进 CI，本地先扫一遍基线（当前无 key）；`.npmrc` 删除个人镜像或改为官方源，避免影响他人构建。备选：保留镜像并注明——公开仓库中不可控，否决。

**D4. 分支保护与上线流程**
先本地完成全部卫生改动并自检，再创建公开仓库、推送、在 GitHub 开启 main 保护（禁直推、PR + 1 approve + 状态检查必过）。`gh` CLI 可用则脚本化，否则记入手动清单。

**D5. 版权声明**
README 增加 NOTICE 段落：胡桃立绘/美术资源版权归 miHoYo，本项目仅用于个人学习；如需商用或分发请替换素材。

## Risks / Trade-offs

- [公开后个人配置/密钥泄露] → 发布前 gitleaks 扫描 + 人工核对 + CI 持续扫描
- [CI 首次配置需 GitHub 权限] → 上线步骤记入 tasks，允许分两步执行（先本地自检，后开仓库）
- [美术资源版权纠纷] → README 声明 + 提供替换素材的指引
- [删除 .npmrc 影响国内构建] → 文档注明镜像配置方式，由用户自行添加

## Migration Plan

1. 本地：仓库卫生 + 文档 + CI 文件全部落地并自检
2. 上线：创建 GitHub 仓库 → push → 开启分支保护 → 验证 CI 通过
3. 回滚：分支保护可随时调整；发布前发现问题则暂缓 push，均为可逆操作
