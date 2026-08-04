# 胡桃桌宠 (DeskPet)

[![CI](https://github.com/zhenkun26/DeskPet/actions/workflows/ci.yml/badge.svg)](https://github.com/zhenkun26/DeskPet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron 39](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform macOS](https://img.shields.io/badge/Platform-macOS-lightgrey?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-spec--driven-blueviolet)](openspec/)
[![Tests](https://img.shields.io/badge/tests-76%20passed-brightgreen)](docs/ADVERSARIAL_REVIEW_REPORT.md)

一个 Electron 桌面宠物陪伴应用：以胡桃为形象的透明置顶桌宠，支持拖拽互动、AI 角色扮演对话、休息提醒与番茄钟。

> ⚠️ **NOTICE（版权声明）**：本仓库中的胡桃立绘、角色形象等美术资源版权归 miHoYo（米哈游）所有，仅用于个人学习与交流，请勿用于商业用途或二次分发。如需商用，请替换为自有素材。

## 功能

- 🐱 **桌面宠物**：透明置顶窗口，可拖拽、点击互动，分时段问候，气泡说话与思考动画
- 💬 **AI 角色对话**：DeepSeek 驱动的胡桃人设扮演，SSE 流式输出，支持会话历史与角色设定自定义
- ⏰ **陪伴工具**：休息提醒（累积活跃时长）+ 番茄钟（工作/休息状态机）

## 技术栈

- Electron 39 + TypeScript 5.7
- electron-vite 2（main / preload / renderer 三端构建）
- DeepSeek API（SSE 流式对话）
- node:sqlite（Electron 内置，零原生依赖）
- marked + DOMPurify（Markdown 安全渲染）

## 快速开始

```bash
npm install
npm run dev
```

首次使用请在聊天窗口的「API」页配置 DeepSeek API Key（使用系统钥匙串级加密保存）。

## 开发

```bash
npm run dev        # 开发模式
npm run build      # 构建到 out/
npm test           # 单元测试（vitest）
npm run build:mac  # 打包 macOS dmg（electron-builder）
```

> 国内网络环境可自行配置 electron 镜像（如 `electron_mirror`），但请勿将个人镜像配置提交到仓库。

## Contents(项目结构)

> 完整 tree(排除 `node_modules/`、`out/`、`release/`、`dist/`、`coverage/` 等生成目录);行尾注释说明每个文件/目录的作用。

```
DeskPet/
├── .github/                          # GitHub 治理:CI、发版工作流、贡献模板
│   ├── workflows/
│   │   ├── ci.yml                    # CI:类型检查 + 构建 + 测试 + gitleaks 密钥扫描
│   │   └── release-mac.yml           # 手动触发的 macOS dmg 发版工作流
│   ├── CODEOWNERS                    # 代码审查负责人(当前 @yuzheng)
│   ├── PULL_REQUEST_TEMPLATE.md      # PR 模板:关联 OpenSpec change + 自检清单
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md             # Bug 报告模板
│       └── feature_request.md        # 功能建议模板(引导先开 OpenSpec change)
├── .codex/skills/                    # Codex 的 OpenSpec 工作流 skills(6 个)
├── .dockerignore                     # Docker 构建上下文排除清单
├── .gitignore                        # git 忽略规则(依赖/构建产物/覆盖率)
├── AGENTS.md                         # 代理(AI/协作者)代码规范,公共约束
├── CHANGELOG.md                      # 版本变更历史(Keep a Changelog)
├── Dockerfile                        # 生产级多阶段 CI 镜像(非 root,目标 <100MB)
├── LICENSE                           # MIT 开源许可
├── README.md                         # 项目说明(本文件)
├── deploy/                           # K8s 参考清单(未来服务端伴生 API 用)
│   ├── 00-namespace.yaml             # 命名空间
│   ├── 01-configmap.yaml             # 非敏感环境配置
│   ├── 02-secret.yaml                # 敏感配置 Base64 占位符
│   ├── 03-deployment.yaml            # Deployment(资源限额 + readiness/liveness 探针)
│   ├── 04-service.yaml               # ClusterIP Service
│   ├── 05-ingress.yaml               # Ingress 路径规则
│   ├── 06-hpa.yaml                   # 水平自动伸缩(CPU/内存)
│   ├── 07-pdb.yaml                   # Pod 中断预算
│   └── README.md                     # 部署顺序与 Secret 修改指南
├── docs/                             # 文档
│   ├── ADVERSARIAL_REVIEW_REPORT.md  # 对抗性生产级审查与验收报告
│   ├── EXECUTION_PLAN.md             # 剩余待办推进方案(冒烟/GitHub/Docker)
│   ├── CONTRIBUTING.md               # 贡献指南(OpenSpec 优先)
│   └── SECURITY.md                   # 安全报告渠道与约定
├── electron-builder.yml              # macOS 打包配置(dmg)
├── electron.vite.config.ts           # electron-vite 三端构建配置
├── openspec/                         # OpenSpec 变更管理(spec-driven)
│   ├── config.yaml                   # 项目上下文与工件规则
│   ├── specs/                        # 主 specs(归档后同步)
│   └── changes/                      # 进行中/已归档 change
├── package.json                      # 依赖与脚本入口
├── package-lock.json                 # 依赖锁文件
├── pets-picture/                     # 立绘源图(版权归 miHoYo,仅供学习)
├── resources/                        # 应用图标 / 托盘图标
├── scripts/
│   └── smoke.mjs                     # Docker 镜像产物校验脚本(HEALTHCHECK 用)
├── src/                              # 源代码
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 应用入口:窗口/托盘/IPC/生命周期
│   │   ├── chat.ts                   # 聊天窗口单例与流事件转发
│   │   ├── icons.ts                  # 应用/托盘图标解析
│   │   ├── store.ts                  # config.json 持久化
│   │   ├── services/
│   │   │   ├── chat/                 # AI 对话服务
│   │   │   │   ├── chat-service.ts   # 生成状态机(前置落库/流式/取消)
│   │   │   │   ├── chat-db.ts        # SQLite 存取与旧数据迁移
│   │   │   │   ├── deepseek-client.ts# DeepSeek SSE 客户端(带空闲超时)
│   │   │   │   ├── sse.ts            # SSE 流解析
│   │   │   │   ├── secrets-store.ts  # API Key safeStorage 加密存储
│   │   │   │   ├── personas.ts       # 内置人设与字段清洗
│   │   │   │   ├── prompt-builder.ts # 系统提示词构建
│   │   │   │   ├── event-emitter.ts  # 监听器隔离派发(safeEmit)
│   │   │   │   ├── chat-input.ts     # 消息内容校验
│   │   │   │   ├── api-key-utils.ts  # Key 校验与掩码
│   │   │   │   └── *.test.ts         # 各服务单元测试
│   │   │   ├── pet/pet-registry.ts   # 角色注册表(多角色框架)
│   │   │   └── timer/timer-service.ts# 休息提醒 + 番茄钟(含配置归一化)
│   ├── preload/index.ts              # contextBridge API 桥(透传 petId)
│   ├── renderer/                     # 渲染层
│   │   ├── index.html / main.ts      # 桌宠窗口入口(拖拽/问候/气泡)
│   │   ├── chat.html / chat.ts       # 聊天窗口(对话/角色/番茄钟/API 四 Tab)
│   │   ├── pet.ts / bubble.ts        # 宠物控制器与气泡管理
│   │   ├── pet-assets.ts             # 素材动态解析(import.meta.glob)
│   │   └── style.css / chat.css      # 样式
│   └── shared/types.ts               # 全链路类型契约(IPC/事件/角色/计时)
├── test/mocks/electron.ts            # 单元测试的 electron mock(临时 userData)
├── tsconfig.json                     # TypeScript 严格模式配置
└── vitest.config.mts                 # vitest 与覆盖率配置
```

## OpenSpec 工作流

本仓库使用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的 spec-driven 流程管理变更：

1. `openspec new change <name>` 创建变更
2. 依次产出 proposal → specs → design → tasks
3. 按 tasks 实现，完成后 `openspec archive <change-name>` 归档

功能或修复类变更必须先生成 OpenSpec change（见 docs/CONTRIBUTING.md）。

## License

MIT（代码部分）。美术资源版权归 miHoYo 所有，详见上方 NOTICE。

## 致谢

特别感谢 [kirineko](https://github.com/kirineko/) 的开源项目
[kirineko/desktop-pet](https://github.com/kirineko/desktop-pet)——本项目的窗口/拖拽/气泡交互、
流式聊天事件模型与工程结构参考了它的架构与实现。
