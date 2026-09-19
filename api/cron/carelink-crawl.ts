import { createCarelinkClient } from '../_lib/carelinkClient.js'
import { bearerAuthorized, json } from '../_lib/request.js'

export const maxDuration = 60

export function createCarelinkCrawlHandler(
  env: NodeJS.ProcessEnv = process.env,
  carelinkFactory = createCarelinkClient,
) {
  return async function handleCarelinkCrawl(request: Request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (!bearerAuthorized(request, env.CRON_SECRET)) return json({ error: 'Unauthorized' }, 401)
    try {
      const report = await carelinkFactory(env).post<Record<string, unknown>>('/v1/admin/crawl', {}, 50_000)
      return json({ ok: true, accepted: report.accepted ?? 0, rejected: Array.isArray(report.rejected) ? report.rejected.length : 0 })
    } catch {
      return json({ ok: false, error: 'Carelink crawl failed' }, 502)
    }
  }
}

export const handleCarelinkCrawl = createCarelinkCrawlHandler()
export default { fetch: handleCarelinkCrawl }
