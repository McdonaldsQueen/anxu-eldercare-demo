import { useDemoStore } from '../store/demoStore'
import { useDemoUiStore } from '../store/demoUiStore'
import { clearOpenhexDiagnostics } from './openhexDiagnostics'
import { resetOpenhexTokenCache } from './openhexToken'
import { resetSensorSimulation } from './sensorDemoState'

export const DEMO_RESET_EVENT = 'anxu:demo-reset'
export const OPENHEX_CONVERSATION_STORAGE_KEY = 'ohx:convo:anxu-eldercare-agent-chat'

const RESET_ENDPOINT = '/api/openhex/demo-reset'
const RESET_REQUEST_TIMEOUT_MS = 5_000

export function resetLocalDemoState() {
  // The mounted SDK hook must forget its in-memory conversation before storage is cleared.
  window.dispatchEvent(new Event(DEMO_RESET_EVENT))
  window.localStorage.removeItem(OPENHEX_CONVERSATION_STORAGE_KEY)
  resetOpenhexTokenCache()
  resetSensorSimulation()
  useDemoStore.getState().resetDemo()
  useDemoUiStore.getState().resetExperienceMode()
  clearOpenhexDiagnostics()
}

export async function resetEntireDemo(request: typeof fetch = globalThis.fetch) {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), RESET_REQUEST_TIMEOUT_MS)
  let visitorIdentityCleared = false

  try {
    const response = await request(RESET_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
    })
    if (response.ok) {
      const payload: unknown = await response.json()
      visitorIdentityCleared = (payload as { reset?: unknown } | null)?.reset === true
    }
  } catch {
    // A static preview has no API; clearing the SDK conversation still starts a new thread.
  } finally {
    globalThis.clearTimeout(timeout)
    resetLocalDemoState()
  }

  return { visitorIdentityCleared }
}
