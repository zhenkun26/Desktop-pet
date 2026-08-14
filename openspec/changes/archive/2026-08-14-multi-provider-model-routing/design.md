## 背景 / Context

现有聊天链路在主进程中直接读取单个 DeepSeek Key，并由 DeepSeek 客户端固定 API 地址、模型和 SSE 请求格式；渲染层通过有限的 IPC 暴露 Key 状态。SQLite 已保存会话语言，但尚未保存供应商或模型快照。设计需要保留现有流式事件、取消行为和三语语言快照，同时扩大配置和路由维度。

The existing chat chain reads a single DeepSeek key directly in the main process, while the DeepSeek client fixes the API address, model, and SSE request format; the renderer exposes key status through limited IPC. SQLite already stores conversation language but not provider or model snapshots. The design must preserve existing streaming events, cancellation behavior, and three-language snapshots while expanding configuration and routing dimensions.

## 目标 / 非目标 / Goals / Non-Goals

**目标 / Goals:**

- 使用统一的供应商连接、凭据和模型配置表达多公司、多模型和多 API Key。 / Represent multiple companies, models, and API keys with unified provider-connection, credential, and model-configuration concepts.
- 让聊天服务只依赖统一的请求/流式事件协议，通过路由选择供应商适配器。 / Make the chat service depend only on a unified request/stream-event protocol and select provider adapters through routing.
- 保证明文 Key 只在主进程短暂存在，并可从旧版单 Key 安全迁移。 / Ensure plaintext keys exist only briefly in the main process and can be safely migrated from the legacy single-key format.
- 让模型选择在对话框可见、可持久化，并严格遵守“只影响后续消息”的快照语义。 / Make model selection visible and persistent in the conversation UI while strictly preserving the “subsequent messages only” snapshot semantics.
- 通过契约测试、迁移测试和脱敏测试保证新增适配器不会破坏 DeepSeek 行为。 / Use contract, migration, and redaction tests to ensure new adapters do not break DeepSeek behavior.

**非目标 / Non-Goals:**

- 本变更不实现远程插件加载、本地模型下载/进程管理、计费或用量统计。 / This change does not implement remote-plugin loading, local-model download/process management, billing, or usage metrics.
- 本变更不统一所有供应商的高级工具调用、图像输入或供应商特有参数；只抽象当前文本 SSE 聊天所需能力。 / This change does not unify every provider's advanced tool calling, image input, or provider-specific parameters; it abstracts only the capabilities required by current text SSE chat.

## 决策 / Decisions

### 1. 将协议类型、供应商连接和模型配置分层 / Separate Protocol Type, Provider Connection, and Model Profile Layers

采用三层概念： / Use three layers:

- **ProviderType**：协议适配类型，例如 `openai-compatible`；不包含凭据。 / **ProviderType**: a protocol-adapter type such as `openai-compatible`; it contains no credentials.
- **ProviderConnection**：公司/账户级连接，包含显示名称、Base URL、ProviderType、启用状态和 `credentialId`。 / **ProviderConnection**: a company/account-level connection containing a display name, Base URL, ProviderType, enabled status, and `credentialId`.
- **ModelProfile**：用户可选择的模型，包含连接 ID、供应商模型 ID、显示名称、能力标记和启用状态。 / **ModelProfile**: a user-selectable model containing a connection ID, provider model ID, display name, capability flags, and enabled status.

默认由多个 ModelProfile 共享一个 ProviderConnection 的凭据；需要按模型隔离 Key 时，为模型创建独立连接或独立凭据引用。这样既支持公司级共享 Key，也不把 Key 绑定到聊天会话。

By default, multiple ModelProfiles share the credential of one ProviderConnection. When keys must be isolated per model, create a separate connection or credential reference for that model. This supports company-level shared keys without binding a key to a chat conversation.

备选方案是让每个模型直接携带 Base URL 和 Key，但会造成重复凭据、迁移困难和 UI 泄露风险，因此不采用。

The alternative of putting a Base URL and key directly on every model would duplicate credentials, complicate migration, and risk UI exposure, so it is not adopted.

### 2. 使用适配器注册表和统一事件协议 / Use an Adapter Registry and Unified Event Protocol

聊天服务调用模型路由器，路由器根据 ModelProfile 找到 ProviderType 适配器，再由适配器取得对应凭据并发起请求。适配器输入为供应商无关的消息、模型 ID、取消信号和请求参数；输出统一为增量文本、完成、错误和中止事件。

The chat service calls the model router. The router finds the ProviderType adapter from the ModelProfile, and the adapter obtains the corresponding credential and starts the request. Adapter input consists of provider-independent messages, model ID, cancellation signal, and request parameters; output is normalized to delta-text, completion, error, and abort events.

