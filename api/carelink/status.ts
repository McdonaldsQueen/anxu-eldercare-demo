import { createCarelinkClient } from '../_lib/carelinkClient.js'
import { FIXED_RECIPIENT_ID, json, visitorRef } from '../_lib/request.js'

export function createStatusHandler(
  env: NodeJS.ProcessEnv = process.env,
  carelink = createCarelinkClient,
) {
  return async function handleStatus(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    const spUserRef = visitorRef(request)
    if (!spUserRef) return json({ enabled: false, region: '天津市', schedule: '每天 09:00' })
    try {
      const status = await carelink(env).post<Record<string, unknown>>('/v1/openhex/subscriptions/status', {
        recipientId: FIXED_RECIPIENT_ID,
        spUserRef,
      })
      return json(status)
    } catch {
      return json({ error: '政策提醒状态暂时无法读取。' }, 502)
    }
  }
}

export const handleStatus = createStatusHandler()
export default { fetch: handleStatus }
