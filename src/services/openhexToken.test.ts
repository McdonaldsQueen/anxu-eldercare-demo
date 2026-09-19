import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOpenhexToken, resetOpenhexTokenCache, TOKEN_REQUEST_TIMEOUT_MS } from './openhexToken'

const tokenResponse = (token: string, expiresAt: string) =>
  new Response(JSON.stringify({ token, expiresAt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('OpenHex token client', () => {
  beforeEach(() => resetOpenhexTokenCache())

  it('caches a token until its refresh window', async () => {
    let currentTime = Date.parse('2030-01-01T00:00:00.000Z')
    const request = vi.fn().mockResolvedValue(
      tokenResponse('token-one', '2030-01-01T00:30:00.000Z'),
    )

    await expect(getOpenhexToken(request, () => currentTime)).resolves.toBe('token-one')
    currentTime += 20 * 60 * 1000
    await expect(getOpenhexToken(request, () => currentTime)).resolves.toBe('token-one')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('refreshes a token with less than one minute remaining', async () => {
    let currentTime = Date.parse('2030-01-01T00:00:00.000Z')
    const request = vi.fn()
      .mockResolvedValueOnce(tokenResponse('token-one', '2030-01-01T00:02:00.000Z'))
      .mockResolvedValueOnce(tokenResponse('token-two', '2030-01-01T00:32:00.000Z'))

    await expect(getOpenhexToken(request, () => currentTime)).resolves.toBe('token-one')
    currentTime += 90 * 1000
    await expect(getOpenhexToken(request, () => currentTime)).resolves.toBe('token-two')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent token requests', async () => {
    let resolveRequest: ((response: Response) => void) | undefined
    const request = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve
    }))
    const now = () => Date.parse('2030-01-01T00:00:00.000Z')

    const first = getOpenhexToken(request, now)
    const second = getOpenhexToken(request, now)
    resolveRequest?.(tokenResponse('shared-token', '2030-01-01T00:30:00.000Z'))

    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token'])
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('clears a failed in-flight request so it can be retried', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(tokenResponse('recovered-token', '2030-01-01T00:30:00.000Z'))
    const now = () => Date.parse('2030-01-01T00:00:00.000Z')

    await expect(getOpenhexToken(request, now)).rejects.toThrow('暂时无法连接安序智护')
    await expect(getOpenhexToken(request, now)).resolves.toBe('recovered-token')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('aborts a token request after 15 seconds and allows a later retry', async () => {
    vi.useFakeTimers()
    const request = vi.fn()
      .mockImplementationOnce((_input, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }))
      .mockResolvedValueOnce(tokenResponse('recovered-token', '2030-01-01T00:30:00.000Z'))
    const now = () => Date.parse('2030-01-01T00:00:00.000Z')

    const first = getOpenhexToken(request, now)
    const firstExpectation = expect(first).rejects.toThrow('连接安序智护超时')
    await vi.advanceTimersByTimeAsync(TOKEN_REQUEST_TIMEOUT_MS)
    await firstExpectation
    await expect(getOpenhexToken(request, now)).resolves.toBe('recovered-token')
    expect(request).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
