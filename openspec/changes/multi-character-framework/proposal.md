## Why

多角色是既定规划，但当前"多角色"只体现在数据层：`PetId` 联合类型、`persona_profiles.pet_id`、`conversations.pet_id` 都已按角色设计；而 IPC 与渲染层仍有 13 处硬编码 `'hutao'`（index.ts 3 处、chat.ts 4 处等），preload 收到 `petId` 参数后直接丢弃，IPC 通道本身不带 petId。新增一个角色需要改动主进程、preload、渲染层多处，且人设/会话/头像都绑死在胡桃上——框架必须先打通。

## What Changes

- **新增 `pet-registry` 能力**：内置角色注册表（`PET_IDS` / `PET_LABELS` / 人设 / 素材路径 / 时段问候文案），提供按 `petId` 查询的单一入口；本次仅注册胡桃一个实例
- **petId 全链路透传**：IPC handler 接收并校验 `petId` 参数、`chat-service` 按 `petId` 取人设与会话、preload 不再丢弃 `_petId`（通道签名同步，见设计 D2）
- **渲染层 `PetContext` 抽象**：聊天窗口的头像、标题、人设表单、会话列表、空状态文案按当前 `petId` 动态化；桌宠窗口立绘与时段问候按当前宠物读取
- **聊天窗口打开参数携带 petId**：`OpenChatOptions.petId` 生效，托盘/右键入口传当前宠物
- **非目标**：本次不新增任何第二个角色的内容素材与人设（保持 `PET_IDS = ['hutao']`），也不做宠物切换 UI 与多桌宠窗口

## Capabilities

### New Capabilities
- `pet-registry`: 内置宠物/角色注册表——角色元数据（展示名、默认人设、素材与问候语资源）按 `petId` 查询，是渲染层与服务的唯一角色数据来源

### Modified Capabilities
- `ai-character-chat`: 人设读取/更新与会话列表/创建等 API 按 `petId` 路由（IPC 不再硬编码 `hutao`），按角色隔离
- `desktop-pet-window`: 桌宠窗口的立绘、时段问候与聊天窗口的角色上下文（头像、标题、人设表单）按当前 `petId` 渲染

## Impact

- **修改**：`src/main/index.ts`、`src/main/chat.ts`、`src/main/services/chat/chat-service.ts`、`src/main/services/chat/personas.ts`、`src/preload/index.ts`、`src/renderer/chat.ts`、`src/renderer/main.ts`、`src/renderer/pet.ts`、`src/shared/types.ts`
- **新增**：`pet-registry` 模块（建议 `src/main/services/pet/pet-registry.ts`）、按角色命名的素材目录（本次仅 `hutao`）
- **兼容性**：IPC 通道内部签名变化，preload/渲染层同步修改；不改变用户可见行为
- **开放问题（留待后续 change）**：宠物切换 UI、多桌宠窗口、会话列表是否跨角色合并
