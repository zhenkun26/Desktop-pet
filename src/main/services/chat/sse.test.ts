import { describe, expect, it } from 'vitest'
import { parseSseContentDeltas } from './sse'

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

async function collect(chunks: string[]): Promise<string[]> {
  const deltas: string[] = []
  for await (const delta of parseSseContentDeltas(streamFrom(chunks))) {
    deltas.push(delta)
  }
  return deltas
}

describe('parseSseContentDeltas', () => {
  it('should extract content deltas from data lines', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"你"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"好"}}]}\n' +
      'data: [DONE]\n'
    expect(await collect([body])).toEqual(['你', '好'])
  })

  it('should handle chunks split across line boundaries', async () => {
    const line = 'data: {"choices":[{"delta":{"content":"跨块"}}]}\n'
    expect(await collect([line.slice(0, 10), line.slice(10)])).toEqual(['跨块'])
  })

  it('should ignore comments, empty lines and malformed JSON', async () => {
    const body = ': keep-alive\n\ndata: not-json\n' +
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n'
    expect(await collect([body])).toEqual(['ok'])
  })

  it('should process the final line without a trailing newline', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"尾巴"}}]}'
    expect(await collect([body])).toEqual(['尾巴'])
  })

  it('should handle CRLF line endings', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"回车"}}]}\r\n'
    expect(await collect([body])).toEqual(['回车'])
  })
})
