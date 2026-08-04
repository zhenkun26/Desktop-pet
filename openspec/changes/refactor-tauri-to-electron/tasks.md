# tasks.md — refactor-tauri-to-electron

## 1. 工程骨架
- [x] 1.1 重写 `package.json`（electron / electron-vite / electron-builder / marked / dompurify），版本 2.0.0（注：better-sqlite3 实施中改为 Node 内置 `node:sqlite`，见 3.1）
- [x] 1.2 新增 `electron.vite.config.ts`、`electron-builder.yml`、`tsconfig.json`、`.npmrc`（国内镜像）
- [x] 1.3 删除 `src-tauri/` 与旧 `src/`，保留 `pets-picture/`、`openspec/`、`CHANGELOG.md`（立绘/图标迁移至 `src/renderer/assets/` 与 `resources/`）

## 2. 主进程
- [x] 2.1 `src/shared/types.ts`：PetConfig / ChatStreamEvent（含 assistantMessageId + cancelled）/ TimerConfig / TimerStatus / 事件契约
- [x] 2.2 `src/main/store.ts` + `icons.ts`：config.json 持久化、托盘/应用图标
- [x] 2.3 `src/main/index.ts`：桌宠窗口（200×300 透明置顶）、托盘菜单、拖拽 move-window（不钳制）、show 时 clamp 回收、IPC 注册
- [x] 2.4 `src/main/chat.ts`：聊天窗口单例、onChatStream → webContents.send 定向转发、关闭窗口时停止生成

## 3. 聊天服务
- [x] 3.1 `services/chat/chat-db.ts`：schema（conversations/messages/persona_profiles，status 状态机）。实施变更：better-sqlite3 在本机 node-gyp 编译失败（Python 3.13 移除 distutils），改用 Electron 39 内置 Node 的 `node:sqlite`，零原生依赖、免编译
- [x] 3.2 数据迁移：检测旧 Tauri chat.db，ATTACH 复制，秒→毫秒 ×1000，status 映射 ok→complete（旧库只读）
- [x] 3.3 `services/chat/deepseek-client.ts` + `sse.ts`：DeepSeek SSE 流式客户端（deepseek-v4-flash，非思考模式）
- [x] 3.4 `services/chat/secrets-store.ts`：safeStorage API Key 存取/删除/测试
- [x] 3.5 `services/chat/personas.ts` + `prompt-builder.ts`：胡桃人设与 prompt 构建（含用户可配置字段）
- [x] 3.6 `services/chat/chat-service.ts`：前置落库状态机、invoke 挂到完成、AbortController 停止、listener emit

## 4. 计时服务
- [x] 4.1 `services/timer/timer-service.ts`：休息提醒（默认 45 分钟）+ 番茄钟（25/5），tick/done 事件投递两窗口

## 5. Preload
- [x] 5.1 `src/preload/index.ts`：contextBridge 暴露 `window.desktopPet` 全部 API（invoke 封装 + on* 事件订阅返回取消函数）

## 6. 渲染层
- [x] 6.1 桌宠窗口 `index.html` / `style.css`：flex 列布局，气泡文档流，立绘 128×128，4 态动效
- [x] 6.2 `pet.ts` / `bubble.ts` / `main.ts`：拖拽/单击弹跳/右键菜单、分段轮播（每段 2s 起步、超 10 字每字 +120ms、封顶 4s）、时段问候
- [x] 6.3 聊天窗口 `chat.html` / `chat.css` / `chat.ts`：保留胡桃主题 UI（对话/角色/番茄/API 四 Tab、陪伴记录抽屉、思考轮播气泡），适配新 API 契约：发送即建思考气泡 → delta 流式追加 → done/cancelled/error/invoke resolve 多重完结路径幂等统一为重载消息

## 7. 验证与发版
- [x] 7.1 `npm install`（node:sqlite 无需 ABI 重建）+ `npm run build` + `npx tsc --noEmit` 通过
- [ ] 7.2 冒烟验证（待用户实机确认）：发送消息验证「思考→输出」单气泡切换、生成中切换会话、拖拽出屏、气泡多行不裁切
- [ ] 7.3 数据迁移验证（待用户实机确认）：旧 chat.db 会话出现在新应用
- [x] 7.4 更新 CHANGELOG v2.0.0，删除旧版构建产物（`src-tauri/target` 随目录删除，/Applications 无旧版残留），`npm run build:mac` 输出 `release/胡桃桌宠-2.0.0-arm64.dmg` + `release/mac-arm64/胡桃桌宠.app`
- [x] 7.5 同步 OpenSpec 文档：design.md / proposal.md 中 better-sqlite3 描述改为 node:sqlite、修正计时器 ticker 描述（与 3.1 实施变更一致）
- [ ] 7.6 清理 electron-builder.yml 中 `asarUnpack: node_modules/better-sqlite3/**` 残留（已无原生依赖，无需 asarUnpack）
