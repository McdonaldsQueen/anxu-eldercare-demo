import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoStore, useDemoStore } from '../store/demoStore'
import { defaultExperienceMode, useDemoUiStore } from '../store/demoUiStore'
import { getOpenhexDiagnostics, recordOpenhexDiagnostic } from './openhexDiagnostics'
import { getOpenhexToken, resetOpenhexTokenCache } from './openhexToken'
import {
  DEMO_RESET_EVENT,
  OPENHEX_CONVERSATION_STORAGE_KEY,
  resetEntireDemo,
} from './demoReset'

describe('global demo reset', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetOpenhexTokenCache()
    useDemoStore.getState().resetDemo()
    useDemoUiStore.getState().resetExperienceMode()
  })

  it('clears completed and active cases, both local sessions, SDK persistence, mode, diagnostics and token cache across reload', async () => {
    const state = useDemoStore.getState()
    state.submitElderMessage('我明天下午要去医院，但是没人陪我。')
    state.submitElderMessage('朝阳医院，下午两点半。')
    state.setActiveRole('STAFF')
    state.moveServiceCase('CASE-001', 'ACCEPTED')
    state.moveServiceCase('CASE-001', 'IN_PROGRESS')
    state.moveServiceCase('CASE-001', 'COMPLETED')
    state.setActiveRole('ELDER')
    state.submitElderMessage('我刚刚摔倒了')
    state.submitElderMessage('我想预约按摩服务')
    state.simulateSensorEvent('E001', 'FALL')
    state.selectFamilyElder('E001')
    state.setActiveRole('FAMILY')
    const contact = state.createFamilyNaturalRequest({
      elderId: 'E001', requesterId: 'F001', relationId: 'REL-001',
      kind: 'CONTACT_CHECK', description: '上午联系未果，请确认老人情况',
    })!
    state.createFamilyNaturalRequest({
      elderId: 'E001', requesterId: 'F001', relationId: 'REL-001',
      kind: 'OTHER', description: '希望安排特别探望',
    })
    state.setActiveRole('STAFF')
    state.moveServiceCase(contact, 'ACCEPTED')
    state.moveServiceCase(contact, 'IN_PROGRESS')
    state.completeFamilyRequest(contact, '已确认老人安全')
    state.setActiveRole('FAMILY')
    useDemoUiStore.getState().setExperienceMode('PHASE4')
    localStorage.setItem(OPENHEX_CONVERSATION_STORAGE_KEY, 'old-conversation-id')
    recordOpenhexDiagnostic({ phase: 'conversation', outcome: 'success', conversationSuffix: 'old-id' })

    const tokenRequest = vi.fn().mockImplementation(async () => Response.json({
      token: 'old-token',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }))
    await getOpenhexToken(tokenRequest)
    expect(Object.values(useDemoStore.getState().cases).map((careCase) => careCase.caseType)).toEqual([
      'SERVICE', 'SAFETY', 'EVALUATION', 'SAFETY', 'FAMILY_REQUEST', 'EVALUATION',
    ])

    const onReset = vi.fn()
    window.addEventListener(DEMO_RESET_EVENT, onReset)
    const request = vi.fn().mockResolvedValue(Response.json({ reset: true }))
    const result = await resetEntireDemo(request)
    window.removeEventListener(DEMO_RESET_EVENT, onReset)

    expect(result.visitorIdentityCleared).toBe(true)
    expect(request).toHaveBeenCalledWith('/api/openhex/demo-reset', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', signal: expect.any(AbortSignal),
    }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(useDemoStore.getState().cases).toEqual({})
    expect(useDemoStore.getState().sensorSnapshots.E001).toMatchObject({ heartRate: 72, spo2: 98, fallDetected: false })
    expect(useDemoStore.getState().conversationState.elder.messages).toEqual([])
    expect(useDemoStore.getState().conversationState.family.messages).toEqual([])
    expect(useDemoStore.getState().activeRole).toBe('ELDER')
    expect(useDemoStore.getState().selectedFamilyElderId).toBeNull()
    expect(useDemoUiStore.getState().experienceMode).toBe(defaultExperienceMode())
    expect(localStorage.getItem(OPENHEX_CONVERSATION_STORAGE_KEY)).toBeNull()
    expect(getOpenhexDiagnostics()).toEqual([])
    expect(createDemoStore().getState().cases).toEqual({})
    expect(createDemoStore().getState().sensorSnapshots.E001.fallDetected).toBe(false)
    expect(createDemoStore().getState().conversationState.elder.messages).toEqual([])

    await getOpenhexToken(tokenRequest)
    expect(tokenRequest).toHaveBeenCalledTimes(2)
  })

  it('still forgets the local conversation when the visitor reset endpoint is unavailable', async () => {
    localStorage.setItem(OPENHEX_CONVERSATION_STORAGE_KEY, 'old-conversation-id')
    useDemoStore.getState().submitElderMessage('我刚刚摔倒了')

    const result = await resetEntireDemo(vi.fn().mockRejectedValue(new Error('offline')))

    expect(result.visitorIdentityCleared).toBe(false)
    expect(localStorage.getItem(OPENHEX_CONVERSATION_STORAGE_KEY)).toBeNull()
    expect(createDemoStore().getState().cases).toEqual({})
  })

  it('does not mistake a static HTML fallback for a successful visitor reset', async () => {
    localStorage.setItem(OPENHEX_CONVERSATION_STORAGE_KEY, 'old-conversation-id')

    const result = await resetEntireDemo(vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })))

    expect(result.visitorIdentityCleared).toBe(false)
    expect(localStorage.getItem(OPENHEX_CONVERSATION_STORAGE_KEY)).toBeNull()
  })
})
