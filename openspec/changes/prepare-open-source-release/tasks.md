## 1. 仓库卫生

- [x] 1.1 `.gitignore` 补充 `out/`、`release/`，并清理已删除的 `src-tauri` 残留项
- [x] 1.2 `electron-builder.yml` 移除 `asarUnpack: node_modules/better-sqlite3/**` 残留
- [x] 1.3 处理 `.npmrc`：删除个人 electron 镜像配置（README 注明国内用户自行配置）
- [x] 1.4 全仓库敏感信息扫描：无真实密钥（gitleaks 未本地安装，改用等效正则基线扫描；gitleaks 由 CI 持续执行）
- [x] 1.5 删除废弃的根 `vite.config.ts`（引用已删除的旧 `src/index.html` 路径，electron-vite 使用 `electron.vite.config.ts`）

## 2. 开源文档

- [x] 2.1 新增 `LICENSE`（MIT，与 package.json 一致）
- [x] 2.2 新增 `README.md`：项目介绍、快速开始、开发指南、OpenSpec 工作流、NOTICE（胡桃素材版权归 miHoYo）
- [x] 2.3 新增 `docs/CONTRIBUTING.md`：OpenSpec 优先、conventional commits、代码规范、PR 流程
- [x] 2.4 新增 `docs/SECURITY.md`（安全报告渠道）
- [x] 2.5 新增仓库根 `AGENTS.md`（当前 Codex 自定义规范入库）
- [x] 2.6 新增 `.github/CODEOWNERS` 与 PR / issue 模板

## 3. CI 与测试基建

- [x] 3.1 `package.json` vitest devDependency 与 `test` 脚本（由 `improve-listener-error-observability` 引入，已复用）
- [x] 3.2 新增 `.github/workflows/ci.yml`：typecheck + build + `vitest run` + gitleaks 扫描
- [x] 3.3 新增 `.github/workflows/release-mac.yml`（`workflow_dispatch` 手动触发 dmg 构建）

## 4. GitHub 上线（手动步骤，需账号权限）

- [ ] 4.1 创建公开仓库并推送（记录仓库 URL）
- [ ] 4.2 开启 main 分支保护：禁直推、PR 要求 1 个 approve、状态检查必过
- [ ] 4.3 验证 CI 首次运行通过；按需配置 GitHub Secret
- [ ] 4.4 发布清单：下次发版 2.0.2 时同步 package.json / 聊天窗口标题 / CHANGELOG（本变更不发版）
