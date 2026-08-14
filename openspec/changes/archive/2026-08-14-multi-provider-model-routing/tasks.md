## 1. 领域模型与统一协议 / Domain Model and Unified Protocol

- [x] 1.1 在 `src/shared/types.ts` 定义 ProviderType、ProviderConnection、CredentialStatus、ModelProfile 和模型能力类型，确保 renderer 不包含明文 API Key 字段 / Define ProviderType, ProviderConnection, CredentialStatus, ModelProfile, and model-capability types in `src/shared/types.ts`, ensuring the renderer contains no plaintext API-key field
- [x] 1.2 定义供应商无关的聊天请求、增量/完成/中止事件和统一错误类别，并为模型配置选择与请求快照提供共享类型 / Define provider-independent chat requests, delta/completion/abort events, and unified error categories, with shared types for model selection and request snapshots
- [x] 1.3 增加内置供应商注册表和模型配置校验规则，覆盖重复标识、缺失凭据、停用模型和非法端点 / Add the built-in provider registry and model-configuration validation rules covering duplicate identifiers, missing credentials, disabled models, and invalid endpoints

## 2. 多凭据存储与安全边界 / Multi-Credential Storage and Security Boundary

- [x] 2.1 将单一 DeepSeek 密钥存储重构为按 credentialId 管理的安全存储，复用 Electron safeStorage 并在不可用时失败关闭 / Refactor single-DeepSeek-key storage into credentialId-based secure storage, reuse Electron safeStorage, and fail closed when it is unavailable
- [x] 2.2 实现凭据状态、掩码、测试和删除 API，确保 IPC/preload 不提供读取明文 API Key 的接口 / Implement credential status, masking, testing, and deletion APIs, ensuring IPC/preload provides no interface for reading plaintext API keys
- [x] 2.3 实现统一日志/错误脱敏，覆盖 Authorization、查询参数、供应商响应和异常堆栈中的敏感字段 / Implement unified log/error redaction covering sensitive fields in Authorization, query parameters, provider responses, and exception stacks
- [x] 2.4 增加 ProviderConnection、Credential 和 ModelProfile 的主进程 CRUD 及启用状态校验 / Add main-process CRUD and enabled-state validation for ProviderConnection, Credential, and ModelProfile

## 3. 数据库与旧数据迁移 / Database and Legacy-Data Migration

- [x] 3.1 为会话增加当前 modelProfileId，为消息增加供应商连接、供应商模型 ID 和显示名称快照字段，并保持旧字段兼容 / Add the current modelProfileId to conversations and provider-connection, provider-model-ID, and display-name snapshot fields to messages while preserving legacy-field compatibility
- [x] 3.2 实现旧 `deepseek-api-key.bin` 到默认 DeepSeek Credential/Connection/ModelProfile 的事务式迁移和迁移标记 / Implement transactional migration from legacy `deepseek-api-key.bin` to the default DeepSeek Credential/Connection/ModelProfile and add a migration marker
- [x] 3.3 为缺失模型字段的旧会话提供默认 DeepSeek 解释路径，验证消息正文、时间线和回复语言不被改写 / Provide a default-DeepSeek resolution path for old conversations without model fields and verify that message bodies, timelines, and response languages are not rewritten
- [x] 3.4 编写迁移成功、迁移失败保留旧数据、重复启动幂等和回滚 fixture 测试 / Write fixtures testing successful migration, preservation of legacy data on failure, idempotence across repeated starts, and rollback

## 4. 供应商适配与聊天路由 / Provider Adapters and Chat Routing

