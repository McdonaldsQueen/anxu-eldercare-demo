import { OpenhexClient, type StartVisitorSessionRequest } from '@openhex-ai/agent-sdk'

import { VISITOR_COOKIE } from '../_lib/request.js'
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180
const TOKEN_TTL_SECONDS = 1800
const VISITOR_REF_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

interface ChatTokenEnvironment {
  OPENHEX_WORKSPACE_KEY?: string
  OPENHEX_WORKSPACE_SLUG?: string
  NODE_ENV?: string
}

interface VisitorSessionResult {
  token: string
  expires_at: string
}

interface ChatTokenDependencies {
  env?: ChatTokenEnvironment
  createVisitorRef?: () => string
  startVisitorSession?: (
    apiKey: string,
    workspaceSlug: string,
    input: StartVisitorSessionRequest,
  ) => Promise<VisitorSessionResult>
}

const json = (body: unknown, status: number, initHeaders?: HeadersInit) => {
  const headers = new Headers(initHeaders)
  headers.set('Cache-Control', 'no-store')

  return Response.json(body, {
    status,
    headers,
  })
}

const readCookie = (header: string | null, name: string) => {
  if (!header) return null

  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=')
    if (separator === -1) continue
    if (entry.slice(0, separator).trim() !== name) continue

    try {
      return decodeURIComponent(entry.slice(separator + 1).trim())
    } catch {
      return null
    }
  }

  return null
}

const defaultStartVisitorSession = async (
  apiKey: string,
  workspaceSlug: string,
  input: StartVisitorSessionRequest,
) => {
  const workspace = new OpenhexClient({ apiKey }).workspace(workspaceSlug)
  return workspace.startVisitorSession(input)
}

const createDefaultVisitorRef = () => {
  const random = new Uint8Array(12)
  globalThis.crypto.getRandomValues(random)
  return `web_${Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function createChatTokenHandler(dependencies: ChatTokenDependencies = {}) {
  const createVisitorRef = dependencies.createVisitorRef ?? createDefaultVisitorRef
  const startVisitorSession = dependencies.startVisitorSession ?? defaultStartVisitorSession

  return async function handleChatTokenRequest(request: Request) {
    // Vercel Dev can inject Development variables after importing the module.
    // Resolve process.env per request instead of retaining the import-time object.
    const env = dependencies.env ?? process.env

    if (
      !dependencies.env
      && (!env.OPENHEX_WORKSPACE_KEY || !env.OPENHEX_WORKSPACE_SLUG)
      && typeof process.loadEnvFile === 'function'
    ) {
      try {
        process.loadEnvFile('.env.local')
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
        if (code !== 'ENOENT') throw error
      }
    }

    if (request.method !== 'POST') {
      return json(
        { error: 'Method not allowed' },
        405,
        { Allow: 'POST' },
      )
    }

    const apiKey = env.OPENHEX_WORKSPACE_KEY?.trim()
    const workspaceSlug = env.OPENHEX_WORKSPACE_SLUG?.trim()
    if (!apiKey || !workspaceSlug) {
      return json({ error: 'OpenHex 服务尚未配置。' }, 500)
    }

    const cookieRef = readCookie(request.headers.get('cookie'), VISITOR_COOKIE)
    const visitorRef = cookieRef && VISITOR_REF_PATTERN.test(cookieRef)
      ? cookieRef
      : createVisitorRef()

    try {
      const session = await startVisitorSession(apiKey, workspaceSlug, {
        sp_user_ref: visitorRef,
        display_name: '王阿姨（安序智护 Demo）',
        ttl_seconds: TOKEN_TTL_SECONDS,
      })
      if (!session.token || !session.expires_at) throw new Error('Invalid OpenHex session response')

      const headers = new Headers()
      if (visitorRef !== cookieRef) {
        const secure = env.NODE_ENV === 'production' ? '; Secure' : ''
        headers.set(
          'Set-Cookie',
          `${VISITOR_COOKIE}=${encodeURIComponent(visitorRef)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_COOKIE_MAX_AGE}${secure}`,
        )
      }

      return json(
        { token: session.token, expiresAt: session.expires_at },
        200,
        headers,
      )
    } catch {
      return json({ error: '暂时无法连接安序智护，请稍后重试。' }, 502)
    }
  }
}

export const handleChatTokenRequest = createChatTokenHandler()

export default {
  fetch: handleChatTokenRequest,
}
