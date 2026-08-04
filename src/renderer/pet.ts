import type { PetVisualState } from '../shared/types'
import { Bubble, type BubbleAction } from './bubble'

/**
 * 桌宠控制器：
 * - 拖拽模型参照 kirineko/desktop-pet：mousedown 记起点，mousemove 发增量
 *   moveWindow(dx, dy)，mouseup 调 savePosition；拖拽中主进程不钳制边界。
 * - 长文本分段轮播：句末标点切段，超长段再按逗号/硬切；每段至少 2s，
 *   超 10 字每字 +120ms，封顶 4s；新消息打断旧轮播（sayToken）。
 */
export class PetController {
  private stage: HTMLElement
  private image: HTMLImageElement
  readonly bubble: Bubble

  private state: PetVisualState = 'idle'
  private businessBusy = false

  private dragging = false
  private dragMoved = false
  private lastPointerX = 0
  private lastPointerY = 0

  private sayToken = 0
  private sayTimer: ReturnType<typeof setTimeout> | null = null

  constructor(stage: HTMLElement, image: HTMLImageElement, bubbleEl: HTMLButtonElement) {
    this.stage = stage
    this.image = image
    this.bubble = new Bubble(bubbleEl)
    this.bindDrag()
  }

  getState(): PetVisualState {
    return this.state
  }

  setState(next: PetVisualState): void {
    if (this.state === next) return
    this.image.classList.remove(`state-${this.state}`)
    this.state = next
    this.image.classList.add(`state-${next}`)
  }

  /** 业务忙闲（AI 生成中），与拖拽/点击状态协调 */
  setBusinessBusy(busy: boolean): void {
    this.businessBusy = busy
    if (busy) {
      this.setState('busy')
    } else if (this.state === 'busy') {
      this.setState('idle')
    }
  }

  /** 说一段话；长文本自动分段轮播 */
  say(text: string, options: { persistent?: boolean } = {}): void {
    const token = ++this.sayToken
    this.clearSayTimer()

    const segments = splitIntoSegments(text)
    if (segments.length === 0) return

    if (segments.length === 1) {
      this.bubble.show(segments[0], options)
      return
    }

    let index = 0
    const showNext = (): void => {
      if (token !== this.sayToken) return
      const segment = segments[index]
      const isLast = index === segments.length - 1
      this.bubble.show(segment, {
        persistent: options.persistent || !isLast
      })
      index += 1
      if (index < segments.length) {
        this.sayTimer = setTimeout(showNext, segmentDurationMs(segment))
      }
    }
    showNext()
  }

  /** 带操作按钮的菜单气泡 */
  showMenu(message: string, actions: BubbleAction[]): void {
    const token = ++this.sayToken
    void token
    this.clearSayTimer()
    this.bubble.show(message, { actions })
  }

  stopTalking(): void {
    this.sayToken += 1
    this.clearSayTimer()
    this.bubble.hide()
  }

  private clearSayTimer(): void {
    if (this.sayTimer) {
      clearTimeout(this.sayTimer)
      this.sayTimer = null
    }
  }

  private bindDrag(): void {
    this.stage.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      this.dragging = true
      this.dragMoved = false
      this.lastPointerX = event.screenX
      this.lastPointerY = event.screenY
      if (!this.businessBusy) this.setState('drag')
      event.preventDefault()
    })

    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return
      const dx = event.screenX - this.lastPointerX
      const dy = event.screenY - this.lastPointerY
      if (dx === 0 && dy === 0) return
      this.lastPointerX = event.screenX
      this.lastPointerY = event.screenY
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragMoved = true
      void window.desktopPet.moveWindow(dx, dy)
    })

    window.addEventListener('mouseup', () => {
      if (!this.dragging) return
      this.dragging = false
      if (this.state === 'drag') this.setState('idle')
      if (this.dragMoved) {
        void window.desktopPet.savePosition()
      } else {
        // 原地点击：弹跳一下
        if (!this.businessBusy) {
          this.setState('click')
          setTimeout(() => {
            if (this.state === 'click') this.setState('idle')
          }, 480)
        }
      }
    })

    this.stage.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      void window.desktopPet.showContextMenu()
    })
  }
}

/** 每段展示时长：2s 基础，超 10 字每字 +120ms，封顶 4s */
export function segmentDurationMs(segment: string): number {
  const extra = Math.max(0, segment.length - 10) * 120
  return Math.min(2000 + extra, 4000)
}

/** 长文本切段：先按句末标点，超长段再按逗号，最后硬切 26 字 */
export function splitIntoSegments(text: string, maxLen = 26): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  if (normalized.length <= maxLen) return [normalized]

  const sentences = normalized
    .split(/(?<=[。！？!?…～~])/)
    .map((s) => s.trim())
    .filter(Boolean)

  const segments: string[] = []
  let current = ''

  const flushCurrent = (): void => {
    if (current) {
      segments.push(current)
      current = ''
    }
  }

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      flushCurrent()
      // 超长句：先按逗号/顿号切，仍超长则硬切
      const clauses = sentence
        .split(/(?<=[，、；;,.])/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const clause of clauses) {
        if (clause.length > maxLen) {
          for (let i = 0; i < clause.length; i += maxLen) {
            segments.push(clause.slice(i, i + maxLen))
          }
        } else {
          segments.push(clause)
        }
      }
      continue
    }
    if ((current + sentence).length > maxLen) {
      flushCurrent()
      current = sentence
    } else {
      current += sentence
    }
  }
  flushCurrent()
  return segments
}
