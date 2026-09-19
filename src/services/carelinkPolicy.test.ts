import { describe, expect, it, vi } from 'vitest'
import {
  CARELINK_SYNC_EVENT,
  getPolicySubscriptionStatus,
  pushPoliciesNow,
  subscribePolicyReminder,
} from './carelinkPolicy'

describe('Carelink browser client', () => {
  it('binds the current conversation without exposing server credentials', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({
      enabled: true,
      region: '天津市',
      schedule: '每天 09:00',
      conversationSuffix: 'abc123',
    }))
    await subscribePolicyReminder('conversation-abc123', request)
    expect(request).toHaveBeenCalledWith('/api/carelink/subscribe', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ conversationId: 'conversation-abc123' }),
    }))
    expect(JSON.stringify(request.mock.calls)).not.toContain('CARELINK_API_KEY')
  })

  it('reads safe status and requests an immediate history sync after send', async () => {
    const statusRequest = vi.fn().mockResolvedValue(Response.json({ enabled: false, region: '天津市', schedule: '每天 09:00' }))
    await expect(getPolicySubscriptionStatus(statusRequest)).resolves.toMatchObject({ enabled: false })

    const sync = vi.fn()
    window.addEventListener(CARELINK_SYNC_EVENT, sync, { once: true })
    const pushRequest = vi.fn().mockResolvedValue(Response.json({ outcome: 'sent' }))
    await expect(pushPoliciesNow(pushRequest)).resolves.toEqual({ outcome: 'sent' })
    expect(sync).toHaveBeenCalledTimes(1)
  })
})
