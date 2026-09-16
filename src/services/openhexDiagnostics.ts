export type OpenhexDiagnosticPhase =
  | 'token'
  | 'send'
  | 'stream'
  | 'history'
  | 'interrupt'
  | 'first_event'
  | 'first_text'
  | 'complete'
  | 'conversation'

export type OpenhexDiagnosticOutcome =
  | 'started'
  | 'success'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'upstream'
  | 'network'
  | 'cancelled'

export interface OpenhexDiagnosticEvent {
  id: string
  occurredAt: string
  phase: OpenhexDiagnosticPhase
  outcome: OpenhexDiagnosticOutcome
  durationMs?: number
  statusCode?: number
  conversationSuffix?: string
}

const STORAGE_KEY = 'anxu-openhex-diagnostics'
const MAX_EVENTS = 20
const listeners = new Set<() => void>()
let memoryEvents: OpenhexDiagnosticEvent[] = []
let initialized = false

const hasSessionStorage = () => typeof window !== 'undefined' && Boolean(window.sessionStorage)

const readStoredEvents = () => {
  if (initialized || !hasSessionStorage()) return memoryEvents
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    memoryEvents = Array.isArray(parsed) ? parsed as OpenhexDiagnosticEvent[] : []
  } catch {
    memoryEvents = []
  }
  initialized = true
  return memoryEvents
}

const writeStoredEvents = (events: OpenhexDiagnosticEvent[]) => {
  memoryEvents = events
  initialized = true
  if (hasSessionStorage()) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    } catch {
      // Diagnostics must never interrupt the chat when storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener())
}

export const getOpenhexDiagnostics = () => readStoredEvents()

export const subscribeOpenhexDiagnostics = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const clearOpenhexDiagnostics = () => writeStoredEvents([])

export const conversationSuffix = (conversationId?: string) =>
  conversationId ? conversationId.slice(-6) : undefined

export const classifyOpenhexFailure = (
  error: unknown,
  statusCode?: number,
): OpenhexDiagnosticOutcome => {
  if (statusCode === 401 || statusCode === 403) return 'auth'
  if (statusCode === 429) return 'rate_limit'
  if (statusCode && statusCode >= 500) return 'upstream'

  const candidate = error as { name?: string; message?: string } | null
  const name = candidate?.name?.toLowerCase() ?? ''
  const message = candidate?.message?.toLowerCase() ?? ''
  if (name === 'aborterror' || message.includes('idle timeout') || message.includes('timed out') || message.includes('超时')) {
    return 'timeout'
  }
  if (message.includes('cancel') || message.includes('interrupt') || message.includes('取消')) return 'cancelled'
  return 'network'
}

export const recordOpenhexDiagnostic = (
  event: Omit<OpenhexDiagnosticEvent, 'id' | 'occurredAt'>,
) => {
  const next: OpenhexDiagnosticEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  }
  writeStoredEvents([...readStoredEvents(), next].slice(-MAX_EVENTS))
  return next
}

const phaseForUrl = (url: string, method: string): OpenhexDiagnosticPhase | null => {
  if (url.includes('/interrupt')) return 'interrupt'
  if (url.includes('/history') || url.includes('/messages')) return 'history'
  if (url.includes('/stream')) return 'stream'
  if (url.includes('/conversations/send') || (url.includes('/conversations') && method === 'POST')) return 'send'
  return null
}

export const createOpenhexDiagnosticFetch = (
  request: typeof fetch = globalThis.fetch,
  now: () => number = Date.now,
): typeof fetch => async (input, init) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const phase = phaseForUrl(url, method)
  const startedAt = now()

  if (phase) recordOpenhexDiagnostic({ phase, outcome: 'started' })

  try {
    const response = await request(input, init)
    if (phase) {
      recordOpenhexDiagnostic({
        phase,
        outcome: response.ok ? 'success' : classifyOpenhexFailure(null, response.status),
        durationMs: Math.max(0, now() - startedAt),
        statusCode: response.status,
      })
    }
    return response
  } catch (error) {
    if (phase) {
      recordOpenhexDiagnostic({
        phase,
        outcome: classifyOpenhexFailure(error),
        durationMs: Math.max(0, now() - startedAt),
      })
    }
    throw error
  }
}

export const openhexErrorMessage = (error: unknown) => {
  const statusCode = (error as { status?: number } | null)?.status
  switch (classifyOpenhexFailure(error, statusCode)) {
    case 'timeout':
      return '等待回复超过 5 分钟。本轮任务可能仍在执行，请先重新连接并同步会话。'
    case 'auth':
      return '会话凭证已失效，请重新连接后再试。'
    case 'rate_limit':
      return '当前请求较多，请稍等片刻再试。'
    case 'upstream':
      return 'OpenHex 服务暂时不可用，请稍后重新连接。'
    case 'cancelled':
      return '已停止本轮回复。'
    default:
      return '网络连接中断，请检查网络后重新连接。'
  }
}
