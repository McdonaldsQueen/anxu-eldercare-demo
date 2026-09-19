import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoStore, selectActiveCases, selectCompletedCases } from './demoStore'
import type { CareCaseStatus } from '../domain/models'

const familyInput = (kind: 'CONTACT_CHECK' | 'ITEM_HANDOVER' | 'OTHER', description: string) => ({
  elderId: 'E001', requesterId: 'F001', relationId: 'REL-001', kind, description,
})

describe('end-to-end shared Case acceptance', () => {
  beforeEach(() => localStorage.clear())

  it('deduplicates an elder escort, enforces staff transitions, and restores each status', () => {
    const key = 'accept-escort'
    const store = createDemoStore(key)
    store.getState().submitElderMessage('  ')
    expect(store.getState().cases).toEqual({})
    store.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    store.getState().submitElderMessage('朝阳医院，两点半')
    const id = 'CASE-001'
    expect(store.getState().cases[id]).toMatchObject({
      caseSource: 'ELDER_INPUT', requesterId: 'E001', subjectElderId: 'E001',
      status: 'WAITING', agentSummary: expect.stringContaining('陪诊'),
    })
    store.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    store.getState().submitElderMessage('朝阳医院，两点半')
    expect(Object.keys(store.getState().cases)).toEqual([id])
    expect(store.getState().moveServiceCase(id, 'ACCEPTED')).toBe(false)
    store.getState().setActiveRole('STAFF')
    const statuses = ['WAITING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const
    for (const [index, status] of statuses.entries()) {
      expect(createDemoStore(key).getState().cases[id].status).toBe(status)
      expect(Object.keys(createDemoStore(key).getState().cases)).toEqual([id])
      if (status !== 'COMPLETED') expect(store.getState().moveServiceCase(id, statuses[index + 1] as CareCaseStatus)).toBe(true)
    }
    expect(store.getState().moveServiceCase(id, 'COMPLETED')).toBe(false)
    expect(selectActiveCases(store.getState())).toEqual([])
    expect(selectCompletedCases(store.getState()).map((careCase) => careCase.caseId)).toEqual([id])
  })

  it('keeps a family contact requester separate and returns the staff result', () => {
    const key = 'accept-contact'
    const store = createDemoStore(key)
    const input = familyInput('CONTACT_CHECK', '上午多次联系妈妈未果，希望确认她是否安全')
    expect(store.getState().createFamilyNaturalRequest({ ...input, description: ' ' })).toBeNull()
    const id = store.getState().createFamilyNaturalRequest(input)!
    expect(store.getState().createFamilyNaturalRequest(input)).toBe(id)
    expect(store.getState().cases[id]).toMatchObject({
      caseSource: 'FAMILY_REQUEST', requesterId: 'F001', subjectElderId: 'E001',
      caseType: 'FAMILY_REQUEST', priority: 'P0', staffActionSummary: expect.stringContaining('确认老人'),
      agentSummary: expect.stringContaining('李晓雯'),
    })
    store.getState().setActiveRole('STAFF')
    expect(store.getState().moveServiceCase(id, 'ACCEPTED')).toBe(true)
    expect(store.getState().moveServiceCase(id, 'ACCEPTED')).toBe(false)
    expect(store.getState().moveServiceCase(id, 'IN_PROGRESS')).toBe(true)
    expect(createDemoStore(key).getState().cases[id].status).toBe('IN_PROGRESS')
    expect(store.getState().completeFamilyRequest(id, '  ')).toBe(false)
    expect(store.getState().completeFamilyRequest(id, '已现场确认老人平安')).toBe(true)
    expect(store.getState().completeFamilyRequest(id, '重复')).toBe(false)
    expect(createDemoStore(key).getState().cases[id]).toMatchObject({
      status: 'COMPLETED', resolutionResult: '已现场确认老人平安',
    })
  })

  it('routes ordinary items to fulfillment and special items to a reasoned human decision', () => {
    const store = createDemoStore('accept-items')
    const ordinary = store.getState().createFamilyNaturalRequest(familyInput('ITEM_HANDOVER', '给妈妈送一件外套'))!
    const medication = store.getState().createFamilyNaturalRequest(familyInput('ITEM_HANDOVER', '给妈妈送一盒药品'))!
    const fragile = store.getState().createFamilyNaturalRequest(familyInput('ITEM_HANDOVER', '给妈妈转交一个玻璃杯'))!
    const large = store.getState().createFamilyNaturalRequest(familyInput('ITEM_HANDOVER', '给妈妈送一件大型家具'))!
    const unclear = store.getState().createFamilyNaturalRequest(familyInput('ITEM_HANDOVER', '想给妈妈送一些东西，不确定是什么'))!
    expect(store.getState().cases[ordinary].caseType).toBe('FAMILY_REQUEST')
    for (const id of [medication, fragile, large, unclear]) {
      expect(store.getState().cases[id]).toMatchObject({ caseType: 'EVALUATION', status: 'WAITING', caseSource: 'FAMILY_REQUEST' })
    }
    store.getState().setActiveRole('STAFF')
    expect(store.getState().decideEvaluationCase(medication, false, ' ')).toBe(false)
    expect(store.getState().decideEvaluationCase(medication, false, '需由家属与工作人员确认药品交接条件')).toBe(true)
    expect(createDemoStore('accept-items').getState().cases[medication].evaluationReason).toContain('药品交接')
    expect(store.getState().decideEvaluationCase(fragile, true)).toBe(true)
    expect(store.getState().cases[fragile]).toMatchObject({ caseType: 'SERVICE', status: 'WAITING' })
    expect(store.getState().moveServiceCase(ordinary, 'ACCEPTED')).toBe(true)
    expect(store.getState().moveServiceCase(ordinary, 'IN_PROGRESS')).toBe(true)
    expect(store.getState().completeFamilyRequest(ordinary, '已完成外套交接')).toBe(true)
  })

  it('keeps sensor alerts independent of elder speech and deduplicates consecutive triggers', () => {
    const key = 'accept-sensor'
    const store = createDemoStore(key)
    expect(store.getState().simulateSensorEvent('E001', 'NORMAL')).toBeNull()
    expect(store.getState().cases).toEqual({})
    const id = store.getState().simulateSensorEvent('E001', 'HIGH_HEART_RATE')!
    expect(store.getState().simulateSensorEvent('E001', 'HIGH_HEART_RATE')).toBe(id)
    expect(store.getState().simulateSensorEvent('E001', 'FALL')).toBe(id)
    expect(store.getState().simulateSensorEvent('E001', 'LOW_SPO2')).toBe(id)
    expect(store.getState().simulateSensorEvent('E001', 'FALL')).toBe(id)
    expect(Object.keys(store.getState().cases)).toEqual([id])
    expect(store.getState().cases[id]).toMatchObject({
      caseSource: 'WEARABLE_SENSOR', requesterId: 'DEVICE-ANXU-E001', requesterRole: undefined,
      subjectElderId: 'E001', caseType: 'SAFETY', priority: 'P0', status: 'WAITING_FOR_REVIEW',
      suggestedRiskType: 'FALL',
    })
    expect(store.getState().conversationState.elder.messages).toEqual([])
    expect(createDemoStore(key).getState().cases[id].riskSignals).toHaveLength(3)
    store.getState().submitElderMessage('我摔倒了，起不来')
    expect(Object.values(store.getState().cases).filter((careCase) => careCase.caseSource === 'ELDER_INPUT')).toHaveLength(1)
    expect(store.getState().cases[id].additionalInformation).toHaveLength(1)
    expect(store.getState().reviewSafetyCase(id, { finalPriority: 'P0', finalRiskType: 'FALL', immediateIntervention: false })).toBe(false)
    store.getState().setActiveRole('STAFF')
    expect(store.getState().reviewSafetyCase(id, { finalPriority: 'P0', finalRiskType: 'FALL', immediateIntervention: false })).toBe(true)
    expect(createDemoStore(key).getState().cases[id].status).toBe('CONFIRMED')
    expect(store.getState().reviewSafetyCase(id, { finalPriority: 'P0', finalRiskType: 'FALL', immediateIntervention: false })).toBe(false)
    const laterTemperature = store.getState().simulateSensorEvent('E001', 'HIGH_TEMPERATURE')!
    expect(laterTemperature).not.toBe(id)
    expect(store.getState().cases[laterTemperature].status).toBe('WAITING_FOR_REVIEW')
    expect(store.getState().simulateSensorEvent('E001', 'HIGH_TEMPERATURE')).toBe(laterTemperature)
    expect(store.getState().moveSafetyCase(id, 'IN_PROGRESS')).toBe(true)
    expect(createDemoStore(key).getState().cases[id].status).toBe('IN_PROGRESS')
    expect(store.getState().moveSafetyCase(id, 'COMPLETED')).toBe(true)
    expect(store.getState().moveSafetyCase(id, 'COMPLETED')).toBe(false)
    expect(selectActiveCases(store.getState()).find((careCase) => careCase.caseId === id)).toBeUndefined()
  })
})
