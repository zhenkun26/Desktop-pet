/** 事件监听器：接收某个事件类型的载荷。 */
export type EventListener<T> = (event: T) => void

/** 监听器错误钩子：接收错误、事件通道与监听器标识。 */
export type ListenerErrorHandler = (
  error: unknown,
  channel: string,
  listenerName: string
) => void

/** 可选错误消费钩子集合（默认为空，不影响事件派发）。 */
const errorHandlers = new Set<ListenerErrorHandler>()

/**
 * 订阅监听器错误通知。
 *
 * @param handler 错误处理器，收到 (error, channel, listenerName)
 * @returns 取消订阅函数
 */
export function onListenerError(handler: ListenerErrorHandler): () => void {
  errorHandlers.add(handler)
  return () => {
    errorHandlers.delete(handler)
  }
}

/** 清空错误订阅（仅用于服务销毁）。 */
export function clearListenerErrorHandlers(): void {
  errorHandlers.clear()
}

/**
 * 记录监听器异常并通知错误钩子。
 * 钩子自身包 try/catch，防止递归抛错。
 */
function reportListenerError(
  channel: string,
  listenerName: string,
  error: unknown
): void {
  console.error(
    `[chat] 事件监听器异常被隔离 channel=${channel} listener=${listenerName}`,
    error
  )
  for (const handler of errorHandlers) {
    try {
      handler(error, channel, listenerName)
    } catch (handlerError) {
      console.error('[chat] onListenerError 钩子异常被隔离', handlerError)
    }
  }
}

/**
 * 逐个派发事件给监听器：单个监听器抛错不会中断其余监听器，
 * 异常会连同事件通道与监听器标识被记录并通知错误钩子。
 *
 * @param channel 事件通道名（如 chat-stream / business-event）
 * @param listeners 订阅方监听器集合
 * @param event 派发的事件载荷
 */
export function safeEmit<T>(
  channel: string,
  listeners: Set<EventListener<T>>,
  event: T
): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      reportListenerError(channel, listener.name || '<anonymous>', error)
    }
  }
}
