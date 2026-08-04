import type {
  PomodoroDoneEvent,
  PomodoroPhase,
  PomodoroTickEvent,
  RestReminderEvent,
  TimerConfig,
  TimerStatus
} from '../../../shared/types'

/** 休息提醒间隔（秒），默认 45 分钟 */
const DEFAULT_REST_INTERVAL_SECS = 2700
/** 番茄钟默认工作时长（秒），25 分钟 */
const DEFAULT_WORK_SECS = 1500
/** 番茄钟默认休息时长（秒），5 分钟 */
const DEFAULT_BREAK_SECS = 300
/** tick 间隔（秒） */
const TICK_SECS = 30

type TimerEventListener = (
  channel: 'rest-reminder' | 'pomodoro-tick' | 'pomodoro-done',
  payload: RestReminderEvent | PomodoroTickEvent | PomodoroDoneEvent
) => void

interface TimerInner {
  activeSecs: number
  config: TimerConfig
  pomodoroActive: boolean
  pomodoroPhase: PomodoroPhase
  pomodoroElapsed: number
}

/** 把分钟数值收敛到合法区间并转为秒；非法输入回退默认值。 */
function clampMinutesToSecs(
  value: unknown,
  minMinutes: number,
  maxMinutes: number,
  fallbackSecs: number
): number {
  const minutes =
    typeof value === 'number' && Number.isFinite(value) ? value / 60 : NaN
  if (!Number.isFinite(minutes)) return fallbackSecs
  return Math.max(minMinutes, Math.min(maxMinutes, Math.round(minutes))) * 60
}

/**
 * 规范化计时器配置（IPC 入口与内部共用）：拒绝非有限值、越界值收敛到合法区间。
 *
 * @param config 未知来源的计时器配置
 * @returns 收敛后的合法配置
 */
export function normalizeTimerConfig(config: unknown): TimerConfig {
  const raw = (config ?? {}) as Record<string, unknown>
  return {
    restIntervalSecs: clampMinutesToSecs(
      raw.restIntervalSecs,
      10,
      120,
      DEFAULT_REST_INTERVAL_SECS
    ),
    workSecs: clampMinutesToSecs(
      raw.workSecs,
      5,
      90,
      DEFAULT_WORK_SECS
    ),
    breakSecs: clampMinutesToSecs(
      raw.breakSecs,
      3,
      30,
      DEFAULT_BREAK_SECS
    )
  }
}

/**
 * 休息提醒 & 番茄钟服务（移植自 Rust 版 timer.rs，功能一致）：
 * - 桌宠可见期间累积活跃时长，每 restIntervalSecs 触发一次休息提醒
 * - 番茄钟 work/break 状态机，阶段切换时通知渲染层
 */
export class TimerService {
  private inner: TimerInner = {
    activeSecs: 0,
    config: {
      restIntervalSecs: DEFAULT_REST_INTERVAL_SECS,
      workSecs: DEFAULT_WORK_SECS,
      breakSecs: DEFAULT_BREAK_SECS
    },
    pomodoroActive: false,
    pomodoroPhase: 'idle',
    pomodoroElapsed: 0
  }

  private listener: TimerEventListener | null = null
  private ticker: NodeJS.Timeout | null = null
  private isPetVisible: () => boolean = () => true

  start(listener: TimerEventListener, isPetVisible: () => boolean): void {
    this.listener = listener
    this.isPetVisible = isPetVisible
    if (this.ticker) return
    this.ticker = setInterval(() => this.tick(TICK_SECS), TICK_SECS * 1000)
    console.log('[timer] 计时服务已启动（休息提醒 + 番茄钟）')
  }

  stop(): void {
    if (this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
    this.listener = null
  }

  private emit(
    channel: 'rest-reminder' | 'pomodoro-tick' | 'pomodoro-done',
    payload: RestReminderEvent | PomodoroTickEvent | PomodoroDoneEvent
  ): void {
    try {
      this.listener?.(channel, payload)
    } catch (error) {
      console.error(`[timer] 事件投递失败 (${channel}):`, error)
    }
  }

  private tick(tickSecs: number): void {
    const inner = this.inner

    if (this.isPetVisible()) {
      inner.activeSecs += tickSecs
      if (inner.activeSecs >= inner.config.restIntervalSecs) {
        inner.activeSecs = 0
        const minutes = Math.round(inner.config.restIntervalSecs / 60)
        console.log(`[timer] 休息提醒触发（累积 ${minutes} 分钟）`)
        this.emit('rest-reminder', { activeMinutes: minutes })
      }
    }

    if (inner.pomodoroActive) {
      inner.pomodoroElapsed += tickSecs
      const phaseTotal =
        inner.pomodoroPhase === 'working'
          ? inner.config.workSecs
          : inner.pomodoroPhase === 'break'
            ? inner.config.breakSecs
            : 0

      this.emit('pomodoro-tick', {
        phase: inner.pomodoroPhase,
        elapsed: inner.pomodoroElapsed,
        total: phaseTotal
      })

      if (inner.pomodoroElapsed >= phaseTotal) {
        if (inner.pomodoroPhase === 'working') {
          inner.pomodoroPhase = 'break'
          inner.pomodoroElapsed = 0
          console.log('[timer] 番茄钟：工作阶段结束，进入休息')
          this.emit('pomodoro-done', {
            phase: 'working',
            nextPhase: 'break',
            message: '工作阶段结束，休息一下吧～'
          })
        } else if (inner.pomodoroPhase === 'break') {
          inner.pomodoroPhase = 'working'
          inner.pomodoroElapsed = 0
          console.log('[timer] 番茄钟：休息结束，进入工作')
          this.emit('pomodoro-done', {
            phase: 'break',
            nextPhase: 'working',
            message: '休息结束，继续加油！'
          })
        }
      }
    }
  }

  getStatus(): TimerStatus {
    const inner = this.inner
    const phaseTotal =
      inner.pomodoroPhase === 'working'
        ? inner.config.workSecs
        : inner.pomodoroPhase === 'break'
          ? inner.config.breakSecs
          : 0
    return {
      activeSecs: inner.activeSecs,
      restIntervalSecs: inner.config.restIntervalSecs,
      pomodoroActive: inner.pomodoroActive,
      pomodoroPhase: inner.pomodoroPhase,
      pomodoroElapsed: inner.pomodoroElapsed,
      pomodoroTotal: phaseTotal,
      config: { ...inner.config }
    }
  }

  updateConfig(config: unknown): void {
    this.inner.config = normalizeTimerConfig(config)
    console.log('[timer] 配置已更新:', config)
  }

  startPomodoro(): void {
    this.inner.pomodoroActive = true
    this.inner.pomodoroPhase = 'working'
    this.inner.pomodoroElapsed = 0
    console.log('[timer] 番茄钟已启动')
  }

  stopPomodoro(): void {
    this.inner.pomodoroActive = false
    this.inner.pomodoroPhase = 'idle'
    this.inner.pomodoroElapsed = 0
    console.log('[timer] 番茄钟已停止')
  }

  resetRestTimer(): void {
    this.inner.activeSecs = 0
  }
}
