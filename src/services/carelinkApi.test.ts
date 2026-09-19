import { describe, expect, it, vi } from 'vitest'
import type { CarelinkClient } from '../../api/_lib/carelinkClient'
import { createSubscribeHandler } from '../../api/carelink/subscribe'
import { createCarelinkCrawlHandler } from '../../api/cron/carelink-crawl'

const url = 'https://demo.example/api/carelink/subscribe'

describe('Carelink Vercel endpoints', () => {
  it('requires same-origin, visitor cookie, and a valid conversation to subscribe', async () => {
    const post = vi.fn().mockResolvedValue({ enabled: true, region: '天津市', conversationSuffix: 'abc123' })
    const handler = createSubscribeHandler({ carelink: { post } as unknown as CarelinkClient })

    expect((await handler(new Request(url, { method: 'GET' }))).status).toBe(405)
    expect((await handler(new Request(url, {
      method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}',
    }))).status).toBe(403)
    expect((await handler(new Request(url, {
      method: 'POST', headers: { Origin: 'https://demo.example' }, body: '{}',
    }))).status).toBe(409)

    const response = await handler(new Request(url, {
      method: 'POST',
      headers: {
        Origin: 'https://demo.example',
        Cookie: 'ohx_ref=web_visitor_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId: 'conversation-abc123' }),
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(post).toHaveBeenCalledWith('/v1/openhex/subscriptions/upsert', {
      recipientId: 'E001',
      spUserRef: 'web_visitor_123',
      conversationId: 'conversation-abc123',
      region: '天津市',
      age: 82,
      localHukou: true,
      needsCertification: false,
    })
  })

  it('protects cron with the bearer secret and returns a redacted summary', async () => {
    const env = {
      CRON_SECRET: 'cron-secret',
      CARELINK_API_BASE_URL: 'https://carelink.example',
      CARELINK_API_KEY: 'policy-secret',
    }
    const post = vi.fn().mockResolvedValue({ accepted: 2, rejected: [{ reason: 'private upstream detail' }] })
    const handler = createCarelinkCrawlHandler(env, () => ({ post }) as unknown as CarelinkClient)
    expect((await handler(new Request('https://demo.example/api/cron/carelink-crawl'))).status).toBe(401)
    const response = await handler(new Request('https://demo.example/api/cron/carelink-crawl', {
      headers: { Authorization: 'Bearer cron-secret' },
    }))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(JSON.parse(text)).toEqual({ ok: true, accepted: 2, rejected: 1 })
    expect(text).not.toContain('private upstream detail')
  })
})
