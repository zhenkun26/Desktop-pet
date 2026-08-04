# Security

感谢关注本项目安全。请通过以下渠道报告安全问题：

- **首选**：GitHub Issues 中标记 `security` 标签（公开仓库可创建私有报告时请使用 Security Advisory）
- **备选**：发送邮件至仓库维护者（见 GitHub 个人主页联系方式）

## 安全约定

- API Key 使用 Electron `safeStorage`（系统钥匙串级加密）保存，禁止明文落盘
- 对外渲染使用 DOMPurify 净化，禁止未经处理注入 HTML
- SQL 一律参数化，禁止字符串拼接
- 提交前扫描敏感信息；CI 集成 gitleaks 持续检查

请勿在 Issue、PR 或提交信息中粘贴任何真实密钥。
