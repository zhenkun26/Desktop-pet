import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeTimerConfig, TimerService } from './timer-service'

describe('normalizeTimerConfig', () => {
  it('should pass through valid values as seconds', () => {
    expect(
      normalizeTimerConfig({
        restIntervalSecs: 45 * 60,
        workSecs: 25 * 60,
        breakSecs: 5 * 60
      })
    ).toEqual({
      restIntervalSecs: 45 * 60,
      workSecs: 25 * 60,
      breakSecs: 5 * 60
    })
  })

  it('should clamp out-of-range values into legal ranges', () => {
    const config = normalizeTimerConfig({
      restIntervalSecs: 999 * 60,
      workSecs: 0,
      breakSecs: -5 * 60
    })
    expect(config.restIntervalSecs).toBe(120 * 60)
    expect(config.workSecs).toBe(5 * 60)
    expect(config.breakSecs).toBe(3 * 60)
  })

  it('should fall back to defaults for non-finite or missing values', () => {
    const config = normalizeTimerConfig({
      restIntervalSecs: Number.NaN,
      workSecs: '25',
      breakSecs: undefined
    })
    expect(config).toEqual({
      restIntervalSecs: 45 * 60,
      workSecs: 25 * 60,
      breakSecs: 5 * 60
    })
  })

  it('should fall back entirely for non-object input', () => {
    expect(normalizeTimerConfig(null)).toEqual({
      restIntervalSecs: 45 * 60,
      workSecs: 25 * 60,
      breakSecs: 5 * 60
    })
  })
})

describe('TimerService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should emit a rest reminder after accumulated active time', () => {
    const service = new TimerService()
    const channels: string[] = []
    service.start((channel) => channels.push(channel), () => true)
    service.updateConfig({
      restIntervalSecs: 10 * 60,
      workSecs: 25 * 60,
      breakSecs: 5 * 60
    })

    vi.advanceTimersByTime(10 * 60_000)

    expect(channels).toContain('rest-reminder')
    service.stop()
  })

  it('should not accumulate rest time while the pet is hidden', () => {
    const service = new TimerService()
    const channels: string[] = []
    service.start((channel) => channels.push(channel), () => false)
    service.updateConfig({
      restIntervalSecs: 10 * 60,
      workSecs: 25 * 60,
      breakSecs: 5 * 60
    })

    vi.advanceTimersByTime(10 * 60_000)

    expect(channels).not.toContain('rest-reminder')
    service.stop()
  })

  it('should transition working → break → working in pomodoro', () => {
    const service = new TimerService()
    const nextPhases: string[] = []
    service.start(
      (channel, payload) => {
        if (channel === 'pomodoro-done') {
          nextPhases.push((payload as { nextPhase: string }).nextPhase)
        }
      },
      () => true
    )
    service.updateConfig({
      restIntervalSecs: 3600,
      workSecs: 5 * 60,
      breakSecs: 3 * 60
    })
    service.startPomodoro()

    vi.advanceTimersByTime(5 * 60_000)
    expect(nextPhases).toEqual(['break'])
    vi.advanceTimersByTime(3 * 60_000)
    expect(nextPhases).toEqual(['break', 'working'])
    service.stop()
  })

  it('should clamp invalid config passed to updateConfig', () => {
    const service = new TimerService()
    service.updateConfig({
      restIntervalSecs: 0,
      workSecs: 0,
      breakSecs: 0
    })
    expect(service.getStatus().config).toEqual({
      restIntervalSecs: 10 * 60,
      workSecs: 5 * 60,
      breakSecs: 3 * 60
    })
  })
})
