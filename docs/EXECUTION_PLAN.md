# 剩余待办推进方案(确认后执行)

> 覆盖范围:三个 change 实机冒烟 · GitHub 建仓/推送/分支保护 · OrbStack + Docker 实测。
> 执行约定:每完成一项立即更新对应 `tasks.md` 勾选;遇到失败先暂停修复再重测,不强行推进。

## Phase 0 — 前置状态检查(自动化,约 2 分钟)

| 步骤 | 命令 | 通过标准 |
|------|------|----------|
| 0.1 | `npm test` + `npx tsc --noEmit` | 76/76 通过,0 错误 |
| 0.2 | `npm run build` | 构建成功 |
| 0.3 | `openspec validate --all` | 7/7 通过 |
| 0.4 | 敏感信息扫描(rg 密钥/私钥模式) | 无真实密钥 |
| 0.5 | `git status` 核对 | 与预期文件一致,无意外改动 |

基线不干净则先处理再进入 Phase 1。

## Phase 1 — 实机冒烟(三个 change,需要你本机配合)

我会以提权方式运行 `npm run dev`(Electron GUI),并全程盯终端日志;你在应用里执行交互步骤,按下面清单逐项确认。

### 1.1 启动与基线

```bash
npm run dev
```

预期:桌宠窗口出现,终端出现 `[timer] 计时服务已启动`、`[chat] 阶段:` 等日志,无未捕获异常、无 `[chat] 事件监听器异常`。

### 1.2 Change A:improve-listener-error-observability(tasks 3.2)

| 步骤 | 操作 | 预期 |
|------|------|------|
| A1 | 右键桌宠 →「和我聊天」,发送一条消息 | 思考气泡出现,流式输出正常,`done` 后消息落库 |
| A2 | 生成过程中关闭聊天窗口 | 生成停止(by design),终端无未捕获异常 |
| A3 | 重新打开聊天窗口查看该会话 | 消息显示「已停止」状态,重载正常 |
| A4 | 检查终端日志 | 无 `事件监听器异常被隔离`、无 `onListenerError 钩子异常` |

通过标准:A1–A4 全部符合 → 勾选 3.2。

### 1.3 Change B:multi-character-framework(tasks 4.2 / 4.3)

| 步骤 | 操作 | 预期 |
|------|------|------|
| B1 | 聊天窗口「角色设定」页修改称呼/关系并保存 | 保存成功,刷新后保留 |
| B2 | 会话抽屉新建/重命名/删除会话 | 列表与预览正确;删除前出现确认弹窗 |
| B3 | 发送消息完成一轮流式对话 | 头像/标题/占位符均为「胡桃」,消息头像正常显示 |
| B4 | 时段问候 | 启动后 1.2s 出现对应时段问候气泡 |
| B5 | 打包回归 | `npm run build:mac` 成功;打开 dmg 应用,素材/头像/标题正常(重点验证 `sandbox:true` 打包兼容) |
| B6 | 未知 petId 回归 | DevTools 控制台执行 `await window.desktopPet.getPet('nope')` 与 `await window.desktopPet.listConversations('nope')`,均 reject 且错误含「未注册的角色」;检查 `chat.db` 无脏数据 |

通过标准:B1–B6 全部符合 → 勾选 4.2 / 4.3。

> B6 需要打开 DevTools:开发模式下在聊天窗口按 `Cmd+Option+I` 即可。

### 1.4 顺带覆盖(不新增任务)

`fix-stream-bubble-disconnected` 的 5.1–5.4(思考气泡不闪失、切换会话、停止生成、菜单互不干扰)与 A1–A3 天然重叠,冒烟时一并确认。

## Phase 2 — GitHub 建仓/推送/分支保护

### 2.1 认证

```bash
gh auth status
```

未登录则执行 `gh auth login`(浏览器授权,需要你操作)。

### 2.2 提交策略(需要你选,见文末决策点)

当前仓库只有 1 个初始提交,重构与本次全部改动均未提交。建议:

- **方案 A(推荐,2 个提交)**:先 `feat` 提交全部代码/配置/测试(重构基线 + 三个 change 实现 + 审查修复),再 `docs` 提交 OpenSpec/开源文档;
- **方案 B(4 个提交)**:重构基线 / 三个 change 实现 / 开源发布准备 / 审查修复。注意 `src/` 下重构基线与我们后续改动重叠,无法做到逐文件完美切分,历史可读性收益有限。

提交前执行:`git diff --check` + 敏感信息扫描复检。

### 2.3 建仓与推送(public)

