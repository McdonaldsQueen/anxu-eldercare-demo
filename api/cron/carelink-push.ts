import { runPolicyPush } from '../_lib/policyPush.js'
import { bearerAuthorized, json } from '../_lib/request.js'

export const maxDuration = 60

export function createCarelinkPushHandler(env: NodeJS.ProcessEnv = process.env) {
  return async function handleCarelinkPush(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (!bearerAuthorized(request, env.CRON_SECRET)) return json({ error: 'Unauthorized' }, 401)
    try {
      const result = await runPolicyPush('cron', env)
      return json(result, result.outcome === 'failed' ? 502 : 200)
    } catch {
      return json({ outcome: 'failed' }, 502)
    }
  }
}

export const handleCarelinkPush = createCarelinkPushHandler()
export default { fetch: handleCarelinkPush }
