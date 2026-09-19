import { describe, expect, it, vi } from 'vitest'
import type { OpenhexClient } from '@openhex-ai/agent-sdk'
import type { CarelinkClient } from '../../api/_lib/carelinkClient'
import { buildPolicyPrompt, runPolicyPush } from '../../api/_lib/policyPush'

const environment = {
  OPENHEX_WORKSPACE_KEY: 'sk_workspace',
  OPENHEX_WORKSPACE_SLUG: 'anxu',
  OPENHEX_AGENT_ID: 'agent-1',
}

const policy = {
  deliveryId: 'delivery-1',
  title: '天津市高龄津贴政策',
  originalUrl: 'https://mz.tj.gov.cn/policy.html',
  sourceInstitution: '天津市民政局',
  publishedAt: '2026-09-01',
  effectiveAt: '2026-09-01',
  expiresAt: null,
  applicationDeadline: null,
  audience: '天津市户籍老年人',
  benefitChange: '免申即享',
  actionRequired: '核对发放状态',
}

const claim = {
  status: 'claimed' as const,
  batchId: 'batch-1',
  marker: 'CARELINK_POLICY_PUSH:batch-1',
  messages: [policy],
  subscription: {
    spUserRef: 'web_visitor',
    conversationId: 'conversation-1',
    region: '天津市',
  },
}

describe('policy push orchestration', () => {
  it('preserves the verified title link and forbids invented facts in the prompt', () => {
    const prompt = buildPolicyPrompt(claim.marker, claim.messages)
    expect(prompt).toContain('[天津市高龄津贴政策](https://mz.tj.gov.cn/policy.html)')
    expect(prompt).toContain('不新增金额、资格、日期或办理条件')
  })

  it('sends to the bound conversation and only then completes the batch', async () => {
    const carelinkPost = vi.fn()
      .mockResolvedValueOnce(claim)
      .mockResolvedValueOnce({ completed: true })
    const send = vi.fn().mockResolvedValue({ conversationId: 'conversation-1', userEventId: 'event-1', results: [] })
    const messages = vi.fn().mockResolvedValue({ entries: [] })
    const result = await runPolicyPush('cron', environment, {
      carelink: { post: carelinkPost } as unknown as CarelinkClient,
      startVisitorSession: vi.fn().mockResolvedValue({ token: 'visitor-token' }),
      createOpenhexClient: () => ({ chat: { messages, send } }) as unknown as OpenhexClient,
      runId: () => 'run-1',
    })

    expect(result).toEqual({ outcome: 'sent' })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1',
      source: 'carelink-scheduler',
      message: expect.stringContaining('[CARELINK_POLICY_PUSH:batch-1]'),
    }))
    expect(carelinkPost).toHaveBeenLastCalledWith('/v1/openhex/push/complete', {
      recipientId: 'E001', batchId: 'batch-1', runId: 'run-1', userEventId: 'event-1',
    })
  })

  it('reconciles an existing marker without resending and fails without acknowledgement', async () => {
    const markerRecord = {
      id: 'entry-1',
      data: {
        seq: 1,
        sender: 'user',
        event: 'message',
        timestamp: Date.now(),
        sessionId: null,
        raw: { type: 'user', message: '[CARELINK_POLICY_PUSH:batch-1]' },
      },
    }
    const carelinkPost = vi.fn().mockResolvedValueOnce(claim).mockResolvedValueOnce({ completed: true })
    const send = vi.fn()
    await expect(runPolicyPush('cron', environment, {
      carelink: { post: carelinkPost } as unknown as CarelinkClient,
      startVisitorSession: vi.fn().mockResolvedValue({ token: 'visitor-token' }),
      createOpenhexClient: () => ({
        chat: { messages: vi.fn().mockResolvedValue({ entries: [markerRecord] }), send },
      }) as unknown as OpenhexClient,
      runId: () => 'run-1',
    })).resolves.toEqual({ outcome: 'sent' })
    expect(send).not.toHaveBeenCalled()

    const failingPost = vi.fn().mockResolvedValueOnce(claim).mockResolvedValueOnce({ failed: true })
    await expect(runPolicyPush('cron', environment, {
      carelink: { post: failingPost } as unknown as CarelinkClient,
      startVisitorSession: vi.fn().mockRejectedValue(new Error('private upstream detail')),
      runId: () => 'run-2',
    })).resolves.toEqual({ outcome: 'failed' })
    expect(failingPost).toHaveBeenLastCalledWith('/v1/openhex/push/fail', expect.objectContaining({
      recipientId: 'E001', batchId: 'batch-1', runId: 'run-2', errorCategory: 'upstream',
    }))
  })
})