- [x] 4.1 将现有 DeepSeek SSE 请求封装为首个 OpenAI-compatible Provider Adapter，使 Base URL 和模型名来自连接/模型配置 / Wrap the existing DeepSeek SSE request as the first OpenAI-compatible Provider Adapter, with Base URL and model name supplied by connection/model configuration
- [x] 4.2 实现 Model Router：根据发送时的 ModelProfile 解析连接、获取凭据并调用对应适配器，不让 ChatService 依赖 DeepSeek 实现 / Implement the Model Router to resolve the connection, obtain credentials, and call the adapter from the send-time ModelProfile without making ChatService depend on DeepSeek implementation
- [x] 4.3 保留现有流式增量、完成、空闲超时、取消和重试语义，并把供应商错误映射为统一错误类别且完成脱敏 / Preserve streaming delta, completion, idle-timeout, cancellation, and retry semantics; map provider errors to unified categories and redact them
- [x] 4.4 为适配器和路由器增加凭据隔离、模型不存在、认证失败、限流、超时、取消和供应商不可用的契约测试 / Add adapter and router contract tests for credential isolation, missing models, authentication failures, rate limits, timeouts, cancellation, and provider unavailability

## 5. IPC 与设置界面 / IPC and Settings UI

- [x] 5.1 扩展主进程、preload 和共享 API 类型，提供供应商连接、凭据、模型配置的状态查询和变更操作 / Extend main-process, preload, and shared API types to provide status queries and mutations for provider connections, credentials, and model configurations
- [x] 5.2 在总设置中增加供应商连接、API Key 掩码状态、模型列表、默认模型、测试和删除界面 / Add provider connections, API-key mask status, model list, default model, testing, and deletion UI to global settings
- [x] 5.3 在设置保存前执行 HTTPS/受控 localhost 端点校验，拒绝 `file:`, `data:`, `javascript:` 等非法协议和不符合策略的地址 / Validate HTTPS/controlled-localhost endpoints before saving settings, rejecting invalid protocols such as `file:`, `data:`, and `javascript:` and addresses outside policy
- [x] 5.4 增加首次使用供应商的隐私提示和用户确认状态，禁止从项目文件或远程配置动态加载可执行 Provider / Add a first-use provider privacy notice and user-confirmation state; prohibit dynamically loading executable Providers from project files or remote configuration

## 6. 对话框模型选择与快照语义 / Conversation Model Selection and Snapshot Semantics

- [x] 6.1 在对话框底部增加已启用且凭据可用的 ModelProfile 选择器，显示供应商和模型名称，不显示 API Key 编辑控件 / Add a selector at the bottom of the conversation UI for enabled ModelProfiles with available credentials, show provider/model names, and show no API-key editing controls
- [x] 6.2 实现新会话继承全局默认模型、已有会话保存当前模型和无可用模型时阻止发送的交互逻辑 / Implement interactions where new conversations inherit the global default model, existing conversations save the current model, and sending is blocked when no model is available
- [x] 6.3 在发送前同时快照会话语言、ModelProfile、供应商连接和模型标识，确保生成期间切换只影响后续消息 / Snapshot conversation language, ModelProfile, provider connection, and model identifier together before sending, ensuring switches during generation affect only subsequent messages
- [x] 6.4 为历史消息显示模型快照，并验证编辑/删除当前配置不会改写既有消息或阻止历史读取 / Display model snapshots for historical messages and verify that editing/deleting current configurations neither rewrites existing messages nor blocks history reads

## 7. 测试与验收 / Testing and Acceptance

- [x] 7.1 增加多供应商/多 Key 隔离、IPC 明文 Key 不可达、日志脱敏和端点策略测试 / Add tests for multi-provider/multi-key isolation, IPC inaccessibility of plaintext keys, log redaction, and endpoint policy
- [x] 7.2 增加模型切换只影响后续消息、流式请求不串线、取消不影响其他会话和三语语言约束保持不变的测试 / Add tests confirming that model switches affect only subsequent messages, streaming requests do not cross wires, cancellation does not affect other conversations, and three-language constraints remain unchanged
- [x] 7.3 运行 TypeScript 类型检查、单元测试、构建和 OpenSpec 严格校验，记录 DeepSeek 真实 API/UI 冒烟为可选人工验收项 / Run TypeScript type checking, unit tests, build, and strict OpenSpec validation; record the real DeepSeek API/UI smoke test as an optional manual-acceptance item
- [x] 7.4 在实现第二个供应商适配器前复核本变更的范围，确认没有引入动态插件、本地模型运行时或供应商特有高级协议 / Review this change's scope before implementing a second provider adapter and confirm that dynamic plugins, local-model runtimes, and provider-specific advanced protocols were not introduced
