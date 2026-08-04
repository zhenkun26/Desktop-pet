## 1. 角色注册表

- [x] 1.1 新增 `src/main/services/pet/pet-registry.ts`：`listPets()` / `getPet(petId)`（未知角色抛错），集中 `PET_IDS` / `PET_LABELS` / `BUILTIN_PERSONAS` / 立绘素材映射
- [x] 1.2 将时段问候文案（原 `GREETINGS`）迁入注册表，桌宠窗口按 `petId` 读取
- [x] 1.3 preload 暴露只读查询（`listPets` / `getPet`），渲染层角色元数据统一经注册表获取（`pet-assets.ts` 动态解析素材 URL）

## 2. IPC 契约 petId 透传

- [x] 2.1 更新 `src/shared/types.ts`：新增 `PetDescriptor` / `PetGreetings` 契约与 `listPets` / `getPet` API，`OpenChatOptions.petId` 生效
- [x] 2.2 `src/main/index.ts` IPC handler 接收并校验 `petId`（人设读写、会话列表/创建等），未知角色返回明确错误
- [x] 2.3 `chat-service.ts` 按 `petId` 取人设与会话；`store.ts` 不再强制 `'hutao'`（非法值回退默认角色）；`getBuiltinPersona` 对未知角色抛错
- [x] 2.4 `src/preload/index.ts` 透传 `petId`，不再忽略 `_petId`

## 3. 渲染层角色上下文

- [x] 3.1 `chat.ts`：头像、标题、人设表单、会话列表、空状态文案按当前 `petId` 动态化（含角色切换重载）
- [x] 3.2 托盘/右键入口与 `openChatWindow` 传递当前桌宠 `petId`
- [x] 3.3 桌宠窗口立绘与时段问候按 `config.petId` 渲染

## 4. 验证

- [x] 4.1 `npx tsc --noEmit` 与 `npm run build` 通过
- [ ] 4.2 冒烟：胡桃完整链路（人设保存、会话列表、流式对话、时段问候、打包后素材）行为不变
- [ ] 4.3 回归：未知 `petId` 在 IPC 层返回明确错误，不产生脏数据
