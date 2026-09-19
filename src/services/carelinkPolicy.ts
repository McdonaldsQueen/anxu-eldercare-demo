export const CARELINK_SYNC_EVENT = 'anxu:carelink-sync'

export type PolicyPushOutcome = 'sent' | 'no_new' | 'busy' | 'not_subscribed' | 'cooldown' | 'failed'

export interface PolicySubscriptionStatus {
  enabled: boolean
  region: string
  schedule: string
  conversationSuffix?: string
  lastPushAt?: string | null
  lastOutcome?: string | null
}

export interface ManualPolicyPushResult {
  outcome: PolicyPushOutcome
  retryAfterSeconds?: number
}

const parseJson = async <T>(response: Response): Promise<T> => {
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || '政策提醒服务暂时不可用。')
  return payload
}

export const getPolicySubscriptionStatus = (request: typeof fetch = globalThis.fetch) => request(
  '/api/carelink/status',
  { credentials: 'same-origin' },
).then((response) => parseJson<PolicySubscriptionStatus>(response))

export const subscribePolicyReminder = (
  conversationId: string,
  request: typeof fetch = globalThis.fetch,
) => request('/api/carelink/subscribe', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId }),
}).then((response) => parseJson<PolicySubscriptionStatus>(response))

export const unsubscribePolicyReminder = (request: typeof fetch = globalThis.fetch) => request(
  '/api/carelink/subscribe',
  { method: 'DELETE', credentials: 'same-origin' },
).then((response) => parseJson<PolicySubscriptionStatus>(response))

export const pushPoliciesNow = async (request: typeof fetch = globalThis.fetch) => {
  const response = await request('/api/carelink/manual-push', {
    method: 'POST',
    credentials: 'same-origin',
  })
  const result = await parseJson<ManualPolicyPushResult>(response)
  if (result.outcome === 'sent') window.dispatchEvent(new Event(CARELINK_SYNC_EVENT))
  return result
}
