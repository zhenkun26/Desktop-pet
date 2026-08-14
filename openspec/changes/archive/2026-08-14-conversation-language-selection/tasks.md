## 1. 语言领域模型与配置

- [x] 1.1 在 `src/shared/types.ts` 定义 `ChatLanguage`、三语标签和 `DEFAULT_CHAT_LANGUAGE = 'zh-CN'`，并提供集中式非法值回退逻辑
- [x] 1.2 扩展 `PetConfig` 与 `src/main/store.ts`，持久化 `defaultResponseLanguage`，读取旧配置或非法值时回退中文
- [x] 1.3 扩展 `ConversationRecord` 和相关输入/输出类型，保证所有跨 IPC 的语言字段使用同一枚举

## 2. SQLite 会话语言迁移

- [x] 2.1 在 `src/main/services/chat/chat-db.ts` 增加幂等 schema 检查和 `response_language` 增量迁移，旧数据库默认 `zh-CN`，迁移不修改 `messages`
- [x] 2.2 更新会话创建、读取、列表和重命名相关数据映射，使每个会话返回有效的 `responseLanguage`
- [x] 2.3 增加更新会话语言的数据操作，校验非法值并保证迁移失败时记录可诊断错误、不报告为成功

## 3. 主进程与 IPC 边界

- [x] 3.1 在 `src/main/index.ts` 和 `src/preload/index.ts` 增加读取/修改默认语言与当前会话语言的受控 IPC，主进程重新校验 petId、conversationId 和 ChatLanguage
- [x] 3.2 更新新会话创建流程，使其从当前默认语言初始化；没有当前会话时设置变更只写默认配置
- [x] 3.3 更新当前会话切换流程，使设置页修改当前会话语言时不重载、不翻译、不删除既有消息

## 4. System prompt 与生成快照

- [x] 4.1 扩展 `src/main/services/chat/prompt-builder.ts`，为 `zh-CN`、`en-US`、`ja-JP` 生成明确的回复语言约束和原文保留规则
- [x] 4.2 更新 `src/main/services/chat/chat-service.ts`，在生成开始时读取并快照会话语言，再构建 system prompt；生成期间的语言变更不得影响当前请求
- [x] 4.3 保持 DeepSeek/SSE 请求结构、API Key 存储和既有消息持久化语义不变，不引入翻译接口或多模型接口

## 5. 设置界面与交互

- [x] 5.1 在现有总设置入口增加“对话语言”卡片，展示中文、English、日本語三个选项，并区分新会话默认语言与当前会话语言
- [x] 5.2 将设置变更接入当前会话/默认配置边界：有当前会话时更新该会话，无当前会话时只更新默认值
- [x] 5.3 验证生成期间切换语言不会重建流式气泡、取消当前生成或改写已经显示的消息；下一次发送使用新语言

## 6. 自动化测试

- [x] 6.1 为语言枚举、非法值回退、旧配置兼容和不同会话隔离增加单元测试
- [x] 6.2 为 SQLite 增量迁移、旧数据库读取、会话创建/更新和迁移失败路径增加测试
- [x] 6.3 为三种 prompt 约束、无效语言保护和生成期间语言快照增加 chat-service 测试
- [x] 6.4 为设置页 IPC 调用与会话/默认语言切换边界增加渲染层或集成测试；确认既有消息不被翻译或重写

## 7. 验证与交付

- [x] 7.1 运行 `openspec validate --all --strict --no-interactive`
- [x] 7.2 运行 `npx tsc --noEmit`、`npm test` 和 `npm run build`
- [x] 7.3 手动验证中文、英文、日文各发起一轮对话，切换会话后确认语言隔离，生成中切换后确认下一条消息才生效
- [x] 7.4 复核变更范围，确认未引入 translate.js、第三方翻译接口、离线模型或多模型适配层