第一阶段将现有 DeepSeek 实现迁移为 `openai-compatible` 适配器，Base URL 和模型名来自连接/模型配置，保留现有 SSE 解析、空闲超时和取消语义。后续供应商只能通过新增适配器接入，不把供应商判断散落到 ChatService 或 UI。

In the first phase, migrate the existing DeepSeek implementation to an `openai-compatible` adapter. The Base URL and model name come from connection/model configuration, while existing SSE parsing, idle timeout, and cancellation semantics remain. Future providers can be added only through new adapters; provider checks must not be scattered through ChatService or the UI.

错误映射集中在适配器边界，统一为认证失败、凭据缺失、限流、模型不支持、供应商不可用、超时和用户取消等稳定类别；错误消息统一脱敏。

Error mapping is centralized at the adapter boundary into stable categories such as authentication failure, missing credential, rate limit, unsupported model, provider unavailable, timeout, and user cancellation; error messages are redacted consistently.

### 3. 将凭据存储限制在主进程 / Keep Credential Storage in the Main Process

凭据存储按 `credentialId` 分文件或加密记录保存，使用现有 Electron `safeStorage` 能力。主进程只向 preload/renderer 提供凭据状态、掩码、最后测试时间和标识；发送消息时由主进程按模型配置读取明文 Key，并直接发起网络请求。

Store credentials in per-`credentialId` files or encrypted records using Electron's existing `safeStorage` capability. The main process exposes only credential status, mask, last-test time, and identifier to preload/renderer; when sending a message, the main process reads the plaintext key by model configuration and starts the network request directly.

IPC 不提供“读取明文 Key”的接口。日志、错误、数据库和导出内容使用统一脱敏函数，禁止把 `Authorization`、查询参数或供应商响应中的敏感字段写入日志。

IPC MUST NOT provide an interface to “read plaintext keys.” Logs, errors, database records, and exports use a shared redaction function; sensitive fields from `Authorization`, query parameters, or provider responses MUST NOT be written to logs.

### 4. 持久化会话选择和消息快照 / Persist Conversation Selection and Message Snapshots

在会话级保存当前 `modelProfileId`，用于对话框显示和后续消息默认选择；在消息级保存发送时的供应商连接 ID、供应商模型 ID 和显示名称快照。消息不保存 `credentialId` 以外的秘密内容，也不依赖当前配置才能展示历史记录。

Store the current `modelProfileId` at conversation level for UI display and subsequent-message defaults. At message level, store the provider connection ID, provider model ID, and display-name snapshot from send time. Messages store no secret beyond a `credentialId` and do not depend on current configuration to display history.

发送请求时一次性读取会话语言和模型配置，构造不可变请求快照后再开始流式请求。用户在生成期间改变语言或模型，只更新会话后续默认值，不影响已经创建的快照。

Read the conversation language and model configuration once when sending, construct an immutable request snapshot, and then start streaming. Language or model changes during generation update only subsequent conversation defaults and do not affect the snapshot already created.

历史模型配置删除或编辑时保留消息快照；新消息只能从当前启用且凭据有效的 ModelProfile 中选择。

When historical model configurations are deleted or edited, retain message snapshots. New messages can select only currently enabled ModelProfiles with valid credentials.

### 5. 通过设置页管理连接，通过对话框选择 Profile / Manage Connections in Settings and Select Profiles in the Conversation UI

总设置负责新增、编辑、停用和测试 ProviderConnection、Credential 与 ModelProfile；对话框只显示已启用、凭据可用的模型配置，并提供当前会话的选择器。对话框不显示 API Key 编辑控件，也不允许临时输入任意端点。

Global settings handle creation, editing, disabling, and testing of ProviderConnection, Credential, and ModelProfile. The conversation UI shows only enabled model configurations with available credentials and provides a current-conversation selector. It does not show API-key editing controls or allow arbitrary temporary endpoints.

如果当前没有会话，选择器只改变新会话默认模型；如果已有会话，选择器更新该会话的后续消息模型。无可用模型时，发送按钮显示明确的配置提示并阻止网络请求。

Without an active conversation, the selector changes only the default model for new conversations. With an active conversation, it updates the model for that conversation's subsequent messages. When no model is available, the send button shows a clear configuration prompt and blocks network requests.

### 6. 采用可回滚的旧数据迁移 / Use a Reversible Legacy-Data Migration

首次启动时检测旧版 `deepseek-api-key.bin`：先验证并写入新的默认 DeepSeek Credential、Connection 和 ModelProfile，再以原子方式更新迁移标记；任一步失败都保留旧文件和旧数据库，不创建半完成引用。旧会话缺失模型字段时解释为默认 DeepSeek Profile，不改写消息正文、时间线或回复语言。

On first launch, detect the legacy `deepseek-api-key.bin`: validate and write the new default DeepSeek Credential, Connection, and ModelProfile first, then atomically update the migration marker. Any failure preserves the old file and database and creates no partial reference. Legacy conversations without a model field resolve to the default DeepSeek Profile without rewriting message bodies, timelines, or response languages.

