## 1. Tauri v2 项目骨架

- [x] 1.1 在仓库根目录运行 `cargo create-tauri-app` 或手动初始化 `src-tauri/`，选择 vanilla TS/JS 前端模板（无框架依赖，便于平移参考项目 HTML/CSS）
- [x] 1.2 配置 `src-tauri/tauri.conf.json`：`identifier: "com.hutao-desktop-pet"`、`productName: "胡桃桌宠"`、macOS 最低版本、`bundle.targets: ["app", "dmg"]`
- [x] 1.3 在 `src-tauri/Cargo.toml` 添加依赖：`tauri`（v2，features=["tray-icon"]）、`serde`、`serde_json`、`rusqlite`、`keyring`、`reqwest`（features=["stream"]）、`tokio`、`chrono`、`uuid`、`dirs`
- [x] 1.4 配置前端构建：根目录 `package.json` + `vite.config.ts`，前端入口 `index.html` 通过 `?window=pet|chat` 查询参数加载不同 JS 入口
- [x] 1.5 验证 `cargo tauri dev` 能启动一个空白窗口，确认 Tauri v2 + Vite 工具链就绪

## 2. 桌宠窗口（desktop-pet-window capability）

- [x] 2.1 在 `tauri.conf.json` 定义 `pet` 窗口：`width:200, height:300, transparent:true, decorations:false, alwaysOnTop:true, skipTaskbar:true, shadow:false, resizable:false, url:"index.html?window=pet"`
- [x] 2.2 创建前端 `src/pet/main.ts` + `src/pet/pet.html`，加载 `pets-picture/hutao.png` 到 `<img class="pet-image state-idle">`，CSS `object-fit: contain` + 去掉 `image-rendering: pixelated`
- [x] 2.3 平移参考项目 `style.css` 的 keyframes：`idle-bob` / `drag` / `click-bounce` / `busy-bob`（去掉 `alert-pulse`）和 `.pet-image.state-*` class 体系
- [x] 2.4 实现 `PetController` TS 类：mousedown/mousemove/mouseup 拖拽逻辑、click 识别（位移 ≤2px 为单击）、状态切换（idle/drag/click/busy）、`setBusinessState` 方法
- [x] 2.5 实现 Rust `#[tauri::command] move_window(dx, dy)` 命令，前端拖拽时调用；`save_position` 命令，松开鼠标时持久化
- [x] 2.6 实现窗口位置 clamp：启动时检查持久化位置是否在任何显示器可视工作区内，越界则回收到主显示器右下角默认位置
- [x] 2.7 实现配置加载/保存：`config.json` 存 `{petId:"hutao", alwaysOnTop, windowX, windowY, visible}`，启动时强制 `visible=true`，配置变更立即持久化并 `emit("config-changed")`
- [x] 2.8 实现单击气泡菜单：Bubble 组件（参考项目 `bubble.ts`），标题"想做什么呢？"，按钮"和我聊天"/"角色设定"/"退出"，菜单已开时再次单击关闭
- [x] 2.9 实现右键上下文菜单（`tauri::menu::Menu`）：和我聊天、角色设定、始终置顶（toggle）、隐藏宠物、退出，菜单项反映当前状态
- [x] 2.10 实现系统托盘（`TrayIconBuilder`）：图标、tooltip、点击行为（隐藏时显示、可见时聚焦）、右键菜单（与右键菜单功能对等）
- [x] 2.11 实现可见性切换：`show_pet` / `hide_pet` 命令，`toggle_visible`，隐藏时 `window.hide()`，显示时 `window.show() + set_focus()`，位置 clamp
- [x] 2.12 实现始终置顶切换：`set_always_on_top` 命令调用 `window.set_always_on_top()`，持久化，更新菜单选中状态

## 3. AI 角色对话核心（ai-character-chat capability）

