import { createCarelinkClient } from '../_lib/carelinkClient.js'
import { runPolicyPush } from '../_lib/policyPush.js'
import { FIXED_RECIPIENT_ID, isSameOrigin, json, visitorRef } from '../_lib/request.js'

export const maxDuration = 60

export function createManualPushHandler(
  env: NodeJS.ProcessEnv = process.env,
  carelinkFactory = createCarelinkClient,
  push = runPolicyPush,
) {
  return async function handleManualPush(request: Request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
    if (!isSameOrigin(request)) return json({ error: 'Forbidden' }, 403)
    const spUserRef = visitorRef(request)
    if (!spUserRef) return json({ outcome: 'not_subscribed' }, 409)
    try {
      const carelink = carelinkFactory(env)
      const status = await carelink.post<{ enabled?: boolean }>('/v1/openhex/subscriptions/status', {
        recipientId: FIXED_RECIPIENT_ID,
        spUserRef,
      })
      if (!status.enabled) return json({ outcome: 'not_subscribed' }, 409)
      await carelink.post('/v1/admin/crawl', {}, 45_000)
      return json(await push('manual', env, { carelink }))
    } catch {
      return json({ outcome: 'failed' }, 502)
    }
  }
}

export const handleManualPush = createManualPushHandler()
export default { fetch: handleManualPush }