```bash
git checkout -b codex/electron-hardening
# 按选定方案分次 git add + git commit
gh repo create DeskPet --public --source . --remote origin --push
gh pr create --title "feat: Electron 重构落地 + 多角色框架 + 生产级加固" --body "见 docs/EXECUTION_PLAN.md / docs/ADVERSARIAL_REVIEW_REPORT.md"
```

### 2.4 CI 首次验证

PR 触发 `.github/workflows/ci.yml`(typecheck + build + vitest + gitleaks)。首次运行若失败(如锁文件/Electron 下载),我迭代修复;通过后合并。

### 2.5 main 保护(Ruleset,需要你决策)

推荐用 GitHub Ruleset(替代旧 Branch Protection):

```bash
gh api repos/zhenkun26/DeskPet/rulesets -f name=protect-main \
  -f target=branch -f enforcement=active \
  -f 'conditions[0]=...'   # 交互确认后我用完整 JSON 创建
```

规则建议:禁直推 main、必须 PR、状态检查必过、PR 需 1 个 approval。

> **solo 仓库注意**:GitHub 不允许作者给自己的 PR 点 approve,1-approval 规则会让你无法自助合并(需管理员绕过或第二个账号)。可选:仅「必须 PR + 状态检查」,approval 留给协作者加入后再开启。

### 2.6 合并后

- 验证 main 上 CI 通过;
- 按需开启 GitHub Secret(如推送镜像用 token);
- 记录仓库 URL 到 `prepare-open-source-release/tasks.md` 4.1–4.3 并勾选。

## Phase 3 — OrbStack + Docker 实测

### 3.1 启动 daemon

```bash
open -a OrbStack        # 或你手动打开 OrbStack
docker info             # 确认可用
```

### 3.2 构建与验证

```bash
docker build --target runner -t hutao-pet-ci:latest .
docker run --rm hutao-pet-ci:latest          # 预期输出 [smoke] 构建产物校验通过
docker images hutao-pet-ci                    # 记录 SIZE
# 可选:带 Node 运行时做完整语法校验(体积较大)
docker build --target runner-node -t hutao-pet-ci-node:latest .
docker run --rm hutao-pet-ci-node:latest
```

### 3.3 体积验收与瘦身预案

- **实测结果**:默认 runner = alpine + `smoke.sh`,SIZE **23.3MB**(<100MB 达成);`runner-node` 变体(完整 `node --check` 语法校验)为 **201MB**——Node 二进制本身 120MB,带 Node 运行时无法 <100MB,属物理下限;
- 默认 `docker build` 产出 slim runner;需要语法级校验时构建 `runner-node`;
- 可选:推送 `docker push <YOUR_REGISTRY>/hutao-pet-ci:latest`。

## Phase 4 — 收尾

1. 更新三个 change 的 tasks 勾选,`openspec validate --all` 复验;
2. 归档已完成 change(`improve-listener-error-observability`、`multi-character-framework`、`prepare-open-source-release`),`openspec archive` 会同步主 specs;
3. 确认 `fix-stream-bubble-disconnected`(冒烟通过后归档)与 `refactor-tauri-to-electron`(7.2/7.3 实机确认后归档)的状态;
4. 若你要发版:按 2.0.2 清单同步 package.json / 聊天窗口标题(已是 `app.getVersion()`)/ CHANGELOG,并 `npm run build:mac`;
5. 汇报最终状态(测试、覆盖率、镜像体积、仓库地址、保护规则)。

## 风险与回滚

| 风险 | 预案 |
|------|------|
| 冒烟发现 bug | 暂停 → 修复 → 重测,不回退已勾选任务 |
| `sandbox:true` 打包兼容问题 | 回退 `webPreferences.sandbox` 或调整 preload,重测打包 |
| CI 首次失败 | 迭代修复,不绕过检查 |
| push 后发现严重问题 | 新 PR 修复;main 禁 force push |
| Docker 体积超标 | 按 3.3 瘦身预案 |
| GitHub 权限/二要素 | `gh auth login` 交互完成;授权类步骤列明等待你操作 |

## 需要你确认的决策点

1. **提交粒度**:方案 A(2 提交,推荐)还是方案 B(4 提交)?
2. **分支保护**:1 approval(需第二账号/管理员)还是仅「PR + 状态检查」(solo 推荐)?
3. **仓库名**:已确定为 `DeskPet`(公开)
4. **发版**:Phase 4 是否顺带发版 2.0.2?
5. **OrbStack**:授权我 `open -a OrbStack` 启动,还是你手动启动?
