import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyOpenhexFailure,
  clearOpenhexDiagnostics,
  createOpenhexDiagnosticFetch,
  getOpenhexDiagnostics,
  recordOpenhexDiagnostic,
} from './openhexDiagnostics'

describe('OpenHex diagnostics', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearOpenhexDiagnostics()
  })

  it('keeps only the latest 20 safe events', () => {
    for (let index = 0; index < 24; index += 1) {
      recordOpenhexDiagnostic({ phase: 'send', outcome: 'success', statusCode: 200 })
    }

    const events = getOpenhexDiagnostics()
    expect(events).toHaveLength(20)
    expect(JSON.stringify(events)).not.toContain('Authorization')
    expect(JSON.stringify(events)).not.toContain('message')
  })

  it('classifies timeout, auth, rate limit, and upstream failures', () => {
    expect(classifyOpenhexFailure(new DOMException('idle timeout', 'AbortError'))).toBe('timeout')
    expect(classifyOpenhexFailure(null, 401)).toBe('auth')
    expect(classifyOpenhexFailure(null, 429)).toBe('rate_limit')
    expect(classifyOpenhexFailure(null, 502)).toBe('upstream')
  })

  it('records request phase, status, and duration without bodies or headers', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    let time = 100
    const diagnosticFetch = createOpenhexDiagnosticFetch(request, () => {
      time += 25
      return time
    })

    await diagnosticFetch('https://api.openhex.tech/api/v2/conversations/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
      body: JSON.stringify({ message: 'private text' }),
    })

    const serialized = JSON.stringify(getOpenhexDiagnostics())
    expect(getOpenhexDiagnostics().map((event) => event.outcome)).toEqual(['started', 'success'])
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('private text')
  })
})