### 7. 限制端点和网络数据路由 / Restrict Endpoints and Network Data Routing

默认只接受 HTTPS Base URL；如日后支持本地模型，必须显式启用并限制到 localhost 地址。保存连接前拒绝 `file:`, `data:`, `javascript:` 等非网络协议以及不符合策略的地址。ProviderType 只从内置注册表选择，禁止从项目文件或远程配置加载可执行代码。

Accept HTTPS Base URLs by default. If local models are supported later, they MUST be explicitly enabled and restricted to localhost addresses. Before saving a connection, reject non-network protocols such as `file:`, `data:`, and `javascript:` and addresses that violate policy. ProviderType values come only from the built-in registry; executable code MUST NOT be loaded from project files or remote configuration.

首次使用某个供应商前记录用户确认状态，并在设置/发送前说明消息将发送到该供应商。自定义端点策略应集中校验，避免未来新增适配器绕过安全检查。

Before first use of a provider, record user confirmation and explain in settings/before sending that messages will be sent to that provider. Custom endpoint policy must be validated centrally so future adapters cannot bypass security checks.

## 风险与权衡 / Risks / Trade-offs

- [Risk] 供应商之间的 SSE、错误码和上下文限制不同 → 适配器只承诺当前文本聊天最小能力；在边界统一错误类别，并为每个适配器执行同一契约测试。 / [Risk] SSE behavior, error codes, and context limits differ between providers → adapters promise only the minimum capability required by current text chat; normalize error categories at the boundary and run the same contract tests for every adapter.
- [Risk] 旧 Key 迁移中断可能导致用户无法发送 → 采用先写新记录、成功后标记、失败保留旧文件的事务式流程，并提供重新配置入口。 / [Risk] An interrupted legacy-key migration could prevent sending → write new records first, mark success afterward, preserve the old file on failure, and provide a reconfiguration entry point.
- [Risk] 自定义端点可能引入 SSRF 或意外数据路由 → MVP 不开放任意端点；所有地址经过协议、主机和 localhost 策略校验，禁止动态插件。 / [Risk] Custom endpoints could introduce SSRF or unintended data routing → the MVP does not expose arbitrary endpoints; every address passes protocol, host, and localhost-policy validation, and dynamic plugins are forbidden.
- [Risk] 用户切换模型时流式事件串线 → 请求创建时固定语言和模型快照，事件携带请求 ID，UI 只接收属于当前请求的事件。 / [Risk] Streaming events could cross wires when users switch models → fix language and model snapshots at request creation, include a request ID in events, and let the UI accept only events belonging to the current request.
- [Risk] 配置项增多导致设置页复杂 → 把供应商连接/凭据管理集中在设置页，对话框只展示可选 ModelProfile；先支持静态配置，不做自动发现。 / [Risk] More configuration could make settings complex → centralize provider-connection/credential management in settings and show only selectable ModelProfiles in the conversation UI; start with static configuration and no auto-discovery.
- [Risk] `safeStorage` 在部分系统不可用 → 检测不可用状态并失败关闭，禁止降级明文；提示用户配置安全存储后再启用供应商。 / [Risk] `safeStorage` may be unavailable on some systems → detect unavailability and fail closed, never downgrade to plaintext, and ask the user to configure secure storage before enabling a provider.

## 迁移计划 / Migration Plan

1. 先新增领域类型、统一事件/错误协议和适配器契约，使用现有 DeepSeek 实现作为兼容适配器。 / First add domain types, the unified event/error protocol, and the adapter contract, using the existing DeepSeek implementation as a compatibility adapter.
2. 增加多凭据存储、旧 Key 迁移和数据库兼容字段；执行迁移 fixture 和回滚测试。 / Add multi-credential storage, legacy-key migration, and database compatibility fields; run migration fixtures and rollback tests.
3. 将 ChatService 改为按 ModelProfile 路由，保持现有会话语言和 DeepSeek SSE 行为。 / Change ChatService to route by ModelProfile while preserving existing conversation-language and DeepSeek SSE behavior.
4. 增加设置页连接/凭据/模型管理和对话框模型选择器，补齐模型切换时机测试。 / Add connection/credential/model management in settings and the conversation model selector, then complete model-switch timing tests.
5. 完成脱敏、IPC 边界、端点策略和适配器契约测试后，再考虑引入第二个供应商适配器。 / Consider a second provider adapter only after redaction, IPC-boundary, endpoint-policy, and adapter-contract tests are complete.

回滚时保留旧 Key 文件和旧数据库字段；若新配置初始化失败，聊天服务可回退到只读的旧 DeepSeek 配置提示用户重新确认，不删除用户数据。

During rollback, retain the legacy key file and database fields. If new-configuration initialization fails, the chat service can fall back to a read-only legacy DeepSeek configuration and ask the user to confirm again without deleting user data.
