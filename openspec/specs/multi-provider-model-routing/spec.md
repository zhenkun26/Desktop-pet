# multi-provider-model-routing Specification / 多供应商多模型路由规范

## Purpose

**目的 / Purpose**

为 Desktop-pet 提供可配置、可隔离且可扩展的多供应商多模型聊天能力，让用户可以管理不同公司的 API Key，并在不泄露凭据的前提下选择后续消息使用的模型。

Provide Desktop-pet with configurable, isolated, and extensible multi-provider, multi-model chat capabilities, allowing users to manage API keys from different companies and select the model for subsequent messages without exposing credentials.

## Requirements

**需求 / Requirements**

### Requirement: 多供应商连接与模型配置 / Multi-Provider Connections and Model Configuration

系统 SHALL 支持配置多个供应商连接、多个模型以及多个凭据。每个可选模型 SHALL 关联一个供应商连接和一个凭据标识；多个模型可以共享同一凭据，同一供应商的不同模型也可以使用不同凭据。模型配置 SHALL 展示供应商名称、模型名称和启用状态。

The system SHALL support configuring multiple provider connections, models, and credentials. Each selectable model SHALL reference one provider connection and one credential identifier; multiple models MAY share one credential, while different models from the same provider MAY use different credentials. A model configuration SHALL display the provider name, model name, and enabled status.

#### Scenario: 配置同一供应商的多个模型 / Configure Multiple Models for One Provider

- **WHEN** 用户为同一供应商配置模型 A 和模型 B，并让两者共享一个凭据
- **WHEN** the user configures models A and B for the same provider and lets them share one credential
- **THEN** 设置页展示两个可独立启用或停用的模型配置，且两者引用同一个凭据标识
- **THEN** the settings page shows two independently enableable model configurations, both referencing the same credential identifier

#### Scenario: 配置不同公司的同协议服务 / Configure Same-Protocol Services from Different Companies

- **WHEN** 用户配置两个使用相同协议但属于不同公司的供应商连接
- **WHEN** the user configures two provider connections that use the same protocol but belong to different companies
- **THEN** 两个连接可以分别保存端点、模型和凭据，选择其中一个模型不会使用另一个连接的凭据
- **THEN** the two connections can store endpoints, models, and credentials independently; selecting a model from one connection MUST NOT use the other connection's credential

#### Scenario: 没有可用模型 / No Available Model

- **WHEN** 所有模型配置均被停用或缺少有效凭据
- **WHEN** all model configurations are disabled or lack valid credentials
- **THEN** 系统明确提示无法发送消息，并阻止请求进入供应商
- **THEN** the system clearly indicates that messages cannot be sent and prevents requests from reaching a provider

### Requirement: 凭据隔离与主进程边界 / Credential Isolation and Main-Process Boundary

系统 SHALL 在主进程安全保存和读取 API Key，渲染层及其持久化消息数据 SHALL 只能接收凭据标识、掩码和连接状态，不得接收明文 API Key。不同凭据 SHALL 相互隔离，删除或替换一个凭据不得改变其他模型配置的凭据引用。

The system SHALL securely store and read API keys in the main process. The renderer and its persisted message data SHALL receive only credential identifiers, masks, and connection status, and MUST NOT receive plaintext API keys. Credentials SHALL remain isolated; deleting or replacing one credential MUST NOT change the credential references of other model configurations.

#### Scenario: 设置页保存 API Key / Save an API Key in Settings

- **WHEN** 用户在设置页为某个供应商连接保存 API Key
- **WHEN** the user saves an API key for a provider connection in settings
- **THEN** 系统返回该凭据的掩码和可用状态，渲染层、聊天记录和普通日志中均不存在该 Key 明文
- **THEN** the system returns the credential mask and availability status, and plaintext of the key is absent from the renderer, chat history, and ordinary logs

#### Scenario: 多凭据并存 / Keep Multiple Credentials Isolated

- **WHEN** 用户分别为供应商连接 A 和 B 保存两个 API Key
- **WHEN** the user saves two API keys separately for provider connections A and B
- **THEN** 使用 A 的模型只读取 A 的 Key，使用 B 的模型只读取 B 的 Key，删除 A 不影响 B
- **THEN** models from A read only A's key, models from B read only B's key, and deleting A does not affect B

#### Scenario: 凭据不可用 / Credential Unavailable

- **WHEN** 操作系统安全存储不可用或凭据解密失败
- **WHEN** operating-system secure storage is unavailable or credential decryption fails
- **THEN** 系统拒绝以明文或其他未加密方式保存 Key，并将该凭据标记为不可用
- **THEN** the system refuses to save the key in plaintext or another unencrypted form and marks the credential as unavailable

