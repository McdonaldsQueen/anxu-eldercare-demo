const VISITOR_COOKIE = 'ohx_ref'

export function createDemoResetHandler(env: { NODE_ENV?: string } = process.env) {
  return function handleDemoResetRequest(request: Request) {
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
