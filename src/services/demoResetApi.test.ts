import { describe, expect, it } from 'vitest'
import { createDemoResetHandler } from '../../api/openhex/demo-reset'

describe('OpenHex demo reset endpoint', () => {
  const url = 'https://demo.example/api/openhex/demo-reset'

  it('accepts only same-origin POST and expires the HttpOnly visitor cookie', async () => {
    const handler = createDemoResetHandler({ NODE_ENV: 'production' })
    const response = handler(new Request(url, {
      method: 'POST',
      headers: { Origin: 'https://demo.example', Cookie: 'ohx_ref=web_oldvisitor' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toContain('ohx_ref=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    await expect(response.json()).resolves.toEqual({ reset: true })
  })

  it('rejects GET and cross-origin POST without changing the cookie', () => {
    const handler = createDemoResetHandler({})
    expect(handler(new Request(url)).status).toBe(405)

    const crossOrigin = handler(new Request(url, {
      method: 'POST', headers: { Origin: 'https://other.example' },
    }))
    expect(crossOrigin.status).toBe(403)
    expect(crossOrigin.headers.has('set-cookie')).toBe(false)
  })
})