### Requirement: 对话框模型选择与生效时机 / Conversation Model Selection and Activation Timing

系统 SHALL 在对话框提供当前已启用模型配置的选择器。用户切换模型后，只有切换完成后新发起的消息使用新模型；已经开始的流式请求 SHALL 继续使用请求开始时的模型、供应商和凭据快照。未指定会话模型时，新会话 SHALL 使用总设置中的默认模型。

The system SHALL provide a selector in the conversation UI for currently enabled model configurations. After a model switch, only messages started after the switch completes use the new model; an already-started streaming request SHALL continue using the model, provider, and credential snapshot captured at request start. When a conversation has no model specified, a new conversation SHALL use the default model from global settings.

#### Scenario: 新会话继承默认模型 / New Conversations Inherit the Default Model

- **WHEN** 用户将默认模型设置为模型 A 后创建新会话
- **WHEN** the user sets model A as the default model and creates a new conversation
- **THEN** 新会话显示并使用模型 A，直到用户为该会话选择其他模型
- **THEN** the new conversation displays and uses model A until the user selects another model for that conversation

#### Scenario: 会话中途切换模型 / Switch Models during a Conversation

- **WHEN** 当前会话正在使用模型 A，用户切换为模型 B 后发送新消息
- **WHEN** the current conversation is using model A and the user switches to model B before sending a new message
- **THEN** 新消息使用模型 B，既有消息保持不变，模型 A 的历史请求不会被重写
- **THEN** the new message uses model B, existing messages remain unchanged, and historical requests made with model A are not rewritten

#### Scenario: 生成期间切换模型 / Switch Models during Generation

- **WHEN** 模型 A 正在流式生成，用户切换为模型 B
- **WHEN** model A is streaming a response and the user switches to model B
- **THEN** 当前生成继续使用模型 A；切换只对下一次发送生效，不得改变或混合当前流的事件
- **THEN** the current generation continues using model A; the switch applies only to the next send and MUST NOT alter or mix events from the current stream

### Requirement: 按模型配置路由并统一流式行为 / Route by Model Configuration with Unified Streaming

聊天服务 SHALL 根据消息发送时的模型配置，将请求路由到对应供应商，并将不同供应商的增量文本、完成、错误和取消结果转换为统一的聊天事件。供应商实现不得要求调用方把供应商专用请求或响应格式传入聊天 UI。

The chat service SHALL route each request to the corresponding provider based on the model configuration at send time, and convert provider-specific delta text, completion, error, and cancellation results into unified chat events. Provider implementations MUST NOT require callers to pass provider-specific request or response formats into the chat UI.

#### Scenario: DeepSeek 模型流式响应 / Stream a DeepSeek Model Response

- **WHEN** 用户选择已配置凭据的 DeepSeek 模型并发送消息
- **WHEN** the user selects a DeepSeek model with a configured credential and sends a message
- **THEN** 请求发送到该模型所属连接，增量文本按照现有流式顺序展示并保存，且三语回复语言约束保持不变
- **THEN** the request is sent through the connection owning that model, delta text is displayed and persisted in the existing streaming order, and the three-language response constraint remains unchanged

#### Scenario: 供应商请求失败 / Provider Request Failure

- **WHEN** 选定供应商返回认证失败、限流、模型不存在、超时或服务不可用
- **WHEN** the selected provider returns an authentication failure, rate limit, missing model, timeout, or unavailable-service response
- **THEN** 系统返回稳定的错误类别和可读提示，不泄露请求头、API Key 或供应商内部敏感信息
- **THEN** the system returns a stable error category and readable message without exposing request headers, API keys, or provider-internal sensitive information

#### Scenario: 用户取消请求 / User Cancels a Request

- **WHEN** 用户取消正在进行的流式请求
- **WHEN** the user cancels an in-progress streaming request
- **THEN** 对应供应商请求被取消，当前消息被标记为中止，其他会话或后续请求不受影响
- **THEN** the corresponding provider request is cancelled, the current message is marked as aborted, and other conversations or subsequent requests are unaffected

### Requirement: 模型与请求快照可追溯 / Traceable Model and Request Snapshots

系统 SHALL 为每条新发送的消息记录发送时使用的模型配置、供应商连接和模型标识快照，但不得记录 API Key 明文。历史消息 SHALL 按保存的快照展示，不因之后编辑或删除模型配置而改写。

The system SHALL record the model configuration, provider connection, and model-identifier snapshot used when each new message is sent, but MUST NOT record plaintext API keys. Historical messages SHALL be displayed according to their saved snapshots and MUST NOT be rewritten when model configurations are later edited or deleted.

#### Scenario: 删除已使用的模型配置 / Delete a Model Configuration Used by History

