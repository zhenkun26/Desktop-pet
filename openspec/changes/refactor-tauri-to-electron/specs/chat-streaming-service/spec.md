# spec.md — chat-streaming-service（新增 capability）

## ADDED Requirements

### Requirement: 消息状态机前置落库
系统 SHALL 在收到发送请求时立即插入 assistant 消息行（`status='streaming'`, `content=''`），并在每个流式 delta 到达时更新该行内容；生成结束 SHALL 将状态置为 `complete`，用户停止置为 `cancelled`，失败置为 `error`。

#### Scenario: 生成中途重载
- **WHEN** 生成进行中用户关闭并重开聊天窗口或切换会话
- **THEN** 系统返回的消息列表包含该 streaming 行及已生成的部分内容，界面可据此恢复或等待完结

### Requirement: 完成信号不依赖事件通道
系统 SHALL 让 `send-chat-message` 的 IPC 调用在生成终结（complete/cancelled/error）后才返回，返回结果携带最终状态。

#### Scenario: 事件全部丢失
- **WHEN** chat-stream 事件因任何原因未送达渲染层
- **THEN** 渲染层通过 invoke 返回信号重载消息，界面仍然正确完结，不卡在思考中

### Requirement: 事件定向投递
系统 SHALL 通过订阅-转发模式把流式事件定向发送到聊天窗口（webContents.send），不使用全局广播；事件 SHALL 携带 `assistantMessageId` 以便渲染层关联消息行。

#### Scenario: 多窗口
- **WHEN** 桌宠窗口与聊天窗口同时打开
- **THEN** 聊天流事件只投递聊天窗口，桌宠窗口仅收到 busy/idle 业务状态事件

### Requirement: 旧数据一次性迁移
系统 SHALL 在新库为空且检测到旧 Tauri 数据目录（`com.hutao-desktop-pet/chat.db`）时，自动迁移全部会话与消息（status `ok` 映射为 `complete`），旧库只读不修改。

#### Scenario: 迁移失败
- **WHEN** 旧库损坏或读取失败
- **THEN** 记录日志并继续以空库启动，不阻塞应用