- [x] 3.1 创建 `src-tauri/src/chat/persona.rs`：定义 `HUTAO_CORE_IDENTITY` / `HUTAO_SPEECH_STYLE` 常量，`PersonaProfileFields` 结构体，`sanitize_persona_fields` 函数（trim + 截断 + 枚举校验），`build_system_prompt` 函数合并人设
- [x] 3.2 创建 `src-tauri/src/chat/db.rs`：用 `rusqlite` 初始化 `chat.db`（存放在 `app_data_dir`），建表 `conversations(id, pet_id, title, created_at, updated_at, last_message_preview)` 和 `messages(id, conversation_id, role, content, created_at, status, error_code)` 和 `personas(pet_id, fields_json, updated_at)`
- [x] 3.3 实现 conversation CRUD 命令：`list_conversations(pet_id)` / `create_conversation(pet_id, title)` / `rename_conversation(id, title)` / `delete_conversation(id)`（级联删消息）
- [x] 3.4 实现 message 查询：`get_conversation_messages(conversation_id)` 返回按时间排序的消息列表
- [x] 3.5 实现 persona 命令：`get_persona_profile(pet_id)` 返回合并默认值后的字段，`update_persona_profile(pet_id, fields)` sanitize 后持久化
- [x] 3.6 创建 `src-tauri/src/chat/secrets.rs`：用 `keyring::Entry::new("com.hutao-desktop-pet.deepseek", "default")` 实现 `set_api_key` / `get_api_key` / `delete_api_key` / `get_api_key_status`（返回脱敏 masked）
- [x] 3.7 实现 `test_api_key` 命令：用当前 Key 发起一次最小 DeepSeek 请求（如 `messages:[{role:"user",content:"hi"}]`），返回 `{ok, message}`
- [x] 3.8 创建 `src-tauri/src/chat/deepseek.rs`：`stream_chat_completion(api_key, model, messages)` 函数，`reqwest::Client` POST `https://api.deepseek.com/chat/completions`，`stream:true`，返回 `impl Stream<Item=ChatStreamEvent>`
- [x] 3.9 实现 SSE 流解析：按行读取 `bytes_stream()`，解析 `data: {...}` JSON，提取 `choices[0].delta.content` 增量
- [x] 3.10 创建 `src-tauri/src/chat/service.rs`：`send_chat_message(conversation_id, content)` 协调流程——保存 user 消息、加载 persona、build system prompt、调用 deepseek stream、每 delta `emit("chat-stream-delta")`、结束时 `emit("chat-stream-done")` 并保存 assistant 消息
- [x] 3.11 实现错误处理：missing_api_key（不发起请求）、invalid_api_key（401）、rate_limited、network、content_filter、aborted（用户停止），每种对应 `ChatErrorCode` 和 `chat-stream-error` 事件
- [x] 3.12 实现 `stop_chat_generation` 命令：维护 `Arc<Mutex<Option<AbortHandle>>>`，停止时 `abort`，已生成内容保存为 `status="cancelled"` 消息
- [x] 3.13 实现会话标题自动更新：首条 user 消息时若标题为"新对话"则取消息前 20 字符为新标题，更新 `last_message_preview`

## 4. 聊天窗口前端（chat-window capability）

- [x] 4.1 在 `tauri.conf.json` 定义 `chat` 窗口：`width:480, height:640, url:"index.html?window=chat"`（标准装饰，非透明，非置顶），启动时不自动创建（懒加载）
- [x] 4.2 创建前端 `src/chat/main.ts` + `src/chat/chat.html`，实现三视图 tab 切换（对话/角色设定/API 设置），各视图状态互不丢失
- [x] 4.3 实现聊天窗口单例逻辑：Rust `open_chat(options)` 命令——若 `chat` 窗口存在则 `set_focus` 并 `emit("chat-open-options", options)`，否则创建窗口并在 `ready` 后 emit
- [x] 4.4 对话视图：左侧会话列表（标题+预览+时间），右侧消息流（user 右对齐/assistant 左对齐），底部输入框 + 发送/停止按钮
- [x] 4.5 集成 Markdown 渲染：引入 `marked` + `dompurify`（与参考项目一致），assistant 消息渲染为安全 HTML，支持代码块/列表/链接
- [x] 4.6 实现流式渲染：监听 `chat-stream-delta` 事件，逐 token 追加到当前 assistant 消息气泡，自动滚动到底部
- [x] 4.7 角色设定视图：表单（userCallName/relationship/personalityBias下拉/tonePreference下拉/extraNotes textarea）+ 只读 coreIdentity/speechStyle 预览 + 保存按钮（调用 `update_persona_profile`）
- [x] 4.8 API 设置视图：状态显示（脱敏 masked 或"未配置"）、输入框、保存/删除/测试连接三按钮，测试连接时按钮 loading 禁用
- [x] 4.9 实现事件总线联动：`send_chat_message` 前端调用后，Rust 在开始流式时 `emit("business-state", {state:"busy"})`，结束时 `emit("business-state", {state:"idle"})`，桌宠窗口监听并切换立绘状态

## 5. 联动与状态机整合

- [x] 5.1 桌宠窗口监听 `business-state` 事件，收到 `busy` 时调用 `PetController.setBusinessState("busy")`，收到 `idle` 时 `setBusinessState(null)`
- [x] 5.2 验证状态优先级：busy 中拖拽显示 drag，松开后恢复 busy；busy 中单击仍能弹出气泡菜单
- [x] 5.3 桌宠气泡在 busy 时显示"胡桃正在想…"占位文案，流式结束后清除
- [x] 5.4 聊天窗口关闭时不影响桌宠常驻；桌宠隐藏时不影响聊天窗口已发起的流式回复

## 6. 收尾与验证

- [x] 6.1 用 `curl` 验证 DeepSeek API 端点与 `deepseek-v4-flash` 模型名可用（若失效，更新 `deepseek.rs` 中的模型常量）
- [x] 6.2 端到端测试：启动应用 → 配置 API Key → 测试连接 → 新建会话 → 发送消息 → 验证流式回复 + 桌宠 busy 动画 + Markdown 渲染
- [x] 6.3 测试拖拽 + 位置持久化 + 重启恢复
- [x] 6.4 测试托盘菜单：显示/隐藏、聊天、退出
- [x] 6.5 测试错误路径：未配置 Key 发消息、删除 Key 后发消息、网络断开发消息、流式中停止
- [x] 6.6 测试角色设定：修改字段保存 → 新对话使用新人设
- [x] 6.7 测试会话管理：新建/重命名/删除会话（验证级联删消息）
- [x] 6.8 `cargo tauri build` 产出 `.app`，验证打包后可独立运行
- [x] 6.9 清理参考项目 clone（`/tmp/desktop-pet-ref` 不属于本仓库，无需处理；移除任何临时调试代码）
