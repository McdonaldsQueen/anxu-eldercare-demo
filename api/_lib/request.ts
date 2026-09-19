export const VISITOR_COOKIE = 'ohx_ref'
export const FIXED_RECIPIENT_ID = 'E001'

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Cache-Control', 'no-store')
  return Response.json(body, { status, headers: responseHeaders })
}

export const readCookie = (request: Request, name: string) => {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=')
    if (separator === -1 || entry.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

export const visitorRef = (request: Request) => readCookie(request, VISITOR_COOKIE)

export const isSameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export const bearerAuthorized = (request: Request, secret?: string) => Boolean(
  secret
  && request.headers.get('authorization') === `Bearer ${secret}`,
)
