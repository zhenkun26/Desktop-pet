# Contributing

欢迎贡献！请遵循以下约定，让协作顺畅可审查。

## 工作流：OpenSpec 优先

功能、修复或行为变更必须先建立 OpenSpec change：

1. `openspec new change <kebab-case-name>`
2. 完成 proposal / specs / design / tasks 四个工件（可让 AI 协助）
3. 按 tasks 实现，并在 PR 中关联该 change
4. 合并后 `openspec archive <change-name>` 归档并同步主 specs

纯文档、构建配置等无行为变更的改动可在 change 中声明 `skip_specs: true`。

## 提交信息

使用 [Conventional Commits](https://www.conventionalcommits.org/) 风格：

```
feat: 支持多角色切换
fix: 修复流式气泡断开
docs: 更新 README
chore: 清理构建配置
refactor: 抽取事件派发模块
test: 补充监听器隔离测试
```

## 代码规范

- 仓库根 `AGENTS.md` 是代理（AI 助手）的强制执行规范，人工提交同样参考
- TypeScript 严格模式；新增公共接口必须有文档注释
- 不硬编码密钥；SQL 一律参数化；外部输入必须校验
- 新增公共逻辑必须附带单元测试（vitest），并保证 `tsc --noEmit` 与 `npm test` 通过

## 提交 PR 前自检

- [ ] 关联的 OpenSpec change 已完成或随 PR 一并更新
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm test` 全绿
- [ ] `npm run build` 通过
- [ ] 无敏感信息（API Key、密钥、个人路径）
- [ ] 提交信息符合 Conventional Commits

## 审查要求

main 分支受保护：所有变更必须通过 PR 合并，至少 1 名维护者批准，且 CI 状态检查全部通过。
