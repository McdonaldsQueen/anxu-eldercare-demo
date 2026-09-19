const DEFAULT_TIMEOUT_MS = 20_000

export interface CarelinkEnvironment {
  CARELINK_API_BASE_URL?: string
  CARELINK_API_KEY?: string
}

export class CarelinkConfigurationError extends Error {}
export class CarelinkUpstreamError extends Error {
  constructor(readonly status?: number) {
    super('Carelink upstream request failed')
  }
}

export interface CarelinkClient {
  post<T>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T>
}

export function createCarelinkClient(
  env: CarelinkEnvironment = process.env,
  request: typeof fetch = globalThis.fetch,
): CarelinkClient {
  const baseUrl = env.CARELINK_API_BASE_URL?.trim().replace(/\/$/, '')
  const apiKey = env.CARELINK_API_KEY?.trim()
  if (!baseUrl || !apiKey) throw new CarelinkConfigurationError('Carelink is not configured')

  const origin = new URL(baseUrl).origin
  if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://127.0.0.1') && !baseUrl.startsWith('http://localhost')) {
    throw new CarelinkConfigurationError('Carelink URL must use HTTPS')
  }

  return {
    async post<T>(path: string, body: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const url = new URL(path, `${baseUrl}/`)
      if (url.origin !== origin) throw new CarelinkConfigurationError('Invalid Carelink route')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!response.ok) throw new CarelinkUpstreamError(response.status)
        return await response.json() as T
      } catch (error) {
        if (error instanceof CarelinkConfigurationError || error instanceof CarelinkUpstreamError) throw error
        throw new CarelinkUpstreamError()
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
