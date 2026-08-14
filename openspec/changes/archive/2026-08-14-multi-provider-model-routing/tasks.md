## 1. 领域模型与统一协议

- [x] 1.1 在 `src/shared/types.ts` 定义 ProviderType、ProviderConnection、CredentialStatus、ModelProfile 和模型能力类型，确保 renderer 不包含明文 API Key 字段
- [x] 1.2 定义供应商无关的聊天请求、增量/完成/中止事件和统一错误类别，并为模型配置选择与请求快照提供共享类型
- [x] 1.3 增加内置供应商注册表和模型配置校验规则，覆盖重复标识、缺失凭据、停用模型和非法端点

## 2. 多凭据存储与安全边界

- [x] 2.1 将单一 DeepSeek 密钥存储重构为按 credentialId 管理的安全存储，复用 Electron safeStorage 并在不可用时失败关闭
- [x] 2.2 实现凭据状态、掩码、测试和删除 API，确保 IPC/preload 不提供读取明文 API Key 的接口
- [x] 2.3 实现统一日志/错误脱敏，覆盖 Authorization、查询参数、供应商响应和异常堆栈中的敏感字段
- [x] 2.4 增加 ProviderConnection、Credential 和 ModelProfile 的主进程 CRUD 及启用状态校验

## 3. 数据库与旧数据迁移

- [x] 3.1 为会话增加当前 modelProfileId，为消息增加供应商连接、供应商模型 ID 和显示名称快照字段，并保持旧字段兼容
- [x] 3.2 实现旧 `deepseek-api-key.bin` 到默认 DeepSeek Credential/Connection/ModelProfile 的事务式迁移和迁移标记
- [x] 3.3 为缺失模型字段的旧会话提供默认 DeepSeek 解释路径，验证消息正文、时间线和回复语言不被改写
- [x] 3.4 编写迁移成功、迁移失败保留旧数据、重复启动幂等和回滚 fixture 测试

## 4. 供应商适配与聊天路由

- [x] 4.1 将现有 DeepSeek SSE 请求封装为首个 OpenAI-compatible Provider Adapter，使 Base URL 和模型名来自连接/模型配置
- [x] 4.2 实现 Model Router：根据发送时的 ModelProfile 解析连接、获取凭据并调用对应适配器，不让 ChatService 依赖 DeepSeek 实现
- [x] 4.3 保留现有流式增量、完成、空闲超时、取消和重试语义，并把供应商错误映射为统一错误类别且完成脱敏
- [x] 4.4 为适配器和路由器增加凭据隔离、模型不存在、认证失败、限流、超时、取消和供应商不可用的契约测试

## 5. IPC 与设置界面

- [x] 5.1 扩展主进程、preload 和共享 API 类型，提供供应商连接、凭据、模型配置的状态查询和变更操作
- [x] 5.2 在总设置中增加供应商连接、API Key 掩码状态、模型列表、默认模型、测试和删除界面
- [x] 5.3 在设置保存前执行 HTTPS/受控 localhost 端点校验，拒绝 `file:`, `data:`, `javascript:` 等非法协议和不符合策略的地址
- [x] 5.4 增加首次使用供应商的隐私提示和用户确认状态，禁止从项目文件或远程配置动态加载可执行 Provider

## 6. 对话框模型选择与快照语义

- [x] 6.1 在对话框底部增加已启用且凭据可用的 ModelProfile 选择器，显示供应商和模型名称，不显示 API Key 编辑控件
- [x] 6.2 实现新会话继承全局默认模型、已有会话保存当前模型和无可用模型时阻止发送的交互逻辑
- [x] 6.3 在发送前同时快照会话语言、ModelProfile、供应商连接和模型标识，确保生成期间切换只影响后续消息
- [x] 6.4 为历史消息显示模型快照，并验证编辑/删除当前配置不会改写既有消息或阻止历史读取

## 7. 测试与验收

- [x] 7.1 增加多供应商/多 Key 隔离、IPC 明文 Key 不可达、日志脱敏和端点策略测试
- [x] 7.2 增加模型切换只影响后续消息、流式请求不串线、取消不影响其他会话和三语语言约束保持不变的测试
- [x] 7.3 运行 TypeScript 类型检查、单元测试、构建和 OpenSpec 严格校验，记录 DeepSeek 真实 API/UI 冒烟为可选人工验收项
- [x] 7.4 在实现第二个供应商适配器前复核本变更的范围，确认没有引入动态插件、本地模型运行时或供应商特有高级协议
