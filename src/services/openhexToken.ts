import {
  classifyOpenhexFailure,
  recordOpenhexDiagnostic,
} from './openhexDiagnostics'

const TOKEN_ENDPOINT = '/api/openhex/chat-token'
const REFRESH_WINDOW_MS = 60_000
export const TOKEN_REQUEST_TIMEOUT_MS = 15_000

interface TokenResponse {
  token: string
  expiresAt: string
}

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null
let inFlightRequest: Promise<string> | null = null
let activeRequestController: AbortController | null = null
let cacheGeneration = 0

const isTokenResponse = (value: unknown): value is TokenResponse => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TokenResponse>
  return typeof candidate.token === 'string' && typeof candidate.expiresAt === 'string'
}

export async function getOpenhexToken(
  request: typeof fetch = globalThis.fetch,
  now: () => number = Date.now,
) {
  const currentTime = now()
  if (cachedToken && cachedToken.expiresAt - currentTime > REFRESH_WINDOW_MS) {
    return cachedToken.token
  }

  if (inFlightRequest) return inFlightRequest

  const requestGeneration = cacheGeneration
  const requestPromise = (async () => {
    const startedAt = Date.now()
    const controller = new AbortController()
    activeRequestController = controller
    const timeout = globalThis.setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS)
    recordOpenhexDiagnostic({ phase: 'token', outcome: 'started' })

    let response: Response
    try {
      response = await request(TOKEN_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
    } catch (error) {
      if (requestGeneration !== cacheGeneration) throw error
      const outcome = controller.signal.aborted ? 'timeout' : classifyOpenhexFailure(error)
      recordOpenhexDiagnostic({ phase: 'token', outcome, durationMs: Date.now() - startedAt })
      if (outcome === 'timeout') throw new Error('连接安序智护超时，请稍后重试。')
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
      if (activeRequestController === controller) activeRequestController = null
    }

    if (requestGeneration !== cacheGeneration) throw new Error('OpenHex token request cancelled by demo reset')

    if (!response.ok) {
      recordOpenhexDiagnostic({
        phase: 'token',
        outcome: classifyOpenhexFailure(null, response.status),
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      })
      throw new Error('暂时无法连接安序智护，请稍后重试。')
    }

    const payload: unknown = await response.json()
    if (requestGeneration !== cacheGeneration) throw new Error('OpenHex token request cancelled by demo reset')
    if (!isTokenResponse(payload)) {
      throw new Error('安序智护返回了无法识别的会话信息。')
    }

    const expiresAt = new Date(payload.expiresAt).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) {
      throw new Error('安序智护返回的会话已失效。')
    }

    cachedToken = { token: payload.token, expiresAt }
    recordOpenhexDiagnostic({
      phase: 'token',
      outcome: 'success',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    })
    return payload.token
  })()
  inFlightRequest = requestPromise

  try {
    return await requestPromise
  } finally {
    if (inFlightRequest === requestPromise) inFlightRequest = null
  }
}

export function resetOpenhexTokenCache() {
  cacheGeneration += 1
  activeRequestController?.abort()
  activeRequestController = null
  cachedToken = null
  inFlightRequest = null
}