- **WHEN** 用户删除一个已经产生历史消息的模型配置
- **WHEN** the user deletes a model configuration that has already produced historical messages
- **THEN** 历史消息仍可读取并显示原供应商和模型信息，新消息不得再选择该配置
- **THEN** historical messages remain readable and show the original provider and model information, while new messages MUST NOT select the deleted configuration

#### Scenario: 重新编辑模型名称 / Edit a Model Name Again

- **WHEN** 用户修改模型配置的显示名称或端点
- **WHEN** the user changes the display name or endpoint of a model configuration
- **THEN** 后续消息使用新配置，既有消息保留发送时的模型标识和连接快照
- **THEN** subsequent messages use the new configuration, while existing messages retain the model identifier and connection snapshot from send time

### Requirement: 旧版本凭据与会话兼容 / Compatibility with Legacy Credentials and Conversations

系统 SHALL 将旧版本单个 DeepSeek API Key 迁移为一个默认 DeepSeek 凭据和模型配置。没有模型字段的旧会话和消息 SHALL 解释为该默认配置；迁移不得改写既有消息正文、时间线或回复语言。

The system SHALL migrate a legacy single DeepSeek API key into a default DeepSeek credential and model configuration. Older conversations and messages without model fields SHALL be interpreted as using that default configuration; migration MUST NOT rewrite existing message bodies, timelines, or response languages.

#### Scenario: 首次启动迁移旧 Key / Migrate a Legacy Key on First Launch

- **WHEN** 数据目录中存在旧版本 DeepSeek Key 且不存在新凭据记录
- **WHEN** a legacy DeepSeek key exists in the data directory and no new credential record exists
- **THEN** 系统原子地创建默认 DeepSeek 凭据和模型配置，迁移成功后旧配置仍可回滚或安全清理
- **THEN** the system atomically creates the default DeepSeek credential and model configuration; after successful migration, the legacy configuration remains rollback-capable or can be safely cleaned up

#### Scenario: 旧会话继续发送 / Continue Sending from a Legacy Conversation

- **WHEN** 用户打开没有模型字段的旧会话并发送消息
- **WHEN** the user opens an older conversation without a model field and sends a message
- **THEN** 系统使用默认 DeepSeek 模型发送，旧消息内容和原有三语设置保持不变
- **THEN** the system sends through the default DeepSeek model, while preserving old message content and the existing three-language settings

#### Scenario: 迁移失败 / Migration Failure

- **WHEN** 旧 Key 无法解密或迁移写入失败
- **WHEN** the legacy key cannot be decrypted or migration writes fail
- **THEN** 系统保留原始数据，不覆盖可恢复凭据，并明确提示用户重新配置，不得生成半完成的凭据引用
- **THEN** the system preserves the original data, does not overwrite recoverable credentials, clearly prompts the user to reconfigure, and MUST NOT create a partially completed credential reference

### Requirement: 供应商端点与数据安全策略 / Provider Endpoint and Data-Security Policy

系统 SHALL 对供应商端点执行协议和地址校验，默认只允许 HTTPS；若支持本机服务，必须由用户显式启用受控的 localhost 地址。系统 SHALL 不从项目文件或远程配置动态加载可执行供应商插件，并在首次使用供应商前提示消息将发送到该供应商。

The system SHALL validate the protocol and address of provider endpoints, allowing HTTPS by default. If local services are supported, users MUST explicitly enable a controlled localhost address. The system SHALL NOT dynamically load executable provider plugins from project files or remote configuration, and SHALL inform the user before messages are sent to a provider for the first time.

#### Scenario: 非法端点 / Invalid Endpoint

- **WHEN** 用户输入 `file:`, `data:`, `javascript:` 或其他不允许的端点
- **WHEN** the user enters a `file:`, `data:`, `javascript:`, or otherwise disallowed endpoint
- **THEN** 系统拒绝保存该连接，不发起网络请求
- **THEN** the system rejects saving the connection and does not initiate a network request

#### Scenario: 使用本机模型端点 / Use a Local Model Endpoint

- **WHEN** 用户显式启用并配置允许的 localhost HTTPS/HTTP 端点
- **WHEN** the user explicitly enables and configures an allowed localhost HTTPS/HTTP endpoint
- **THEN** 系统在设置页显示该端点的本机数据路由提示，并仅允许关联的模型配置使用它
- **THEN** the system displays a local data-routing notice for the endpoint in settings and allows only associated model configurations to use it

#### Scenario: 首次发送隐私提示 / Privacy Notice before the First Send

- **WHEN** 用户首次使用某供应商模型发送消息
- **WHEN** the user sends a message with a provider model for the first time
- **THEN** 系统显示该供应商的数据发送提示，用户确认后才发送请求
- **THEN** the system displays that provider's data-sharing notice and sends the request only after the user confirms
