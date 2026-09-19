import { createCarelinkClient } from '../_lib/carelinkClient.js'
import { FIXED_RECIPIENT_ID, isSameOrigin, json, visitorRef } from '../_lib/request.js'

const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{6,128}$/

interface SubscribeDependencies {
  env?: NodeJS.ProcessEnv
  carelink?: ReturnType<typeof createCarelinkClient>
}

export function createSubscribeHandler(dependencies: SubscribeDependencies = {}) {
  return async function handleSubscribe(request: Request) {
    if (!['POST', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, { Allow: 'POST, DELETE' })
    if (!isSameOrigin(request)) return json({ error: 'Forbidden' }, 403)
    const spUserRef = visitorRef(request)
    if (!spUserRef) return json({ error: '请先开始一次 OpenHex 对话。' }, 409)

    try {
      const carelink = dependencies.carelink ?? createCarelinkClient(dependencies.env ?? process.env)
      if (request.method === 'DELETE') {
        await carelink.post('/v1/openhex/subscriptions/delete', {
          recipientId: FIXED_RECIPIENT_ID,
          spUserRef,
        })
        return json({ enabled: false, region: '天津市', schedule: '每天 09:00' })
      }

      const body = await request.json() as { conversationId?: unknown }
      const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
      if (!CONVERSATION_ID_PATTERN.test(conversationId)) return json({ error: '请先在老人端开始一次 OpenHex 对话。' }, 400)
      const status = await carelink.post<Record<string, unknown>>('/v1/openhex/subscriptions/upsert', {
        recipientId: FIXED_RECIPIENT_ID,
        spUserRef,
        conversationId,
        region: '天津市',
        age: 82,
        localHukou: true,
        needsCertification: false,
      })
      return json({ ...status, schedule: '每天 09:00' })
    } catch {
      return json({ error: '政策提醒服务暂时不可用，请稍后重试。' }, 502)
    }
  }
}

export const handleSubscribe = createSubscribeHandler()
export default { fetch: handleSubscribe }
