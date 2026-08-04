# spec.md — desktop-pet-window（修改 capability）

## MODIFIED Requirements

### Requirement: 气泡布局
气泡 SHALL 作为 flex 文档流元素位于立绘上方（窗口 `#app` 为 `flex-direction: column; justify-content: flex-end`），立绘尺寸 128×128 不撑满窗口；任意长度/行数的气泡文本 SHALL NOT 被窗口边界裁切。长文本 SHALL 分段轮播展示（按标点切段，每段约 2 秒）。

#### Scenario: 多行气泡
- **WHEN** 气泡展示超过一行的文本
- **THEN** 气泡向下占据文档流空间，窗口上沿无裁切

### Requirement: 边界钳制
系统 SHALL 仅在窗口创建与显示（show）时回收完全出屏的窗口位置；拖拽移动过程 SHALL NOT 强制钳制。

#### Scenario: 拖出屏幕
- **WHEN** 用户把桌宠拖出屏幕边缘后松手
- **THEN** 位置被持久化；下次显示/启动时若完全出屏则回收到主显示器可视区
