## 为什么 / Why

Desktop-pet 当前的聊天链路、API 地址、模型名称和凭据管理都围绕单个 DeepSeek 实现耦合，无法让用户安全地配置多个供应商、多个模型或多个 API Key。现在已有稳定的 SSE 对话和三语会话语言能力，适合在不改变现有语言语义的前提下抽象供应商适配层，并让用户在对话框中选择模型。

Desktop-pet's current chat chain, API address, model name, and credential management are coupled to a single DeepSeek implementation, so users cannot safely configure multiple providers, models, or API keys. With stable SSE chat and three-language conversation support already available, this is an appropriate point to abstract a provider-adapter layer and let users choose models in the conversation UI without changing existing language semantics.

## 变更内容 / What Changes

- 增加供应商连接、凭据和模型配置的统一领域模型，支持同一供应商共享凭据以及按模型使用独立 API Key。 / Add unified domain models for provider connections, credentials, and model configurations, supporting shared credentials within a provider and per-model API keys.
- 将聊天服务从单一 DeepSeek 客户端改为通过模型路由器调用供应商适配器，先兼容 DeepSeek/OpenAI-compatible 协议。 / Change the chat service from a single DeepSeek client to provider adapters called through a model router, initially supporting DeepSeek/OpenAI-compatible protocol.
- 在主进程建立多凭据加密存储和 IPC 边界；渲染层只接收凭据状态、掩码和标识，不接收明文 API Key。 / Establish encrypted multi-credential storage and an IPC boundary in the main process; the renderer receives only credential status, masks, and identifiers, never plaintext API keys.
- 在总设置中管理供应商连接、模型配置和凭据，在对话框下方增加当前模型选择器。 / Manage provider connections, model configurations, and credentials in global settings, and add a current-model selector below the conversation UI.
- 持久化会话和消息使用的模型配置快照；模型切换只影响后续消息，正在进行的流式请求继续使用开始时的配置。 / Persist model-configuration snapshots used by conversations and messages; model switches affect only subsequent messages, while in-progress streaming requests continue with their start-time configuration.
- 将现有单个 DeepSeek Key 和旧会话平滑迁移到默认 DeepSeek 连接，不改写历史消息。 / Smoothly migrate the existing single DeepSeek key and legacy conversations to a default DeepSeek connection without rewriting historical messages.
- 统一不同供应商的流式事件、取消行为、超时和错误分类，并增加适配器契约、迁移、脱敏和 IPC 边界测试。 / Unify streaming events, cancellation, timeouts, and error categories across providers, and add adapter-contract, migration, redaction, and IPC-boundary tests.
- **不包含**动态加载远程插件、本地模型运行时、计费/用量系统或供应商特有的高级工具调用协议。 / **Out of scope:** dynamic remote-plugin loading, local-model runtimes, billing/usage systems, and provider-specific advanced tool-calling protocols.

## 能力 / Capabilities

### 新增能力 / New Capabilities

- `multi-provider-model-routing`: 管理多供应商连接、加密凭据和模型配置，并在对话中按模型配置路由请求。 / `multi-provider-model-routing`: Manage multi-provider connections, encrypted credentials, and model configurations, and route conversation requests by model configuration.

### 修改能力 / Modified Capabilities

<!-- 现有三语会话语言需求保持不变；模型切换不得改变既有语言快照语义。 / Existing three-language conversation requirements remain unchanged; model switching MUST NOT change existing language-snapshot semantics. -->

## 影响范围 / Impact

- 主要影响 `src/main/services/chat` 中的凭据存储、DeepSeek 客户端和聊天服务，以及 `src/main/index.ts`、`src/preload` 的 IPC/API 类型。 / Primarily affects credential storage, the DeepSeek client, and the chat service under `src/main/services/chat`, plus IPC/API types in `src/main/index.ts` and `src/preload`.
- 影响 `src/shared/types.ts`、SQLite 聊天数据迁移、设置页和对话框 UI。 / Affects `src/shared/types.ts`, SQLite chat-data migration, the settings page, and the conversation UI.
- 需要新增供应商注册表、模型路由器和统一 Provider Adapter 接口；DeepSeek 作为首个适配器迁移到该接口。 / Requires a provider registry, model router, and unified Provider Adapter interface; DeepSeek is migrated as the first adapter.
- 需要覆盖旧凭据迁移、多个 Key 隔离、模型选择生效时机、流式请求快照、错误脱敏和端点安全策略的测试。 / Requires tests covering legacy-credential migration, multiple-key isolation, model-selection timing, streaming-request snapshots, error redaction, and endpoint-security policy.
