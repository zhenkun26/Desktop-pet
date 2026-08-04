/**
 * 气泡控制器（参照 kirineko/desktop-pet 的 bubble 模块）：
 * - show/hide 管理气泡显示，自动隐藏定时器
 * - menu 模式：带操作按钮，不自动隐藏，可点击
 * - 思考/持久消息：persistent，不自动隐藏
 */

export interface BubbleAction {
  label: string
  onClick: () => void
}

const HIDE_MS = 2800

export class Bubble {
  private el: HTMLButtonElement
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private menuOpen = false
  private persistent = false

  constructor(el: HTMLButtonElement) {
    this.el = el
  }

  isMenuOpen(): boolean {
    return this.menuOpen
  }

  /** 空闲自语是否可以出现（菜单打开或持久消息时不打扰） */
  canShowIdleMessage(): boolean {
    return !this.menuOpen && !this.persistent
  }

  show(
    text: string,
    options: {
      persistent?: boolean
      clickable?: boolean
      onClick?: () => void
      actions?: BubbleAction[]
    } = {}
  ): void {
    this.clearHideTimer()
    this.persistent = options.persistent ?? false
    this.menuOpen = Boolean(options.actions && options.actions.length > 0)

    this.el.textContent = text

    if (options.actions && options.actions.length > 0) {
      const container = document.createElement('div')
      container.className = 'bubble-actions'
      for (const action of options.actions) {
        const btn = document.createElement('button')
        btn.className = 'bubble-action'
        btn.type = 'button'
        btn.textContent = action.label
        btn.addEventListener('click', (event) => {
          event.stopPropagation()
          action.onClick()
        })
        container.appendChild(btn)
      }
      this.el.appendChild(container)
    }

    this.el.classList.toggle(
      'clickable',
      Boolean(options.clickable || options.onClick || this.menuOpen)
    )
    this.el.onclick = options.onClick ?? null
    this.el.classList.remove('hidden')

    if (!this.persistent && !this.menuOpen) {
      this.hideTimer = setTimeout(() => this.hide(), HIDE_MS)
    }
  }

  hide(): void {
    this.clearHideTimer()
    this.menuOpen = false
    this.persistent = false
    this.el.onclick = null
    this.el.classList.add('hidden')
    this.el.classList.remove('clickable')
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }
}
