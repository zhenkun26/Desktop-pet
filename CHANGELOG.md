# Changelog

本文件记录「胡桃桌宠」(Hutao Desktop Pet) 项目的版本变更历史。

- 遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定
- 采用 [语义化版本](https://semver.org/lang/zh-CN/) 2.0.0
- 版本内容来源：从 `openspec/changes/<change-name>/proposal.md` 与 `tasks.md` 提取，发版时整合写入

## [Unreleased]

<!-- 下次发版前在此段落累积未发布的变更。发版时将本段落内容剪切到新版本号段落下，并清空本段落。 -->

### Fixed

- **DeepSeek 请求无限挂起**：流式对话增加 60s 空闲超时、API Key 测试增加 15s 超时，新增 `timeout` 错误码；杜绝外部服务悬挂导致 UI 卡死
- **会话误删无确认**：删除会话前增加确认弹窗，避免误触永久丢失聊天记录
- **计时器配置零校验**：`update-timer-config` 参数经归一化收敛（非法值回退默认、越界值钳制到合法区间），修复 0 秒配置导致的番茄钟状态机异常翻转
- **Electron 沙箱关闭**：桌宠与聊天窗口统一开启 `sandbox`，渲染层被攻破时不再拥有完整 Node 权限
- **静默降级**：API Key 文件损坏、配置解析失败时记录日志，不再无痕回退
- **人设字段空串**：`sanitizePersonaFields` 对 trim 后为空的字段回退默认值

### Changed

- **多角色框架**：`petId` 全链路透传（渲染层 → preload → IPC → 服务），新增 `pet-registry` 角色注册表（展示名/人设/素材/问候语单一来源），渲染层角色上下文动态化；当前仅注册胡桃一个实例
- **事件监听器异常可见性**：`safeEmit` 逐监听器隔离派发，异常记录事件通道/监听器名/错误详情；新增可选 `onListenerError` 订阅钩子
- **流式性能**：数据库落库（120ms 合并）与 Markdown 渲染（requestAnimationFrame 合并）双端节流，长回复不再逐 token 全量写库/重解析
- **数据库预热**：SQLite 与旧数据迁移提前到窗口显示前执行，避免首次聊天冻结主进程
- **工程化**：vitest 测试基建（12 个测试文件 / 76 个用例，核心服务行覆盖率 82%）、GitHub Actions CI（typecheck + build + test + gitleaks）、多阶段 Docker CI 镜像（<100MB）、`deploy/` K8s 参考清单、开源文档（LICENSE / README / CONTRIBUTING / SECURITY / AGENTS）
- **版本标识**：聊天窗口标题改用 `app.getVersion()`，消除版本号硬编码漂移

## [2.0.1] - 2026-07-30

修复对话面板内胡桃头像无法显示的问题；底部 Tab 增加图标，「番茄」更名「⏰ 时钟」。

### Fixed

- **对话面板内胡桃头像显示为裂图**：vite 构建会把 HTML 中引用的静态资源改写为带哈希的文件名（`hutao-CrrO6MKU.png`），但 JS 字符串里的 `'./assets/hutao.png'` 字面量不会被改写——打包后该路径不存在。修复：`chat.ts` 改为 `import hutaoAvatarUrl from './assets/hutao.png'` 由 vite 解析为正确 URL，统一用于消息行头像、思考气泡头像、流式气泡头像与空状态头像（顶栏头像走 HTML `<img>` 本已正常）；新增 `src/renderer/env.d.ts` 引入 vite/client 类型

### Changed

- **底部 Tab 增加图标**（参照旧 Tauri 版风格）：💬 对话 / Q 版胡桃圆形头像 + 角色 / ⏰ 时钟（原「番茄」更名）/ 🌸 梅花 + API；`.tab` 改为 flex 居中对齐，新增 `.tab-icon` / `.tab-avatar` 样式
- **描述文案校对**：`package.json` version/description、聊天窗口标题同步为 v2.0.1
- **发版封装**：清理 2.0.0 旧构建产物，重新 `npm run build:mac` 输出 v2.0.1 `.app` / `.dmg`

## [2.0.0] - 2026-07-30

整体架构重构：Tauri v2 + Rust → Electron 39 + TypeScript（架构参照 [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet)）。1.5.1–1.7.0 连续五轮增量修补均未根治「对话卡在思考中」与「气泡边界裁切」，确认为框架级问题后放弃修补、按参考项目重写。

### Changed（重构）

- **「对话卡在思考中」根治——事件模型重写**：根因是 Tauri spawn 任务中 emit 的事件会被运行时缓冲/丢失（1.5.1–1.7.0 五轮补丁均围绕此表象）。按参考项目的免疫机制重写：
  - **数据库为单一事实来源**：assistant 消息在生成 start 时即落库（`status='streaming'`），每个 delta 同步 `updateMessage` 落库，终结时更新为 `complete` / `error` / `cancelled`——无论事件是否送达，历史记录永远完整
  - **invoke 挂到生成终结才返回**：`sendChatMessage` 的 IPC invoke 直到 done / error / cancelled 才 resolve，完成信号不依赖事件通道；渲染层「事件终结 + invoke 返回」双路径幂等走完结（重载消息、恢复 UI），永久卡死在结构上不可能发生
  - **`webContents.send` 定向投递**：聊天事件直发聊天窗口，业务事件（busy/idle）直发桌宠窗口，替代 Tauri 全局广播
  - **前端删繁就简**：移除 1.5.x–1.7.0 累积的 seq 去重集合、自愈看门狗、过期事件拦截等补丁代码——新架构下不再需要
- **气泡边界裁切根治——布局重写**：旧版立绘撑满 200×300 窗口 + 气泡绝对定位（`bottom: 75%`），多行文本顶出窗口上沿被裁。改为参考项目布局：`#app` 为 flex 列（`justify-content: flex-end`），气泡是**文档流元素**自然位于立绘上方，立绘收缩为 128×128；`word-break: break-word` + `max-width: 168px` 兜底，任意长度文本都不会被裁切
- **边界策略对齐参考项目**：拖拽过程中**不钳制**（保留拖出屏的自由，消除拖拽时「被切断」的抖动），仅在窗口创建/显示时回收完全出屏的窗口到主显示器右下角
- **数据库零原生依赖**：`better-sqlite3` → Node 内置 `node:sqlite`（Electron 39 内置 Node ≥22.13），彻底免除原生模块编译/重装环节
- **旧数据自动迁移**：检测到旧 Tauri 版 `chat.db` 且新库为空时自动 ATTACH 复制（秒级时间戳 ×1000 转毫秒、`status 'ok'` 映射为 `'complete'`）；旧库只读不动，迁移失败不阻塞启动
- **API Key 存储改用 Electron `safeStorage`**：系统级加密（macOS Keychain 兜底），替代 1.1.1 起的自研 AES-256-GCM 方案
- **休息提醒/番茄钟完整移植**：30s tick、休息提醒（默认 45 分钟）、番茄钟（默认 25/5）工作↔休息循环；桌宠气泡播报 + 聊天窗口番茄视图 SVG 双圆环
- **聊天窗口 UI 完整保留**：四 Tab（对话/角色/番茄/API）、「陪伴记录」会话抽屉（新建/重命名/删除）、思考轮播气泡（5 条文案每 3s 轮换 + 灰色秒数计时）、Markdown 安全渲染（marked + DOMPurify）、时段问候、长文本分段轮播气泡（每段 2s 起步、超 10 字每字 +120ms、封顶 4s）
- **工程化**：`electron-vite` 三端构建（main/preload/renderer 多页）、`electron-builder` 打包、`contextBridge` 类型安全 API 契约（`src/shared/types.ts`）、OpenSpec change `refactor-tauri-to-electron` 存档设计决策

### Removed

- **Tauri v2 / Rust 技术栈整体移除**：`src-tauri/`、Cargo 工具链、`cargo tauri build` 发版流程及全部旧版构建产物
- **自研 AES-256-GCM Key 加密**（被 `safeStorage` 取代）与 macOS 私有 API 透明窗口 hack（Electron 原生 `transparent` 即可）

### Known Limitations

- **旧版 API Key 不迁移**：加密机制不同，首次启动需在 API 页重新填写 DeepSeek Key
- **角色个性化配置不迁移**：旧库 `personas` 表与新列式 schema 不同，需在「角色」页重新设置（会话与消息记录完整迁移）
- **应用未签名**：无 Apple Developer ID 签名，首次打开需在「系统设置 → 隐私与安全性」中允许，或右键 → 打开
- **数据目录变更**：新数据存于 `~/Library/Application Support/胡桃桌宠/`，旧目录（`com.hutao-desktop-pet`）保留不动，仅迁移时读取

## [1.7.0] - 2026-07-30

对话分裂问题根治（看门狗单位 bug + 切会话走完结路径）；桌宠/气泡边界裁切修复（参照 kirineko/desktop-pet）。

### Fixed

- **自愈看门狗恢复路径从未生效（1.6.2 引入的单位 bug）**：数据库 `created_at` 是**秒级**时间戳，看门狗却拿它与 `Date.now()` 的**毫秒**值比较（`1785393827 >= 1785393825000` 永远为假），导致「done 事件丢失后 10 秒自动从数据库恢复」的核心兜底从未触发，只剩 150 秒超时路径可用——对话依旧卡在思考中。修复：比较前 `createdAt × 1000` 统一为毫秒
- **切换/点击历史会话导致「回复 + 思考气泡」分裂**：done 事件延迟/丢失时，用户在抽屉点击当前会话，`selectConversation` 会从数据库载入并渲染已落库的完整回复，而思考气泡挂在独立的 `#stream-container` 中不受 `renderMessages` 影响，继续计时——两个气泡并存。修复：切入的会话若正在生成中且消息里已存在本次生成的完整回复，直接走完结路径（清理思考气泡、重置流式状态、渲染最终消息）
- **桌宠拖出屏幕边缘被切断**：拖拽移动只累加位移不做边界检查，桌宠可被拖出屏幕，立绘被屏幕边缘切掉一半。修复（参照 kirineko/desktop-pet 边界处理）：新增 `clamp_fully_visible`——把窗口完整钳制在包含其中心点的显示器可视区内，任何一边越界即推回；拖拽移动、`show_pet`、启动恢复存档位置三处统一使用。原 `clamp_to_visible` 仅在完全出屏时回收，不处理半出屏
- **气泡多行文本顶出窗口上沿被裁**：1.6.2 把气泡改为可换行后，`bottom: 75%` 锚定让更高的气泡向上生长，顶出 200×300 窗口的上边界被裁剪。修复：气泡改为**顶部锚定**（`top: 8px`），从窗口顶部向下生长，任意行数都不会被上沿裁切

### Changed

- **流程日志文案更新**：`[思考流程]` 新增切会话检测落库回复的完结日志；边界钳制与气泡锚定改动补充注释说明（含 kirineko/desktop-pet 参考出处）
- **描述文案校对**：`package.json` / `Cargo.toml` / `tauri.conf.json` / 窗口标题同步为 v1.7.0
- **发版封装**：清理所有旧版构建产物，重新 `cargo tauri build` 输出 v1.7.0 `.app` / `.dmg`

## [1.6.2] - 2026-07-30

修复对话卡在「思考中」：流式事件双通道冗余投递 + 前端 seq 去重 + 自愈看门狗；桌宠气泡分段轮播防溢出。

### Fixed

- **「回复已渲染 + 思考气泡仍在」的思考/输出分裂状态**：流式事件被运行时缓冲延迟投递时，看门狗先从数据库恢复并渲染了完整回复，随后被缓冲的 start 事件才送达——它未被去重集合覆盖，被当作「新生成」又创建了一个思考气泡，与已完成回复并存。修复：**过期事件拦截**——生成已结束（`streamingConvId` 已清空）后迟到的 start / delta / error 一律视为失效事件直接忽略，思考→输出统一为同一生成周期内的单一状态机，任何事件延迟/乱序组合下都不会出现两个气泡并存
- **桌宠气泡被迟到的 busy 事件重新卡在「正在想」**：`business-state` 与 `chat-stream` 是两条独立事件通道，不保证相对顺序——done 先到达恢复了桌宠状态，迟到的 busy 随后到达又重新挂出常驻气泡，且之后没有任何事件能消除它。修复：记录最近生成完成时刻，完成后 2 秒内到达的 busy 判定为过期事件直接忽略
- **聊天窗口卡在「思考中」不输出（1.6.0 回归）**：单通道 `app.emit` 广播在部分 Tauri v2 运行时条件下会丢失 spawn 任务中 emit 的事件——回复已存库（历史会话可见）但 delta/done 未送达前端，界面永远停在思考气泡，重开窗口才能看到结果。根因涉及三处，修复方案：
  - **双通道冗余投递**：`service.rs` 所有 `chat-stream` 事件（start / delta / done / error）恢复「定向投递聊天窗口 + 全局广播兜底」双通道，互为冗余，任一通道丢失事件都能送达
  - **事件 seq 去重**：每个流式事件携带全局单调递增 `seq` 序号，前端用有界集合（容量 500）记录已处理序号，重复事件直接丢弃。用集合而非「最大 seq」判断，两条通道间乱序到达时不会误杀未处理事件，避免双发导致的 delta 文本重复问题复现
  - **自愈看门狗**：流式期间前端每 5 秒检查事件流；超过 10 秒无任何事件则回查数据库，发现助手回复已落库即判定 done 事件丢失，直接从数据库渲染完整回复并恢复 UI；超过 150 秒未完成判定超时，提示重试并恢复 UI。三重保障下界面不再可能永久卡死
- **桌宠气泡卡在「胡桃正在想…」**：`business-state` 收到 idle 时只切换了立绘状态，`sayBusy` 的常驻气泡从未被隐藏。修复：恢复 idle 时同步隐藏 busy 气泡；并新增兜底——桌宠监听 `chat-stream` 的 done/error 事件，idle 广播丢失时也能恢复待机状态
- **桌宠气泡文字溢出窗口**：气泡 CSS 原为 `white-space: nowrap`，长文本强制单行直接撑出 200px 宽的窗口。修复：
  - **分段轮播**：长文本按句末标点（。！？～…）切段，超 26 字的长句再按逗号等次级标点切，仍超长则按字数硬切；各段依次轮播，每段基础展示 2 秒，超 10 字部分每字 +120ms，单段封顶 4 秒，播完自动隐藏；新气泡到来或打开菜单时立即打断未播完的轮播
  - **CSS 兜底**：`white-space: nowrap` 改为 `normal` + `word-break: break-word`，单段文本绝不溢出

### Changed

- **流程日志文案更新**：新增 `[自愈看门狗]`（启动 / 静默回查 / 事件丢失恢复 / 超时判定）、`[分段轮播]`（切段数量与字数）日志前缀；`[思考流程]` 补充桌宠侧 busy/idle 收发日志；后端 `[chat]` 日志补充双通道投递失败的区分记录（定向 / 广播分别报错）
- **描述文案校对**：`package.json` / `Cargo.toml` / `tauri.conf.json` / 窗口标题同步为 v1.6.2
- **发版封装**：清理所有旧版构建产物，重新 `cargo tauri build` 输出 v1.6.2 `.app` / `.dmg`

## [1.6.1] - 2026-07-30

流程日志整理与发版封装：清理旧构建产物、统一日志风格、精简历史版号引用。

### Fixed

- **流式输出气泡消失问题**：发送 prompt 后思考气泡短暂出现随即消失，流式文本不显示，需切换会话或重启才能看到已完成的回复。根因涉及四处：
  - `appendStreamDelta` 中 `getElementById("message-area")!` 在罕见条件下返回 null 时调用 `scrollToBottom(null)` 抛出异常，被外层 try-catch 吞掉，导致 bubble 被整个丢弃且消息不刷新
  - 非当前会话的 done/error 事件处理中错误调用了 `dropStreamBubble()`，该函数操作全局 `streamBubble` 变量，会错误移除当前会话的流式气泡
  - done 事件处理中 `getConversationMessages` 无 `.catch()` 兜底，若数据库读取失败则消息不再渲染
  - 外层异常 catch 只重置 UI 状态不重新加载消息，错误恢复后无任何输出可见
- **修复方案**：`appendStreamDelta` 增加 null 安全 + try-catch 内层保护 + DOM 断开重建；非当前会话处理移除 `dropStreamBubble()`；done/error 处理增加 `.catch()` 兜底；外层 catch 增加消息恢复逻辑

### Changed

- **流程日志文案统一**：后端模块日志前缀统一为 `[模块名]`（`[chat]` / `[service]` / `[commands]` / `[secrets]` / `[timer]`），前端日志前缀统一为 `[流程阶段]`（`[时间问候]` / `[交互流程]` / `[思考流程]` / `[事件追踪]` / `[计时流程]`），消除各版本迭代累积的不一致日志风格
- **代码注释去版号化**：移除 Rust 源码中散布的旧版号注释（如「v1.5.1 起…」「v1.5.2 引入…」），保留流程说明但不再绑定特定版本号，降低后续维护的认知负担
- **描述文案校对**：`package.json` / `Cargo.toml` / `tauri.conf.json` 的描述字段同步为当前版本号，托盘提示文案保持不变
- **思考轮播文案微调**：「胡桃正在吓唬香菱…」→「胡桃正打算吓唬香菱…」、「胡桃正在逗七七…」→「胡桃正在逗七七玩…」
- **发版封装**：清理所有旧版构建产物，重新 `cargo tauri build` 输出 v1.6.1 `.app` / `.dmg`

## [1.6.0] - 2026-07-29

收敛 1.5.x 系列流式修复：消除事件双发/错误双重投递，思考气泡提前到发送即现。

### Fixed

- **流式文本逐字重复**（1.5.2 引入）：`chat-stream` 事件同时经 `chat_win.emit()` 定向 + `app.emit()` 广播双通道投递，聊天窗口每个事件收到两遍，delta 被追加两次导致正文重复（如「你你好好」）。验证 spawn 任务中广播通道工作正常（`business-state` 即走广播且桌宠可收到），故移除定向通道，只广播一次
- **错误提示出现两条**（1.5.1 引入）：service 末尾与 commands 兜底两层各自 emit error 事件。改为 service 内所有错误路径（含未配置 API Key 等早期校验失败）统一经 `emit_stream_error()` 发一次，commands 层只记录日志不再补发
- **思考气泡计时起点偏晚**：原来等 start 事件到达才创建思考气泡，改为发送 prompt 后立即出现（胡桃头像 + 红色轮播文案 + 灰色计时），start 事件到达时若气泡已存在则保留不再重建，计时从发送时刻起算

### Changed

- **样式去重**：移除 `.thinking-timer` 的重复定义块（11px 灰色小字为准）
- **前端诊断**：新增 `debug_log` IPC 命令，前端日志可写入 `app_data_dir/frontend-debug.log` 便于定位事件链问题

## [1.5.2] - 2026-07-29

修复流式事件在聊天窗口无法实时送达的问题，强化事件投递与业务流程日志。

### Fixed

- **聊天窗口流式事件丢失（对话框无变化）**：根因是 `app.emit()` 全局广播在某些 Tauri v2 运行时条件下，从 spawn 任务中 emit 的事件未被聊天窗口及时接收。**修复方案**：`service.rs` 中所有 `chat-stream` 事件（start / delta / done / error）改为双通道投递——优先通过 `chat_win.emit()` 直接投递到聊天窗口，再通过 `app.emit()` 广播兜底。`business-state` 事件保留全局广播以同时通知桌宠窗口。
- **前端事件处理异常静默丢弃**：`handleStreamEvent` 原来无 try-catch，若 `event.conversationId` 为 `undefined` 或 DOM 元素缺失会静默抛错。**修复方案**：整个 handler 包入 try-catch 兜底，异常时自动恢复 UI 状态避免卡死；`message-area` 存在性检查替代 `!` 断言，防止 NPE。

### Changed

- **事件投递日志完善**：所有 `emit` 调用处新增错误日志（`eprintln!`），`handleStreamEvent` 日志级别升至 v1.5.2，使用安全属性访问（`?.`）防止 undefined 崩溃
- **思考流程文案更新**：start 日志补充说明「红色轮播文案 + 灰色计时」
- **发版封装**：清理旧构建产物，重新 `cargo tauri build` 输出 v1.5.2 `.app` / `.dmg`

## [1.5.1] - 2026-07-29

修复流式输出卡在思考阶段的 IPC 事件阻塞 bug。

### Fixed

- **流式回复卡在「思考中」阶段不输出**：根因是 `send_chat_message` 的 Tauri 命令 `await` 了整个流式处理过程（含 DeepSeek 网络往返），Tauri v2 的 IPC 通道在此期间会缓冲所有事件，导致 delta/done 事件被延迟到 invoke 返回后才批量投递，前端 DOM 可能未就绪而被静默丢弃。**修复方案**：将实际处理 `spawn` 到后台 tokio 任务中，invoke 立即返回释放 IPC 通道，事件实时推送至前端。
- **早期错误无法送达前端**：后台 spawn 后，API Key 未配置等早期校验错误通过 `invoke` 返回值无法再被前端捕获。**修复方案**：在 spawn 任务中额外 emit `chat-stream` error 事件，确保所有错误路径都通过事件总线送达前端。
- **流式气泡 DOM 断开后 delta 静默丢弃**：`appendStreamDelta` 原来在 `streamBubble.isConnected === false` 时直接 `return`，若消息区因故清空会导致后续所有 delta 被丢弃。**修复方案**：气泡断开时自动重建并重新挂载到消息区，配合 warn 日志标记恢复路径。

### Changed

- **事件追踪日志**：`handleStreamEvent` 新增全局事件序号 `[事件追踪] #N type=... convId=... currentConv=...`，便于诊断事件丢失、乱序、或路由错误
- **`sendMessage` 错误处理简化**：invoke 不再承载 chat 业务错误，catch 仅兜底 IPC 通信异常

## [1.5.0] - 2026-07-29

新增系统时间感知：启动时根据时间给出胡桃风格的时段问候语。

### Added

- **时段问候功能**：桌宠启动时根据系统时间自动判断当前时段（早上 6:00–11:59 / 下午 12:00–17:59 / 晚上 18:00–23:59 / 深夜 0:00–5:59），从对应时段语录池中随机选取一条胡桃风格的问候语气泡。每时段 4 条备选文案，共 16 条
- **早上问候**：「早上好呀旅行者！新的一天，往生堂也照常营业中～」「太阳晒屁股啦～本堂主都起来好久了！」「哎嘿，早安！璃月的早晨空气最好了～」「早呀～胡桃今天也精神满满！」
- **下午问候**：「下午好～本堂主刚吃过午饭，有点犯困呢…」「午后时光最适合摸鱼啦～哎嘿，本堂主什么都没说！」「下午好呀！来杯茶歇一歇吧～」「嘿嘿，下午的阳光真暖和，起来活动一下哦～」
- **晚上问候**：「晚上好呀～今天还愉快嘛？有什么好玩的事说给本堂主听听！」「哎嘿，夜晚才刚开始呢！要不要和胡桃聊聊天？」「晚上了呢…本堂主喜欢在夜里散步～」「晚上好！往生堂虽然关门了，但本堂主可以陪你聊聊～」
- **深夜问候**：「都这么晚了还没睡呀？要注意身体呀～」「夜深了呢…早点休息吧，明天还要继续冒险呢！」「这么晚还不睡？本堂主可不想明天看到旅行者顶着黑眼圈！」「咳咳，虽然往生堂做的是夜里的生意，但旅行者你不需要熬夜…去睡吧～」

### Changed

- **启动欢迎语替换**：原来固定 3 条欢迎语（「哎嘿！胡桃来啦～」等）替换为系统时间感知问候，更贴合用户当前状态
- **流程日志**：启动时输出 `[时间问候] 当前时段: {早上/下午/晚上/深夜} ({小时}时)，问候语: "{内容}"`

## [1.4.0] - 2026-07-29

右键选项菜单新增番茄钟入口 & 发版封装。

### Added

- **右键菜单新增「番茄钟」选项**：桌宠立绘右键选项气泡在「和我聊天」「角色设定」「退出」之间新增「番茄钟」入口。点击后打开聊天窗口并自动切换到 ⏰ 番茄视图（`view: "timer"`），与底部 Tab 切换行为一致

### Changed

- **交互日志完善**：`showMenu()` 打开时输出 `[交互流程] 打开右键选项菜单（和我聊天 / 角色设定 / 番茄钟 / 退出）`，菜单选项被点击时输出 `[交互流程] 菜单选项被点击: {id}`
- **发版封装**：清理旧构建产物，重新 `cargo tauri build` 输出 v1.4.0 `.app` / `.dmg`

## [1.3.4] - 2026-07-29

休息提醒默认间隔调整 & 下拉选项化。

### Changed

- **默认休息提醒间隔从 30 分钟调整为 45 分钟**：后端常量 `DEFAULT_REST_INTERVAL_SECS` 由 1800s → 2700s，前端默认选中值同步更新
- **提醒间隔改为下拉选项框**：替代原来的自由数字输入（5–120），改为固定下拉：**30 分钟** / **45 分钟**（默认）/ **自定义…**（可输入 10–60 分钟范围）。选择「自定义…」时展开数字输入框，非自定义时隐藏输入框
- **流程日志**：回调日志区分预设值切换（`[计时流程] 休息提醒切换为预设间隔: XX 分钟`）与自定义切换（`[计时流程] 休息提醒切换为自定义间隔`），保存时输出最终值

## [1.3.3] - 2026-07-29

交互逻辑优化：左键单击仅播放 Q 弹动画，右键弹出选项菜单。

### Changed

- **左键单击行为简化**：左键点击桌宠立绘仅播放 Q 弹按压动画（`state-click`，450ms 弹跳），不再弹出选项框；若菜单已打开则关闭菜单
- **右键弹出选项框**：右键点击桌宠立绘弹出选项气泡菜单（「想做什么呢？」→ 和我聊天 / 角色设定 / 退出），替代原来调用的原生上下文菜单
- **流程日志**：`pet-controller.ts` 左键/右键交互路径新增 `[交互流程]` 日志，区分单击动画与菜单弹出两条交互路径
- **冗余命令标记**：`show_context_menu` IPC 命令保留在注册表中（系统托盘菜单仍使用），但桌宠前端右键不再调用

## [1.3.2] - 2026-07-29

思考流程可视化优化：完善「发送 prompt → 等待模型 → 流式输出」全流程的文案描述与日志信息。

### Changed

- **思考流程文案完善**：更新思考阶段气泡的轮播文案描述，明确胡桃角色头像在发送后立刻出现 → 红色大字轮播（「胡桃正在思考中…」「胡桃正在推销业务中…」「胡桃正在吓唬香菱…」「胡桃正在逗七七…」「胡桃正在偷懒中…」循环往复，每 3 秒轮换一条）→ 模型返回首个 token 后自动切换为流式输出 → 计时器灰色小字实时显示已等待秒数的完整流程
- **流程日志增强**：后端 `service.rs` 新增「开始生成」与「首个 delta 到达」阶段的 `eprintln!` 日志，前端新增思考气泡生命周期 `console.log` 日志（创建 / 文案轮播 / 切换正文）

## [1.3.1] - 2026-07-29

回复速度优化 & 思考气泡趣味化。

### Changed

- **模型升级至 `deepseek-v4-flash`**：恢复使用高速轻量模型，强制禁用思考模式（`thinking: { type: "disabled" }`），限定 `max_tokens=1024`，添加 HTTP 超时（连接 10s / 请求 120s），降低首 token 延迟
- **系统提示词精简**：胡桃人设 prompt 压缩为单段紧凑文本，减少 token 开销加快首字响应
- **历史消息截断**：仅保留最近 20 条对话历史参与上下文，减少 prompt 膨胀带来的延迟累积
- **思考气泡趣味化**：等待回复时显示胡桃圆形头像 + 轮播文案（红色大字）：「胡桃正在思考中…」「胡桃正在推销业务中…」「胡桃正在吓唬香菱…」「胡桃正在逗七七…」「胡桃正在偷懒中…」，每 3 秒轮换一条；下方灰色小字显示等待秒数计时

## [1.3.0] - 2026-07-29

对话体验优化：对方头像、思考指示与等待计时。

### Added

- **对方头像**：assistant 历史消息和流式/思考气泡均带胡桃圆形头像（左下对齐，白边圆环），与顶栏、空状态头像风格统一
- **思考指示**：发送后到首个 token 到达前，显示「胡桃正在思考…」气泡（圆点逐帧动画），首个 delta 到达自动切换为正文流式输出
- **等待计时**：思考气泡旁实时显示已等待秒数（`3s`、`4s`…），等宽数字字体，首个 delta 到达时随思考状态一起移除

## [1.2.0] - 2026-07-29

新增休息提醒与番茄钟陪伴功能。

### Added

- **休息提醒**：桌宠累积可见每满 30 分钟（可配置 5–120 分钟），通过 `rest-reminder` 事件触发，桌宠气泡提示「已经陪了你 X 分钟啦！该起来活动一下咯～」；后台 ticker 每 30 秒累积，宠物隐藏时暂停计时
- **番茄钟**：可配置工作/休息时长（默认 25/5 分钟），工作 ↔ 休息阶段自动循环切换；`pomodoro-tick` 事件驱动倒计时，`pomodoro-done` 阶段切换时桌宠气泡提示（「工作阶段结束，休息一下吧～」/「休息结束，继续加油！」）
- **⏰ 番茄视图**：聊天窗口新增第四个 Tab，含休息提醒卡片（SVG 圆环倒计时 + 间隔配置）和番茄钟卡片（圆环进度 + 工作/休息时长配置 + 开始专注/停止）
- **计时器命令与事件**：`get_timer_status` / `update_timer_config` / `start_pomodoro` / `stop_pomodoro` / `reset_rest_timer` 五个 IPC 命令，`rest-reminder` / `pomodoro-tick` / `pomodoro-done` 三个事件，前后端类型对齐（`TimerConfig` / `TimerStatus`）

## [1.1.1] - 2026-07-29

修复 API Key「保存成功但读取不到、无法对话」的问题，更换 Key 的加密存储机制。

### Fixed

- **API Key 保存后无法对话**：根因是 macOS 数据保护钥匙串把条目访问权绑定到签名二进制的 cdhash——ad-hoc 签名的应用每次重新构建 cdhash 都变，旧构建写入的 Key 对新构建不可见（`set` 返回成功、`get` 返回 NoEntry，已用不同签名二进制实测验证）。每个版本升级都会"丢"Key

### Changed

- **API Key 存储改为 AES-256-GCM 加密文件**：替代 keyring/Keychain 方案。加密后存于应用数据目录 `deepseek.key`，加密密钥由 `kern.hostuuid`（硬件 UUID）+ 应用盐经 SHA-256 派生——文件非明文、仅所有者可读写（0600）、且只能在创建它的机器上解密。移除 `keyring` 依赖，新增 `aes-gcm` / `sha2` / `rand`
- **保存即校验**：`set_api_key` 写入后立即回读比对，不一致直接报错，杜绝"假保存成功"
- **脱敏显示改按字符截取**：避免多字节字符场景切片 panic
- **openspec 规格同步**：`ai-character-chat` spec 的 API Key 存储条款、`design.md` 决策 4 已更新为新方案（保留历史决策存档）

## [1.1.0] - 2026-07-29

聊天窗口 UI 全面翻新为符合胡桃人设的二次元陪伴风格，并修复样式丢失、菜单裁剪等问题。

### Added

- **聊天窗口全新 UI**：暖奶油底 + 梅红点缀的二次元风格。顶栏（胡桃头像 + 名称 + 状态「待命中/思考中…」）、底部胶囊 Tab（💬 对话 / 🎀 角色 / 🔑 API）、圆形发送按钮（流式时变为 ■ 停止）
- **会话抽屉**：顶栏 ☰ 滑出「陪伴日记」会话列表，卡片式会话项（标题/预览/时间），支持新建（＋写新一页）、重命名、删除
- **消息气泡新样式**：assistant 左侧带头像白卡片、user 右侧梅红渐变气泡；动作描写 `*…*` 以梅红斜体突出
- **空状态引导**：未配置 API Key 显示头像 + 「去设置」引导；未选择会话显示「想听你说今天的故事 ♡」+ 新建按钮；未配置 Key 时输入框禁用并提示
- **全局滚动条**：消息区、会话列表、角色/API 面板均可滚动，细圆角主题色滚动条
- **顶栏关闭按钮**：× 直接关闭聊天窗口（新增 `core:window:allow-close` 权限）

### Changed

- **流式渲染优化**：流式期间维护单个气泡节点纯文本追加（带光标动画），不再每个 token 全量重建消息 DOM；done 后一次性 Markdown 渲染
- **前端改双静态入口**：`index.html`（桌宠）+ `chat.html`（聊天）各自静态引用 JS/CSS，替代原单入口 + `?window=` 动态 import 分发

### Fixed

- **聊天窗口样式整体丢失**（表现为"没做前端"的裸 HTML）：根因是动态 import chunk 的 CSS 在生产环境未注入，多入口拆分后 CSS 以 `<link>` 直接写进 HTML，彻底消除该问题
- **桌宠气泡菜单选项不完整**：菜单沿 `bottom: 75%` 定位，较高时溢出 300px 窗口顶边被裁剪，改为锚定窗口顶部

## [1.0.3] - 2026-07-29

修复拖拽脱节和聊天前端的一批 bug。

### Fixed

- **拖拽位置与鼠标脱节、速度越快偏差越大**：前端 `screenX` 是逻辑像素（点），而 `move_window` 直接按物理像素累加，Retina 屏（scale=2）下窗口只走光标一半距离。改为在 Rust 端将窗口位置转为逻辑坐标后再累加增量
- **发送按钮双重绑定**：`buildChatView` 的 `addEventListener` 与 `setStreamingUI` 的 `onclick` 赋值并存，streaming 切换后一次点击触发两个处理器。改为单一 listener 按 `state.streaming` 分发发送/停止
- **未配置 API Key 发消息时按钮永久卡在「停止」**：后端在 emit start 前返回错误，`chat-stream` error 事件不会到达前端，invoke 异常只打了 console。改为在 catch 中渲染错误消息并恢复发送 UI
- **生成中切换到其他会话后按钮永久卡在「停止」**：非当前会话的 `done`/`error` 事件被直接丢弃，`streaming` 状态永不复位。改为非当前会话事件也同步生成状态
- **重命名会话按 Escape 仍会保存**：Escape 恢复列表后 `blur` 事件照常触发保存。加取消标记阻止
- **停止生成后的空 cancelled 消息渲染为「…」气泡**：`cancelled` 状态消息单独渲染为居中的「（已停止生成）」提示
- **流式回复时强制滚动到底部**：用户上翻阅读历史时每个 delta 都被拉回底部。改为仅当用户本来就在底部附近时自动滚动
- **角色设定保存中文时可能崩溃**：`persona.rs` 的 `clamp` 按字节切片，UTF-8 中文字符边界处直接 panic。改为按字符数截断
- **桌宠气泡菜单「退出」点击无反应**：新增 `quit_app` 命令，菜单项接入 `app.exit(0)`
- **托盘/右键菜单「和我聊天」「角色设定」完全无效**：这两个菜单项原来只 `emit` 事件，聊天窗口不存在时无人消费。改为调用 `open_chat` 命令逻辑（不存在则创建，存在则聚焦并切换视图）
- **SSE 流式回复中文偶发乱码 `�`**：网络 chunk 边界切断多字节 UTF-8 序列时 `from_utf8_lossy` 直接替换为 U+FFFD。改为字节缓冲、按行切分后再解码（`0x0A` 不会出现在多字节字符内部）
- **停止生成丢失已生成内容**：abort 后原来只插入空 cancelled 消息。改为在 delta 回调中累积已生成内容，abort 后保留为 cancelled 消息
- **同秒消息排序不稳定**：消息按秒级 `created_at` 排序，user/assistant 常同秒。改为按 `rowid`（插入顺序）排序
- **菜单打开时再单击立绘不关闭菜单**：补上单次点击切换开关（`Bubble.isMenuOpen()` 此前从未被调用）
- **busy 中拖拽不显示 drag 状态**：移除 busy 守卫，拖拽期间显示 drag，松开恢复 busy（对齐规格）
- **缓慢拖动被误判为单击**：拖拽阈值原来按单帧增量判断，改为按累计位移判断

## [1.0.2] - 2026-07-29

修复桌宠无法拖拽移动的问题。

### Fixed

- **桌宠无法拖拽**：原实现把 `pointerdown/move/up` 绑定在立绘元素上并依赖 `setPointerCapture`，在透明无边框窗口下事件捕获丢失导致拖拽失效。改为对齐参考项目 [kirineko/desktop-pet](https://github.com/kirineko/desktop-pet/blob/main/src/renderer/pet.ts) 的事件模型：`mousedown` 绑定在整个 stage（窗口全域），`mousemove`/`mouseup` 绑定在 `window`，不做 pointer capture，拖拽时按增量调用 `move_window`

## [1.0.1] - 2026-07-29

修复桌宠窗口在 macOS 上显示为白色方形背景的问题。

### Fixed

- **桌宠窗口背景不透明**：macOS 上 `transparent: true` 单独不生效，窗口渲染为白色矩形。修复分三层：
  - `tauri.conf.json` 增加 `app.macOSPrivateApi: true`，`Cargo.toml` 为 tauri 启用 `macos-private-api` feature，解锁系统级窗口合成
  - `lib.rs` 启动时通过 `objc` 直接调用 AppKit，对 pet 窗口执行 `setOpaque: NO` + `setBackgroundColor: clearColor`，确保原生 `NSWindow` 层背景透明（修复打包后透明失效问题，参考 [tauri#13415](https://github.com/tauri-apps/tauri/issues/13415)）
  - CSS 层 `html, body { background: transparent }` 此前已就绪，无需改动

## [1.0.0] - 2026-07-29

首个正式版本。基于参考项目 `kirineko/desktop-pet`（Electron）重写为 Tauri v2 + Rust 架构，单角色胡桃，保留 AI 角色对话，砍掉 Amazon 库存查询业务。

### Added

- **Tauri v2 项目骨架**：Rust 主进程（`src-tauri/`）+ Vite 前端，替代 Electron 方案
- **透明置顶桌宠窗口**：200×300，`transparent` + `decorations:false` + `always_on_top` + `skip_taskbar`，加载 `pets-picture/hutao.png` 立绘
- **四种视觉状态动画**：`idle`（呼吸摇摆）/ `drag`（倾斜跟随）/ `click`（挤压弹跳）/ `busy`（思考抖动），CSS keyframes 驱动
- **拖拽移动窗口**：按住立绘拖动移动窗口位置，松开时持久化位置
- **单击气泡菜单**：单击立绘弹出"想做什么呢？"气泡，含「和我聊天 / 角色设定 / 退出」
- **右键上下文菜单**：和我聊天、角色设定、始终置顶（切换）、隐藏宠物、退出
- **系统托盘**：显示/隐藏宠物、打开聊天、始终置顶（切换）、退出；macOS 点击托盘图标显示/聚焦宠物
- **可见性切换**：隐藏时窗口完全不可见但应用常驻，启动时强制显示避免锁死
- **配置持久化**：`config.json` 存储 alwaysOnTop / windowX / windowY / visible
- **独立聊天窗口**：480×640，三视图切换（对话 / 角色设定 / API 设置），与桌宠窗口通过事件总线联动
- **AI 角色对话**：DeepSeek `deepseek-v4-flash` 非思考模式，SSE 流式回复
- **胡桃角色人设**：内置 `coreIdentity`（往生堂第七十七任堂主）+ `speechStyle`（自称本堂主、称呼旅行者）
- **用户可配置角色字段**：userCallName / relationship / personalityBias / tonePreference / extraNotes
- **API Key 加密存储**：`keyring` crate 存入 macOS Keychain，非明文，支持设置/修改/删除/在线测试
- **多会话聊天历史**：`rusqlite` 维护 `chat.db`，会话级 CRUD，消息按会话组织，重启后恢复
- **会话标题自动更新**：首条用户消息取前 20 字符作为会话标题
- **Markdown 渲染**：assistant 消息支持代码块/列表/链接，`marked` + `dompurify` 安全渲染
- **流式回复实时渲染**：逐 token 追加到消息气泡，自动滚动到底部
- **停止生成**：流式过程中可中止，已生成内容保留为 cancelled 消息
- **错误处理**：missing_api_key / invalid_api_key / rate_limited / network / content_filter / aborted 等错误码
- **窗口位置 clamp**：持久化位置越界时回收到主显示器右下角默认位置
- **状态优先级**：busy 中拖拽显示 drag，松开后恢复 busy；busy 中单击仍能弹出气泡菜单
- **桌宠气泡 busy 占位**：AI 流式回复中桌宠气泡显示"胡桃正在想…"

### Known Limitations

- **仅支持 macOS**：Windows/Linux 适配未做，`keyring` 跨平台能力已预留
- **未做透明窗口点击穿透**：整个 200×300 矩形可点击，立绘透明区域不穿透到桌面（推迟到后续版本）
- **未做 Dock 置顶**：`always_on_top` 为普通级别，无法浮在 macOS Dock 之上（参考项目 Electron `screen-saver` level 的对应能力未实现）
- **未做 CI 自动打包**：MVP 阶段仅支持本地 `cargo tauri build`，无 GitHub Actions 自动发版
- **未做应用内更新**：无自动更新机制，新版本需用户手动下载替换
- **单角色硬编码**：仅胡桃一只，未做多角色切换数据结构，未来加角色需重构
- **素材未预处理**：直接用 2MB 原图（2290×2474），CSS `object-fit: contain` 缩放显示，未做体积优化
- **DeepSeek 模型名硬编码**：`deepseek-v4-flash` 写死在 Rust 常量中，模型名变更需改代码重新编译

### 版本维护规则

后续每次发版遵循以下规则：

1. 在 `[Unreleased]` 段落累积日常变更，按 `### Added` / `### Changed` / `### Fixed` / `### Removed` 分类（按需使用，无变更的子节可省略）
2. 发版时（打 `v*` 标签前）：
   - 在 `[Unreleased]` 之下、最新已发布版本之上，插入新版本段落 `## [x.y.z] - YYYY-MM-DD`
   - 将 `[Unreleased]` 累积的内容剪切到新版本段落下
   - 清空 `[Unreleased]` 段落（保留空占位）
3. 版本号遵循语义化版本：
   - MAJOR：不兼容的 API/行为变更
   - MINOR：向后兼容的新功能
   - PATCH：向后兼容的 bug 修复
4. 每个版本条目内容应从对应的 `openspec/changes/<change-name>/proposal.md` 提取「What Changes」，从 `tasks.md` 提取实际完成情况
5. 已发布版本的内容不可修改（如需更正，在新版本中用 `### Fixed` 说明）

<!-- 链接定义区（Keep a Changelog 推荐） -->

[Unreleased]: https://github.com/zhenkun26/DeskPet/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/zhenkun26/DeskPet/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/zhenkun26/DeskPet/compare/v1.7.0...v2.0.0
[1.7.0]: https://github.com/zhenkun26/DeskPet/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/zhenkun26/DeskPet/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/zhenkun26/DeskPet/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/zhenkun26/DeskPet/compare/v1.5.2...v1.6.0
[1.5.2]: https://github.com/zhenkun26/DeskPet/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/zhenkun26/DeskPet/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/zhenkun26/DeskPet/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/zhenkun26/DeskPet/compare/v1.3.4...v1.4.0
[1.3.4]: https://github.com/zhenkun26/DeskPet/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/zhenkun26/DeskPet/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/zhenkun26/DeskPet/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/zhenkun26/DeskPet/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/zhenkun26/DeskPet/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/zhenkun26/DeskPet/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/zhenkun26/DeskPet/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/zhenkun26/DeskPet/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/zhenkun26/DeskPet/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/zhenkun26/DeskPet/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/zhenkun26/DeskPet/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/zhenkun26/DeskPet/releases/tag/v1.0.0
