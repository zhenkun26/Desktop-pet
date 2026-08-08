# 二次元桌宠 · Desktop-pet

[![CI](https://github.com/zhenkun26/Desktop-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/zhenkun26/Desktop-pet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron 39](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform macOS](https://img.shields.io/badge/Platform-macOS-lightgrey?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-spec--driven-blueviolet)](openspec/)
[![Tests](https://img.shields.io/badge/tests-81%20passed-brightgreen)](docs/ADVERSARIAL_REVIEW_REPORT.md)

> **一款基于 Electron 的二次元桌宠陪伴应用。** 以角色形象呈现的透明置顶桌宠，支持拖拽互动、AI 角色扮演对话、休息提醒与番茄钟；当前内置角色为胡桃，并提供多角色扩展框架（见「新增桌宠」）。
>
> **A transparent, always-on-top anime desktop pet companion built with Electron.** It presents an anime character as a draggable pet and offers AI roleplay chat, rest reminders, and a Pomodoro timer. The app currently ships with Hutao and provides a multi-character extension framework (see “Adding a New Pet”).

工程记录 / Engineering records: [技术决策](docs/DECISIONS.md) · [精选问题复盘](docs/PROBLEM_REVIEWS.md)

> ⚠️ **NOTICE / 版权声明**：胡桃立绘及角色形象等美术资源版权归 miHoYo（米哈游）所有，仅供个人学习与交流，禁止商用或二次分发；如需商用，请替换为自有素材。 / The Hutao artwork and related character assets are copyrighted by miHoYo and provided for personal learning only. Commercial use or redistribution is prohibited; replace the assets with your own for commercial use.

## 功能 / Features

- 🐱 **桌面宠物 / Desktop Pet**：透明置顶窗口，支持拖拽与点击交互、分时段问候、气泡对话与思考动画 / A transparent, always-on-top window with drag-and-drop and click interaction, time-based greetings, and speech-bubble and thinking animations
- 💬 **AI 角色对话 / AI Character Chat**：基于 DeepSeek 的角色扮演对话，SSE 流式输出，支持会话历史与角色设定自定义 / DeepSeek-driven roleplay chat with SSE streaming, conversation history, and customizable personas
- ⏰ **陪伴工具 / Companion Tools**：休息提醒（按累积活跃时长）与番茄钟（工作/休息状态机）/ Rest reminders based on accumulated active time, plus a Pomodoro timer with a work/break state machine

## 技术栈 / Tech Stack

| 领域 / Area | 技术 / Technology |
| --- | --- |
| 桌面框架 / Desktop | Electron 39 · TypeScript 5.7（strict）· electron-vite 2 |
| AI 对话 / AI Chat | DeepSeek API · SSE 流式 / streaming |
| 存储 / Storage | node:sqlite（内置，零原生依赖 / built-in, zero native deps）· safeStorage 钥匙串级加密 |
| 安全渲染 / Rendering | marked · DOMPurify（Markdown 安全渲染 / safe rendering） |

## 架构总览 / Architecture

![二次元桌宠架构总览 / Architecture Overview](docs/assets/architecture.png)

应用采用 Electron 三进程架构：渲染进程（桌宠窗口、聊天窗口）通过 preload 的 contextBridge 与主进程通信；主进程承载 ChatService（SSE 流式对话）、TimerService（休息提醒与番茄钟）与 PetRegistry（多角色框架）；本地持久化采用 node:sqlite 与 safeStorage 钥匙串级加密。

The application follows a three-process Electron architecture: renderer processes (pet window and chat window) communicate with the main process through preload's contextBridge; the main process hosts ChatService (SSE chat), TimerService (rest reminder and Pomodoro), and PetRegistry (multi-character framework); persistence uses node:sqlite and keychain-level safeStorage encryption.

## 环境要求 / Prerequisites

- macOS（以 Apple Silicon / arm64 为主）/ macOS (primarily Apple Silicon / arm64)
- Node.js ≥ 22.13（内置 `node:sqlite` 的版本要求 / required by the built-in `node:sqlite`）
- npm（随 Node.js 分发 / bundled with Node.js）

## 快速开始 / Quick Start

安装依赖并启动开发模式：

Install dependencies and launch the development mode:

```bash
npm install
npm run dev
```

## 配置 / Configuration

在聊天窗口的「API」页配置 DeepSeek API Key，密钥经系统钥匙串级加密保存。

Configure a DeepSeek API Key in the “API” tab of the chat window; the key is stored with OS keychain-level encryption.

## 开发 / Development

```bash
npm run dev            # 开发模式 / development mode
npm run build          # 构建到 out/ / build to out/
npm test               # 单元测试 / unit tests
npm run test:coverage  # 覆盖率报告 / coverage report
npm run build:mac      # 打包 macOS dmg / package macOS dmg
```

> 国内网络环境可自行配置 electron 镜像（如 `electron_mirror`），请勿将个人镜像配置提交到仓库。 / Users in China may configure an electron mirror locally (e.g. `electron_mirror`); personal mirror configuration must not be committed.

## 新增桌宠 / Adding a New Pet

多角色框架已就绪，新增桌宠角色无需修改业务逻辑，按以下四步接入：

The multi-character framework is ready. Adding a new pet does not require any business-logic changes — follow these four steps:

1. **素材 / Assets**：将角色立绘放入 `src/renderer/assets/<petId>.png`（例如 `ganyu.png`）/ Put the character artwork at `src/renderer/assets/<petId>.png` (e.g. `ganyu.png`)
2. **注册表登记 / Registration**：在 `src/main/services/pet/pet-registry.ts` 的 `PET_REGISTRY` 中登记一条 `PetDescriptor`（`petId` / `displayName` / `assetFileName` / `coreIdentity` / `speechStyle` / `greetings`）/ Register a `PetDescriptor` entry in `PET_REGISTRY`
3. **类型登记 / Types**：在 `src/shared/types.ts` 的 `PetId` 联合类型及 `PET_IDS` / `PET_LABELS` 中增加角色标识 / Add the pet id to the `PetId` union and to `PET_IDS` / `PET_LABELS`
4. **人设（可选）/ Persona (optional)**：如需独立默认人设，在 `personas.ts` 的 `BUILTIN_PERSONAS` 中增加条目 / Add an entry in `BUILTIN_PERSONAS` if a dedicated default persona is needed

接口契约（已全链路打通，无需改动）：

The API contract is fully wired and requires no changes:

```ts
window.desktopPet.listPets()      // Promise<PetDescriptor[]>  全部角色 / all pets
window.desktopPet.getPet(petId)   // Promise<PetDescriptor>    未注册抛错 / throws if unregistered
openChat({ petId, view })         // 直达指定角色的会话/人设/番茄钟 / open chat for a pet
```

- 会话与人设数据按 `pet_id` 自动隔离 / Conversations and personas are isolated by `pet_id`
- 素材经 `pet-assets.ts` 动态解析，打包后自动生成哈希 URL / Assets are resolved dynamically via `pet-assets.ts` with hashed URLs
- 桌宠窗口按 `config.petId` 渲染立绘与时段问候 / The pet window renders the artwork and greetings by `config.petId`

## 项目结构 / Project Structure

<details>
<summary>展开完整目录树（带双语注释）/ Expand the full tree with bilingual comments</summary>

```text
Desktop-pet/
├── .github/                          # GitHub 治理:CI、发版、模板 / governance: CI, release, templates
│   ├── workflows/
│   │   ├── ci.yml                    # CI:typecheck + build + test + gitleaks
│   │   └── release-mac.yml           # 手动触发 dmg 发版 / manual dmg release
│   ├── CODEOWNERS                    # 审查负责人 / code review owners
│   ├── PULL_REQUEST_TEMPLATE.md      # PR 模板 / PR template
│   ├── ruleset-main.json             # main 分支保护规则 / main branch ruleset
│   └── ISSUE_TEMPLATE/               # issue 模板 / issue templates
├── .codex/skills/                    # Codex OpenSpec 工作流 skills
├── .dockerignore                     # Docker 构建上下文排除 / Docker context excludes
├── .gitignore                        # git 忽略规则 / gitignore rules
├── AGENTS.md                         # 代理代码规范 / agent coding standards
├── CHANGELOG.md                      # 版本历史 / changelog
├── CONTRIBUTORS.md                   # 贡献者列表 / contributors
├── Dockerfile                        # 多阶段 CI 镜像(默认 runner 23MB)/ multi-stage CI image
├── LICENSE                           # MIT 许可 / MIT license
├── README.md                         # 项目说明(本文件)/ this file
├── deploy/                           # K8s 参考清单 / K8s reference manifests
├── docs/                             # 文档 / docs
│   ├── ADVERSARIAL_REVIEW_REPORT.md  # 对抗性审查报告 / adversarial review report
│   ├── EXECUTION_PLAN.md             # 推进方案 / execution plan
│   ├── CONTRIBUTING.md               # 贡献指南 / contributing guide
│   ├── SECURITY.md                   # 安全报告 / security reporting
│   └── assets/architecture.png       # 架构图 / architecture diagram
├── electron-builder.yml              # macOS 打包配置 / packaging config
├── electron.vite.config.ts           # electron-vite 构建配置 / build config
├── openspec/                         # OpenSpec 变更管理 / change management
│   ├── config.yaml                   # 项目上下文 / project context
│   ├── specs/                        # 主 specs / main specs
│   └── changes/                      # 进行中/已归档 change / active & archived changes
├── package.json                      # 依赖与脚本 / deps & scripts
├── package-lock.json                 # 依赖锁文件 / lockfile
├── pets-picture/                     # 立绘源图(版权归 miHoYo)/ source art (miHoYo)
├── resources/                        # 应用/托盘图标 / app & tray icons
├── scripts/
│   ├── smoke.sh                      # 默认 runner 产物校验 / artifact smoke (default)
│   └── smoke.mjs                     # runner-node 语法校验 / syntax check variant
├── src/                              # 源代码 / source
│   ├── main/                         # Electron 主进程 / main process
│   │   ├── index.ts                  # 入口:窗口/托盘/IPC / entry: windows, tray, IPC
│   │   ├── chat.ts                   # 聊天窗口单例 / chat window singleton
│   │   ├── icons.ts                  # 图标解析 / icon resolution
│   │   ├── store.ts                  # 配置持久化 / config persistence
│   │   ├── user-data-migration.ts    # userData 迁移 / userData migration
│   │   ├── services/
│   │   │   ├── chat/                 # AI 对话服务 / chat services
│   │   │   │   ├── chat-service.ts   # 生成状态机 / generation state machine
│   │   │   │   ├── chat-db.ts        # SQLite 存取与迁移 / SQLite + migration
│   │   │   │   ├── deepseek-client.ts# DeepSeek SSE 客户端(带超时)/ client w/ timeout
│   │   │   │   ├── sse.ts            # SSE 解析 / SSE parser
│   │   │   │   ├── secrets-store.ts  # API Key 加密存储 / encrypted key storage
│   │   │   │   ├── personas.ts       # 人设与清洗 / personas & sanitization
│   │   │   │   ├── prompt-builder.ts # 系统提示词 / system prompt builder
│   │   │   │   ├── event-emitter.ts  # 监听器隔离派发 / isolated event dispatch
│   │   │   │   ├── chat-input.ts     # 消息校验 / message validation
│   │   │   │   ├── api-key-utils.ts  # Key 校验与掩码 / key validation & masking
│   │   │   │   └── *.test.ts         # 单元测试 / unit tests
│   │   │   ├── pet/pet-registry.ts   # 角色注册表 / pet registry
│   │   │   └── timer/timer-service.ts# 休息提醒 + 番茄钟 / reminders + Pomodoro
│   ├── preload/index.ts              # contextBridge 桥 / contextBridge bridge
│   ├── renderer/                     # 渲染层 / renderer
│   │   ├── index.html / main.ts      # 桌宠窗口 / pet window
│   │   ├── chat.html / chat.ts       # 聊天窗口(四 Tab)/ chat window (4 tabs)
│   │   ├── pet.ts / bubble.ts        # 宠物控制器与气泡 / pet controller & bubble
│   │   ├── pet-assets.ts             # 素材动态解析 / dynamic asset resolution
│   │   └── style.css / chat.css      # 样式 / styles
│   └── shared/types.ts               # 类型契约 / type contracts
├── test/mocks/electron.ts            # electron mock(测试用)/ electron mock
├── tsconfig.json                     # TypeScript 配置 / TS config
└── vitest.config.mts                 # vitest 与覆盖率 / vitest & coverage
```

</details>

## OpenSpec 工作流 / OpenSpec Workflow

本仓库采用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的 spec-driven 流程管理变更：1) 以 `openspec new change <name>` 创建变更；2) 依次产出 proposal → specs → design → tasks 工件；3) 按 tasks 实现后，以 `openspec archive <change-name>` 归档。功能或修复类变更必须先建立 OpenSpec change（见「相关文档」）。

This repository manages changes with the [OpenSpec](https://github.com/Fission-AI/OpenSpec) spec-driven workflow: 1) create a change with `openspec new change <name>`; 2) produce the proposal → specs → design → tasks artifacts in order; 3) implement the tasks and archive the change with `openspec archive <change-name>`. Feature or fix changes must start with an OpenSpec change (see “Docs”).

## 相关文档 / Docs

- [CHANGELOG.md](CHANGELOG.md) — 版本历史 / Changelog
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — 贡献指南 / Contributing guide
- [docs/SECURITY.md](docs/SECURITY.md) — 安全报告 / Security reporting
- [docs/ADVERSARIAL_REVIEW_REPORT.md](docs/ADVERSARIAL_REVIEW_REPORT.md) — 对抗性审查报告 / Adversarial review report
- [deploy/README.md](deploy/README.md) — Kubernetes 参考部署 / K8s reference deployment

## License / 许可证

代码部分采用 MIT 许可证；美术资源版权归 miHoYo 所有，详见上方 NOTICE。

The code is licensed under MIT; art assets are copyrighted by miHoYo — see the NOTICE above.

## 致谢与贡献者 / Acknowledgments & Contributors

特别感谢 [kirineko](https://github.com/kirineko/) 的开源项目 [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet)：本项目的窗口/拖拽/气泡交互、流式聊天事件模型与工程结构参考了其架构与实现。

Special thanks to [kirineko](https://github.com/kirineko/) for the open-source [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet): this project references its architecture and implementation for window/drag/bubble interaction, the streaming chat event model, and the engineering structure.
