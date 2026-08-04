# ai-character-chat Specification

## Purpose
TBD - created by archiving change multi-character-framework. Update Purpose after archive.
## Requirements
### Requirement: 会话与人设按角色路由
聊天服务 SHALL 依据请求携带的 `petId` 路由人设读取/更新、会话列表、会话创建等操作，服务与 IPC 层不得硬编码单一角色；不同角色的会话与人设数据 SHALL 相互隔离。

#### Scenario: 按角色查询会话
- **WHEN** 调用方以 `petId='hutao'` 请求会话列表
- **THEN** 仅返回该角色名下按更新时间倒序的会话，不包含其他角色的数据

#### Scenario: 非法角色标识
- **WHEN** 调用方传入未注册的 `petId`
- **THEN** 操作返回明确错误，不创建也不修改任何数据

#### Scenario: 人设按角色读写
- **WHEN** 调用方以 `petId='hutao'` 更新人设后再次读取
- **THEN** 返回该角色更新后的人设，且不影响其他角色的人设

