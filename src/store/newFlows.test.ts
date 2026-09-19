import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoStore } from './demoStore'

describe('family, wearable and staff flows', () => {
  beforeEach(() => localStorage.clear())

  it('keeps requester distinct, requires a decline reason, and persists the family decision', () => {
    const store = createDemoStore('test-family-natural')
    const input = { elderId: 'E001', requesterId: 'F001', relationId: 'REL-001', kind: 'OTHER' as const, description: '希望安排特殊探望' }
    expect(store.getState().createFamilyNaturalRequest({ ...input, requesterId: 'E001' })).toBeNull()
    const id = store.getState().createFamilyNaturalRequest(input)!
    expect(store.getState().createFamilyNaturalRequest(input)).toBe(id)
    expect(Object.keys(store.getState().cases)).toHaveLength(1)
    expect(store.getState().cases[id]).toMatchObject({ requesterId: 'F001', subjectElderId: 'E001', caseSource: 'FAMILY_REQUEST' })
    store.getState().setActiveRole('STAFF')
    expect(store.getState().decideEvaluationCase(id, false, '')).toBe(false)
    expect(store.getState().decideEvaluationCase(id, false, '暂无法安排')).toBe(true)
    expect(store.getState().cases[id]).toMatchObject({ status: 'DECLINED', evaluationReason: '暂无法安排' })
  })

  it('creates one independent P0 Safety Case per active sensor event and follows the existing transitions', () => {
    const store = createDemoStore('test-sensor-natural')
    const first = store.getState().simulateSensorEvent('E001', 'FALL')!
    expect(store.getState().simulateSensorEvent('E001', 'FALL')).toBe(first)
    expect(Object.keys(store.getState().cases)).toHaveLength(1)
    expect(store.getState().cases[first]).toMatchObject({ caseSource: 'WEARABLE_SENSOR', requesterId: 'DEVICE-ANXU-E001', priority: 'P0', status: 'WAITING_FOR_REVIEW' })
    expect(store.getState().conversationState.elder.messages).toHaveLength(0)
    store.getState().setActiveRole('STAFF')
    expect(store.getState().reviewSafetyCase(first, { finalPriority: 'P0', finalRiskType: 'FALL', immediateIntervention: false })).toBe(true)
    expect(store.getState().moveSafetyCase(first, 'IN_PROGRESS')).toBe(true)
    expect(store.getState().moveSafetyCase(first, 'COMPLETED')).toBe(true)
    expect(store.getState().simulateSensorEvent('E001', 'FALL')).not.toBe(first)
    store.getState().resetDemo()
    expect(store.getState().sensorSnapshots.E001.fallDetected).toBe(false)
    expect(Object.keys(store.getState().cases)).toHaveLength(0)
  })
})
