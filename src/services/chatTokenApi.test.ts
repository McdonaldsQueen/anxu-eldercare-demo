import { describe, expect, it, vi } from 'vitest'
import { createChatTokenHandler } from '../../api/openhex/chat-token'

const configuredEnvironment = {
  OPENHEX_WORKSPACE_KEY: 'sk_test',
  OPENHEX_WORKSPACE_SLUG: 'anxu-demo',
  NODE_ENV: 'production',
}

describe('OpenHex chat-token Vercel Function', () => {
  it('rejects methods other than POST without calling OpenHex', async () => {
    const startVisitorSession = vi.fn()
    const handler = createChatTokenHandler({
      env: configuredEnvironment,
      startVisitorSession,
    })

    const response = await handler(new Request('https://demo.example/api/openhex/chat-token'))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(startVisitorSession).not.toHaveBeenCalled()
  })

  it('fails safely when server-only settings are missing', async () => {
    const handler = createChatTokenHandler({ env: {} })
    const response = await handler(new Request('https://demo.example/api/openhex/chat-token', { method: 'POST' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'OpenHex 服务尚未配置。' })
  })

  it('creates a stable visitor cookie and returns the short-lived session', async () => {
    const startVisitorSession = vi.fn().mockResolvedValue({
      token: 'visitor-token',
      expires_at: '2030-01-01T00:30:00.000Z',
    })
    const handler = createChatTokenHandler({
      env: configuredEnvironment,
      createVisitorRef: () => 'web_1234567890abcdef',
      startVisitorSession,
    })

    const response = await handler(new Request('https://demo.example/api/openhex/chat-token', { method: 'POST' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toContain('ohx_ref=web_1234567890abcdef')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    expect(startVisitorSession).toHaveBeenCalledWith(
      'sk_test',
      'anxu-demo',
      {
        sp_user_ref: 'web_1234567890abcdef',
        display_name: '王阿姨（安序智护 Demo）',
        ttl_seconds: 1800,
      },
    )
    await expect(response.json()).resolves.toEqual({
      token: 'visitor-token',
      expiresAt: '2030-01-01T00:30:00.000Z',
    })
  })

  it('reuses a valid visitor cookie without replacing it', async () => {
    const startVisitorSession = vi.fn().mockResolvedValue({
      token: 'returning-token',
      expires_at: '2030-01-01T00:30:00.000Z',
    })
    const handler = createChatTokenHandler({
      env: configuredEnvironment,
      createVisitorRef: () => 'should_not_be_used',
      startVisitorSession,
    })

    const response = await handler(new Request('https://demo.example/api/openhex/chat-token', {
      method: 'POST',
      headers: { Cookie: 'theme=light; ohx_ref=web_returning_visitor' },
    }))

    expect(response.headers.has('set-cookie')).toBe(false)
    expect(startVisitorSession).toHaveBeenCalledWith(
      'sk_test',
      'anxu-demo',
      {
        sp_user_ref: 'web_returning_visitor',
        display_name: '王阿姨（安序智护 Demo）',
        ttl_seconds: 1800,
      },
    )
  })

  it('does not expose upstream error details', async () => {
    const handler = createChatTokenHandler({
      env: configuredEnvironment,
      startVisitorSession: vi.fn().mockRejectedValue(new Error('secret upstream response')),
    })

    const response = await handler(new Request('https://demo.example/api/openhex/chat-token', { method: 'POST' }))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('secret upstream response')
  })
})
