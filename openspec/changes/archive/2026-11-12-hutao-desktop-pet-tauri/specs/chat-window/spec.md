## Purpose

提供一个独立于桌宠窗口的聊天窗口，承载"对话 / 角色设定 / API 设置"三个视图，通过 Tauri 事件总线与桌宠窗口联动（聊天中驱动桌宠进入 busy 状态），让用户在不打断桌宠常驻桌面的前提下进行深度交互。

## ADDED Requirements

### Requirement: 独立聊天窗口

系统 SHALL 提供一个独立于桌宠窗口的聊天窗口，尺寸约 480×640 像素，带标准窗口装饰（标题栏、可关闭/最小化）。窗口 MUST 通过 Tauri `WebviewWindow` 创建，与桌宠窗口共享同一前端代码库但加载不同的入口 URL（或通过查询参数区分视图）。

#### Scenario: 从桌宠气泡打开聊天窗口

- **WHEN** 桌宠气泡菜单点击"和我聊天"
- **THEN** 聊天窗口创建（若不存在）或聚焦（若已存在）
- **AND** 默认显示对话视图

#### Scenario: 从桌宠气泡打开角色设定

- **WHEN** 桌宠气泡菜单点击"角色设定"
- **THEN** 聊天窗口创建或聚焦
- **AND** 直接切换到角色设定视图

#### Scenario: 聊天窗口单例

- **WHEN** 聊天窗口已存在
- **AND** 用户再次触发"和我聊天"
- **THEN** 系统聚焦已有聊天窗口，不创建新窗口

### Requirement: 三视图切换

聊天窗口 SHALL 包含三个视图：对话（默认）、角色设定、API 设置。视图切换 MUST 不丢失各视图的未保存状态（如对话输入框草稿、角色设定未保存字段）。视图切换通过前端路由或 tab 实现，不重新创建窗口。

#### Scenario: 默认进入对话视图

- **WHEN** 聊口窗口首次打开
- **THEN** 默认显示对话视图，展示会话列表和当前会话消息

#### Scenario: 切换到角色设定

- **WHEN** 用户点击"角色设定"tab
- **THEN** 视图切换到角色设定表单
- **AND** 加载当前持久化的角色字段

#### Scenario: 切换到 API 设置

- **WHEN** 用户点击"API"tab
- **THEN** 视图切换到 API 设置视图
- **AND** 显示当前 API Key 脱敏状态（configured + masked）

### Requirement: 对话视图交互

对话视图 SHALL 左侧展示会话列表（含标题、最后消息预览、更新时间），右侧展示当前会话的消息流和输入框。用户消息右对齐、assistant 消息左对齐，assistant 消息 MUST 支持 Markdown 渲染（含代码块、列表、链接）。流式回复过程中输入框 MUST 显示"停止"按钮替代"发送"按钮。

#### Scenario: 选择会话加载消息

- **WHEN** 用户在会话列表点击某个会话
- **THEN** 右侧加载该会话的全部消息
- **AND** 滚动到最新消息

#### Scenario: 发送消息

- **WHEN** 用户在输入框输入文本并点击"发送"（或按 Cmd/Ctrl+Enter）
- **THEN** 用户消息立即追加到消息流
- **AND** 发起流式请求
- **AND** 输入框清空，"发送"按钮变为"停止"按钮

#### Scenario: 流式回复实时渲染

- **WHEN** 流式 delta 事件到达
- **THEN** assistant 消息气泡逐 token 追加内容
- **AND** 自动滚动到底部

#### Scenario: 停止生成

- **WHEN** 流式进行中用户点击"停止"
- **THEN** 流被中止
- **AND** 已生成内容保留为一条 cancelled 消息
- **AND** "停止"按钮变回"发送"按钮

### Requirement: 角色设定视图

角色设定视图 SHALL 展示一个表单，包含五个可编辑字段（userCallName、relationship、personalityBias、tonePreference、extraNotes）和只读的 coreIdentity/speechStyle 预览。性格和语气 MUST 用下拉选择（枚举值），其余为文本输入。保存按钮 MUST 调用 IPC 持久化字段并显示成功反馈。

#### Scenario: 加载已有设定

- **WHEN** 角色设定视图打开
- **THEN** 表单字段显示当前持久化值（首次使用显示默认值）

#### Scenario: 保存设定反馈

- **WHEN** 用户修改字段并点击"保存"
- **THEN** 系统调用 IPC 持久化
- **AND** 显示"已保存"成功提示
- **AND** 后续对话使用新人设

### Requirement: API 设置视图

API 设置视图 SHALL 展示当前 API Key 状态（脱敏 masked 字符串或"未配置"）、输入框（用于设置/修改 Key）、"保存"、"删除"、"测试连接"三个操作按钮。视图 MUST 在用户未配置 Key 时引导用户先设置。

#### Scenario: 首次进入未配置状态

- **WHEN** 用户首次打开 API 设置视图且未配置 Key
- **THEN** 状态显示"未配置"
- **AND** 输入框为空，placeholder 提示输入 DeepSeek API Key

#### Scenario: 测试连接反馈

- **WHEN** 用户点击"测试连接"
- **THEN** 按钮显示 loading 状态
- **AND** 测试完成后显示成功或失败消息
- **AND** 测试期间按钮禁用

### Requirement: 聊天窗口与桌宠联动

系统 SHALL 通过 Tauri 事件总线实现聊天窗口与桌宠窗口的状态联动。当聊天窗口发起流式回复时 MUST 广播事件让桌宠进入 `busy` 状态；流式结束（done/error/cancelled）时 MUST 广播事件让桌宠回到 `idle` 状态。

#### Scenario: 聊天中桌宠进入 busy

- **WHEN** 聊天窗口发起流式回复
- **THEN** 桌宠窗口收到事件，立绘切换为 `busy` 状态
- **AND** 桌宠气泡显示"胡桃正在想…"（或类似占位文案）

#### Scenario: 流式结束桌宠回到 idle

- **WHEN** 流式回复结束（done/error/cancelled）
- **THEN** 桌宠窗口收到事件，立绘回到 `idle` 状态（除非用户正在拖拽）
- **AND** 气泡可显示完成提示或清除占位文案

#### Scenario: 桌宠被拖拽时不受 busy 覆盖

- **WHEN** 流式进行中（busy）且用户正在拖拽桌宠
- **THEN** 拖拽期间显示 `drag` 状态
- **AND** 松开鼠标后恢复 `busy` 状态
