import { describe, expect, it, vi } from 'vitest'
import type { CarelinkClient } from '../../api/_lib/carelinkClient'
import { createDemoResetHandler } from '../../api/openhex/demo-reset'

describe('OpenHex demo reset endpoint', () => {
  const url = 'https://demo.example/api/openhex/demo-reset'

  it('accepts only same-origin POST and expires the HttpOnly visitor cookie', async () => {
    const post = vi.fn().mockResolvedValue({ reset: true })
    const handler = createDemoResetHandler(
      { NODE_ENV: 'production' },
      { post } as unknown as CarelinkClient,
    )
    const response = await handler(new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://demo.example', Cookie: 'ohx_ref=web_oldvisitor' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toContain('ohx_ref=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    expect(post).toHaveBeenCalledWith('/v1/admin/reset-recipient', {
      recipientId: 'E001',
      spUserRef: 'web_oldvisitor',
    })
    await expect(response.json()).resolves.toEqual({ reset: true })
  })

  it('rejects GET and cross-origin POST without changing the cookie', async () => {
    const handler = createDemoResetHandler({})
    expect((await handler(new Request(url))).status).toBe(405)

    const crossOrigin = await handler(new Request(url, {
      method: 'POST', headers: { Origin: 'https://other.example' },
    }))
    expect(crossOrigin.status).toBe(403)
    expect(crossOrigin.headers.has('set-cookie')).toBe(false)
  })
})
