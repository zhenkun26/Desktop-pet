import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearListenerErrorHandlers,
  onListenerError,
  safeEmit
} from './event-emitter'

describe('safeEmit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearListenerErrorHandlers()
  })

  it('should deliver event to remaining listeners when one listener throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: string[] = []
    const throwing = (): void => {
      throw new Error('boom')
    }
    const normal = (event: string): void => {
      received.push(event)
    }
    const listeners = new Set([throwing, normal])

    expect(() => safeEmit('test-channel', listeners, 'hello')).not.toThrow()
    expect(received).toEqual(['hello'])
  })

  it('should not interrupt the surrounding flow after a listener throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const listeners = new Set([
      (): void => {
        throw new Error('boom')
      }
    ])

    const steps: string[] = []
    safeEmit('chat-stream', listeners, { type: 'done' })
    steps.push('after-emit')

    expect(steps).toEqual(['after-emit'])
  })

  it('should log channel, listener name and error, and notify onListenerError hooks', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = vi.fn()
    const unsubscribe = onListenerError(hook)
    const boom = new Error('boom')
    const throwing = (): void => {
      throw boom
    }

    safeEmit('chat-stream', new Set([throwing]), { type: 'start' })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('channel=chat-stream'),
      boom
    )
    expect(errorSpy.mock.calls[0][0]).toContain('listener=throwing')
    expect(hook).toHaveBeenCalledWith(boom, 'chat-stream', 'throwing')
    unsubscribe()
  })

  it('should mark anonymous listeners as <anonymous>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hook = vi.fn()
    onListenerError(hook)

    safeEmit(
      'business-event',
      new Set([
        (): void => {
          throw new Error('x')
        }
      ]),
      { type: 'busy' }
    )

    expect(errorSpy.mock.calls[0][0]).toContain('listener=<anonymous>')
    expect(hook.mock.calls[0][2]).toBe('<anonymous>')
  })

  it('should not log when all listeners succeed', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: string[] = []

    safeEmit('chat-stream', new Set([(event: string) => received.push(event)]), 'hi')

    expect(received).toEqual(['hi'])
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('should isolate errors thrown by onListenerError hooks', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    onListenerError(() => {
      throw new Error('hook boom')
    })
    const received: string[] = []

    safeEmit(
      'chat-stream',
      new Set([
        (event: string) => received.push(event),
        (): void => {
          throw new Error('listener boom')
        }
      ]),
      'x'
    )

    expect(received).toEqual(['x'])
    expect(errorSpy).toHaveBeenCalled()
  })
})
