## Context

数据层已按角色设计（`PetId` 联合类型、`persona_profiles.pet_id` 主键、`conversations.pet_id`、`OpenChatOptions.petId`），但 IPC 与渲染层有 13 处硬编码 `'hutao'`，preload 丢弃 `petId` 参数，`BUILTIN_PERSONAS` 与素材路径集中在 chat 服务内部。详见 proposal.md — Why。

## Goals / Non-Goals

**Goals:**
- 打通 `petId` 从渲染层 → preload → IPC → 服务的全链路，服务与渲染层不再硬编码角色
- 建立角色元数据单一来源（`pet-registry`），让"新增角色"变成纯数据登记
- 保持当前唯一角色胡桃的对外行为不变

**Non-Goals:**
- 不新增第二个角色的内容素材与人设
- 不做宠物切换 UI、多桌宠窗口、跨角色会话合并（见 proposal.md — 开放问题）

## Decisions

**D1. 新增 `pet-registry` 模块（`src/main/services/pet/pet-registry.ts`）**
把 `PET_IDS` / `PET_LABELS` / `BUILTIN_PERSONAS` / 立绘素材映射 / 时段问候文案集中管理，暴露 `listPets()`、`getPet(petId)`（未知角色抛错）。preload 额外暴露只读查询供渲染层初始化。备选：沿用散落常量 + 渲染层各自 import —— 无法达到"登记即新增"，否决。

**D2. IPC 契约：会话/人设类通道统一携带 `petId`**
`get-persona-profile`、`update-persona-profile`、`list-conversations`、`create-conversation` 改为显式接收 `petId`；preload 的 `DesktopPetApi` 相应透传（不再忽略 `_petId`）。`OpenChatOptions.petId` 生效，聊天窗口打开时按该角色加载上下文。桌面宠物窗口维持单实例，显示 `config.petId` 指定角色。备选：按角色实例化整套服务——当前只有单桌宠窗口，过度设计，否决。

**D3. 素材与文案走注册表映射**
渲染层不再直接引用 `hutao.png` 字面量，改为从注册表拿素材引用；时段问候文案移入注册表（`GREETINGS` 从 main.ts 迁出）。未知 `petId` 在 IPC 入口校验并返回明确错误（符合 specs 的"不得静默回退"）。

**D4. 兼容与回归**
本次改动是内部重构 + 契约透传，不改变用户可见行为；用 `tsc --noEmit` 全量类型检查兜底签名改动，冒烟验证单角色完整链路（人设、会话、流式、问候）。

## Risks / Trade-offs

- [IPC 签名改动面广] → preload / main / renderer 同一次提交内同步改，类型系统强制覆盖所有调用点
- [未知 petId 处理不一致] → IPC 入口统一校验，返回统一错误码，specs 已约束"不得回退默认角色"
- [素材路径迁移遗漏] → 注册表集中引用 + 构建产物检查（打包后素材存在）

## Open Questions

- 宠物切换 UI 与多桌宠窗口形态（后续 change 决定，不阻塞本设计）
- 会话列表是否允许跨角色合并展示（后续 change 决定）
