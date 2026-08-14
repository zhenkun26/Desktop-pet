# 二次元桌宠 · Desktop-pet

[![CI](https://github.com/zhenkun26/Desktop-pet/actions/workflows/ci.yml/badge.svg)](https://github.com/zhenkun26/Desktop-pet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron 39](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform macOS](https://img.shields.io/badge/Platform-macOS-lightgrey?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-spec--driven-blueviolet)](openspec/)
[![Tests](https://img.shields.io/badge/tests-109%20passed-brightgreen)](docs/ADVERSARIAL_REVIEW_REPORT.md)

> **一款基于 Electron 的二次元桌宠陪伴应用。** 以角色形象呈现的透明置顶桌宠，支持拖拽互动、AI 角色扮演对话、休息提醒与番茄钟；当前内置角色为胡桃，并提供多角色扩展框架（见「新增桌宠」）。
>
> **A transparent, always-on-top anime desktop pet companion built with Electron.** It presents an anime character as a draggable pet and offers AI roleplay chat, rest reminders, and a Pomodoro timer. The app currently ships with Hutao and provides a multi-character extension framework (see “Adding a New Pet”).

工程记录 / Engineering records: [技术决策](docs/DECISIONS.md) · [精选问题复盘](docs/PROBLEM_REVIEWS.md)

> ⚠️ **NOTICE / 版权声明**：胡桃立绘及角色形象等美术资源版权归 miHoYo（米哈游）所有，仅供个人学习与交流，禁止商用或二次分发；如需商用，请替换为自有素材。 / The Hutao artwork and related character assets are copyrighted by miHoYo and provided for personal learning only. Commercial use or redistribution is prohibited; replace the assets with your own for commercial use.

## 功能 / Features

- 🐱 **桌面宠物 / Desktop Pet**：透明置顶窗口，支持拖拽与点击交互、分时段问候、气泡对话与思考动画 / A transparent, always-on-top window with drag-and-drop and click interaction, time-based greetings, and speech-bubble and thinking animations
- 💬 **AI 角色对话 / AI Character Chat**：通过统一模型路由器接入 DeepSeek/OpenAI-compatible 供应商，支持 SSE 流式输出、会话历史与角色设定自定义 / Route chat through a unified model router to DeepSeek/OpenAI-compatible providers, with SSE streaming, conversation history, and customizable personas
- 🌐 **三语会话 / Three-Language Conversations**：支持中文 `zh-CN`、英文 `en-US`、日文 `ja-JP`；可在设置中选择新会话默认语言，并按会话切换后续回复语言 / Support Chinese `zh-CN`, English `en-US`, and Japanese `ja-JP`; choose a new-conversation default in settings and switch the language for subsequent replies per conversation
- 🔀 **多供应商、多模型、多 API Key / Multi-Provider, Multi-Model, Multi-Key**：按公司配置连接、端点、模型和独立或共享凭据，并在对话框下方选择当前模型 / Configure company-specific connections, endpoints, models, and isolated or shared credentials, then select the current model below the conversation
- ⏰ **陪伴工具 / Companion Tools**：休息提醒（按累积活跃时长）与番茄钟（工作/休息状态机）/ Rest reminders based on accumulated active time, plus a Pomodoro timer with a work/break state machine

## 新增能力 / What's New

### 三语会话回复 / Three-Language Responses

- 支持 `zh-CN`、`en-US`、`ja-JP` 三种回复语言，语言选择位于聊天窗口的「设置」页 / Supports `zh-CN`, `en-US`, and `ja-JP`; language controls are available in the chat window's “设置 / Settings” view.
- “新会话默认语言”和“当前会话语言”分别保存；切换会话不会互相污染 / The “new conversation default language” and “current conversation language” are stored separately, so switching conversations does not leak settings between them.
- 会话中途切换只影响切换完成后的新消息；正在生成的请求继续使用开始生成时的语言，既有消息不会被翻译或重写 / A mid-conversation switch affects only messages sent afterward; an in-progress request keeps its start-time language, and existing messages are never translated or rewritten.
- 这是提示词级语言约束，不接入 translate.js、第三方翻译服务或额外翻译接口 / This is a prompt-level language constraint; it does not use translate.js, a third-party translation service, or an extra translation API.

### 多供应商与多模型路由 / Multi-Provider and Multi-Model Routing

- 在「设置 → 多供应商模型」中管理供应商连接、Base URL、API Key、模型配置和默认模型 / Use “设置 → 多供应商模型 / Settings → Multi-Provider Models” to manage provider connections, Base URLs, API keys, model profiles, and the default model.
- 支持多个供应商连接、多个模型，以及同一供应商共享凭据或按模型隔离 API Key；首阶段通过 `openai-compatible` 适配器接入，DeepSeek 为默认兼容配置 / Supports multiple provider connections and models, with shared credentials per provider or isolated API keys per model; the first adapter uses `openai-compatible`, with DeepSeek as the default compatible configuration.
- 对话框只展示已启用且凭据可用的模型；切换模型只影响后续消息，进行中的流式请求使用发送时的模型/供应商/凭据快照 / The conversation selector shows only enabled models with available credentials; switching affects subsequent messages, while active streams use the model/provider/credential snapshot captured at send time.
- API Key 只在主进程通过 Electron `safeStorage` 保存和读取；渲染层、聊天记录和普通日志只接收凭据标识、掩码和状态 / API keys are stored and read only in the main process through Electron `safeStorage`; the renderer, chat history, and ordinary logs receive only credential identifiers, masks, and status.
- 旧版单个 `deepseek-api-key.bin` 和缺少模型字段的旧会话会迁移/解释为默认 DeepSeek 配置，不改写历史消息 / The legacy single `deepseek-api-key.bin` and conversations without model fields migrate to or resolve as the default DeepSeek configuration without rewriting historical messages.

## 技术栈 / Tech Stack

| 领域 / Area | 技术 / Technology |
| --- | --- |
| 桌面框架 / Desktop | Electron 39 · TypeScript 5.7（strict）· electron-vite 2 |
| AI 对话 / AI Chat | Model Router · OpenAI-compatible Provider Adapter · DeepSeek · SSE 流式 / streaming |
| 存储 / Storage | node:sqlite（内置，零原生依赖 / built-in, zero native deps）· safeStorage 钥匙串级加密 · credentialId 隔离 |
| 供应商边界 / Provider Boundary | 主进程凭据存储 / main-process secrets · API Key 掩码 / masking · HTTPS/受控 localhost 校验 / validation |
| 安全渲染 / Rendering | marked · DOMPurify（Markdown 安全渲染 / safe rendering） |

## 架构总览 / Architecture

![二次元桌宠架构总览 / Architecture Overview](docs/assets/architecture.png)

应用采用 Electron 三进程架构：渲染进程（桌宠窗口、聊天窗口）通过 preload 的 contextBridge 与主进程通信；主进程承载 ChatService（语言快照、模型路由与 SSE 流式对话）、ProviderRouter/Provider Adapter（供应商请求与统一流式事件）、TimerService（休息提醒与番茄钟）与 PetRegistry（多角色框架）；本地持久化采用 node:sqlite 与 safeStorage 钥匙串级加密。

The application follows a three-process Electron architecture: renderer processes (pet window and chat window) communicate with the main process through preload's contextBridge; the main process hosts ChatService (language snapshots, model routing, and SSE chat), ProviderRouter/Provider Adapter (provider requests and unified stream events), TimerService (rest reminder and Pomodoro), and PetRegistry (multi-character framework); persistence uses node:sqlite and keychain-level safeStorage encryption.

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

在聊天窗口的「设置」页可以完成以下配置：

1. **对话语言 / Conversation language**：设置新会话默认语言，或修改当前会话后续回复语言；支持中文、English、日本語。
2. **多供应商模型 / Multi-provider models**：新增供应商连接，填写受策略校验的 HTTPS（或显式允许的 localhost）端点；为连接保存 API Key，新增或停用模型，并选择默认模型。
3. **对话框模型 / Conversation model**：在对话框下方选择当前已启用且凭据可用的模型；生成开始后切换不会串改当前流。

API Key 由主进程通过 Electron `safeStorage` 加密保存，渲染层只显示掩码和可用状态；首次使用自定义供应商前需要确认消息数据路由。

The chat window's “设置 / Settings” view supports:

1. **Conversation language**: choose the default language for new conversations or the language for subsequent replies in the current conversation; Chinese, English, and Japanese are supported.
2. **Multi-provider models**: add a provider connection, enter a policy-validated HTTPS (or explicitly allowed localhost) endpoint, save its API key, add/disable models, and choose a default model.
3. **Conversation model**: select an enabled model with an available credential below the conversation; switching after generation starts cannot mix into the current stream.

API keys are encrypted by the main process through Electron `safeStorage`; the renderer shows only masks and availability status. First use of a custom provider requires confirmation of the message data route.

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
│   │   │   │   ├── provider-config.ts # 供应商/模型配置 / provider & model config
│   │   │   │   ├── provider-router.ts # 模型路由与适配器 / model routing & adapters
│   │   │   │   ├── redaction.ts       # 日志/错误脱敏 / log & error redaction
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
│   │   ├── language-settings.ts      # 三语设置边界 / language settings boundary
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
- [openspec/specs/conversation-response-language/spec.md](openspec/specs/conversation-response-language/spec.md) — 三语会话规范 / three-language conversation specification
- [openspec/specs/multi-provider-model-routing/spec.md](openspec/specs/multi-provider-model-routing/spec.md) — 多供应商多模型路由规范 / multi-provider, multi-model routing specification

## License / 许可证

代码部分采用 MIT 许可证；美术资源版权归 miHoYo 所有，详见上方 NOTICE。

The code is licensed under MIT; art assets are copyrighted by miHoYo — see the NOTICE above.

## 致谢与贡献者 / Acknowledgments & Contributors

特别感谢 [kirineko](https://github.com/kirineko/) 的开源项目 [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet)：本项目的窗口/拖拽/气泡交互、流式聊天事件模型与工程结构参考了其架构与实现。

Special thanks to [kirineko](https://github.com/kirineko/) for the open-source [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet): this project references its architecture and implementation for window/drag/bubble interaction, the streaming chat event model, and the engineering structure.

> 本项目由 Vibe Coding 辅助实现落地。Built with Vibe Coding.
