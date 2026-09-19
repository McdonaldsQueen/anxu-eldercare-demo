import { createCarelinkClient, type CarelinkClient } from '../_lib/carelinkClient.js'
import { FIXED_RECIPIENT_ID, readCookie, VISITOR_COOKIE } from '../_lib/request.js'

export function createDemoResetHandler(
  env: NodeJS.ProcessEnv = process.env,
  carelink?: CarelinkClient,
) {
  return async function handleDemoResetRequest(request: Request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, {
        status: 405,
        headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
      })
    }

    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return Response.json({ error: 'Forbidden' }, {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const spUserRef = readCookie(request, VISITOR_COOKIE)
    if (spUserRef) {
      try {
        const client = carelink ?? createCarelinkClient(env)
        await client.post('/v1/admin/reset-recipient', {
          recipientId: FIXED_RECIPIENT_ID,
          spUserRef,
        })
      } catch {
        // Reset remains usable when the optional policy service is unavailable.
      }
    }

    const secure = env.NODE_ENV === 'production' ? '; Secure' : ''
    return Response.json({ reset: true }, {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${VISITOR_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`,
      },
    })
  }
}

export const handleDemoResetRequest = createDemoResetHandler()

export default {
  fetch: handleDemoResetRequest,
}
