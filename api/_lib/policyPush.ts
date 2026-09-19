import { extractText, OpenhexClient } from '@openhex-ai/agent-sdk'
import { createCarelinkClient, type CarelinkClient } from './carelinkClient.js'
import { FIXED_RECIPIENT_ID } from './request.js'

export type PolicyPushOutcome = 'sent' | 'no_new' | 'busy' | 'not_subscribed' | 'cooldown' | 'failed'

interface PolicyMessage {
  deliveryId: string
  title: string
  originalUrl: string
  sourceInstitution: string
  publishedAt: string
  effectiveAt?: string | null
  expiresAt?: string | null
  applicationDeadline?: string | null
  audience: string
  benefitChange: string
  actionRequired: string
}

interface ClaimedPush {
  status: 'claimed'
  batchId: string
  marker: string
  messages: PolicyMessage[]
  subscription: { spUserRef: string; conversationId: string; region: string }
}

interface UnclaimedPush {
  status: 'no_new' | 'busy' | 'not_subscribed' | 'cooldown'
  retryAfterSeconds?: number
}

export interface PolicyPushEnvironment {
  OPENHEX_WORKSPACE_KEY?: string
  OPENHEX_WORKSPACE_SLUG?: string
  OPENHEX_AGENT_ID?: string
  VITE_OPENHEX_API_BASE_URL?: string
  CARELINK_API_BASE_URL?: string
  CARELINK_API_KEY?: string
}

interface PushDependencies {
  carelink?: CarelinkClient
  createOpenhexClient?: (token: string, baseUrl: string) => OpenhexClient
  startVisitorSession?: (apiKey: string, workspaceSlug: string, spUserRef: string) => Promise<{ token: string }>
  runId?: () => string
}

const dateLine = (label: string, value?: string | null) => value ? `- ${label}：${value}` : ''

export function buildPolicyPrompt(marker: string, messages: PolicyMessage[]) {
  const policies = messages.map((message, index) => [
    `政策 ${index + 1}：[${message.title}](${message.originalUrl})`,
    `- 发布机构：${message.sourceInstitution}`,
    dateLine('发布日期', message.publishedAt),
    dateLine('生效日期', message.effectiveAt),
    dateLine('截止日期', message.applicationDeadline),
    `- 适用人群：${message.audience}`,
    `- 政策变化：${message.benefitChange}`,
    `- 建议行动：${message.actionRequired}`,
  ].filter(Boolean).join('\n')).join('\n\n')

  return `[${marker}]\n这是系统定时核验后的政策提醒，请面向 82 岁、天津市户籍的王阿姨，用简明、温和的中文说明。\n\n${policies}\n\n规则：只使用以上已核验事实，不新增金额、资格、日期或办理条件；每项政策的标题链接必须原样保留。`
}

const defaultStartVisitorSession = async (apiKey: string, workspaceSlug: string, spUserRef: string) => {
  const result = await new OpenhexClient({ apiKey }).workspace(workspaceSlug).startVisitorSession({
    sp_user_ref: spUserRef,
    display_name: '王阿姨（安序智护 Demo）',
    ttl_seconds: 1800,
  })
  return { token: result.token }
}

export async function runPolicyPush(
  trigger: 'cron' | 'manual',
  env: PolicyPushEnvironment = process.env,
  dependencies: PushDependencies = {},
): Promise<{ outcome: PolicyPushOutcome; retryAfterSeconds?: number }> {
  const carelink = dependencies.carelink ?? createCarelinkClient(env)
  const runId = dependencies.runId?.() ?? crypto.randomUUID()
  const claim = await carelink.post<ClaimedPush | UnclaimedPush>('/v1/openhex/push/claim', {
    recipientId: FIXED_RECIPIENT_ID,
    runId,
    trigger,
  })
  if (claim.status !== 'claimed') {
    return { outcome: claim.status, retryAfterSeconds: claim.retryAfterSeconds }
  }

  try {
    const apiKey = env.OPENHEX_WORKSPACE_KEY?.trim()
    const workspaceSlug = env.OPENHEX_WORKSPACE_SLUG?.trim()
    const agentId = env.OPENHEX_AGENT_ID?.trim()
    if (!apiKey || !workspaceSlug || !agentId) throw new Error('OpenHex is not configured')
    const session = await (dependencies.startVisitorSession ?? defaultStartVisitorSession)(
      apiKey,
      workspaceSlug,
      claim.subscription.spUserRef,
    )
    const baseUrl = env.VITE_OPENHEX_API_BASE_URL?.trim() || 'https://api.openhex.tech'
    const client = dependencies.createOpenhexClient?.(session.token, baseUrl)
      ?? new OpenhexClient({ apiKey: session.token, baseUrl, timeoutMs: 30_000 })
    const history = await client.chat.messages(claim.subscription.conversationId)
    const alreadySent = history.entries.some((entry) => extractText(entry.data).includes(`[${claim.marker}]`))
    let userEventId: string | undefined
    if (!alreadySent) {
      const result = await client.chat.send({
        message: buildPolicyPrompt(claim.marker, claim.messages),
        conversationId: claim.subscription.conversationId,
        senderName: '安序政策提醒',
        metadata: {
          kind: 'carelink_policy_push',
          batchId: claim.batchId,
          deliveryIds: claim.messages.map((message) => message.deliveryId),
        },
        source: 'carelink-scheduler',
      })
      userEventId = result.userEventId
    }
    await carelink.post('/v1/openhex/push/complete', {
      recipientId: FIXED_RECIPIENT_ID,
      batchId: claim.batchId,
      runId,
      userEventId,
    })
    return { outcome: 'sent' }
  } catch {
    try {
      await carelink.post('/v1/openhex/push/fail', {
        recipientId: FIXED_RECIPIENT_ID,
        batchId: claim.batchId,
        runId,
        errorCategory: 'upstream',
      })
    } catch {
      // Keep the original failure private; an expired lease makes the batch retryable.
    }
    return { outcome: 'failed' }
  }
}
