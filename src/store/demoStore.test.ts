import { beforeEach, describe, expect, it } from 'vitest'
import type { CareCase } from '../domain/models'
import {
  createDemoStore,
  createInitialState,
  createNextSafetyCaseId,
  selectActiveCases,
  selectWorkload,
} from './demoStore'

const testCase: CareCase = {
  caseId: 'CASE-TEST',
  caseSource: 'ELDER_INPUT',
  subjectElderId: 'E001',
  requesterId: 'E001',
  caseType: 'MOBILITY',
  serviceType: 'MEDICAL_ESCORT',
  eventType: null,
  detectedRiskEvents: [],
  latestRiskEventType: null,
  riskLevel: 'NORMAL',
  priority: 'P2',
  status: 'WAITING',
  hospital: '朝阳医院',
  appointmentTime: '明日 14:30',
  assignedStaff: null,
  arrivalTime: null,
  selfHandling: null,
  reportedSymptoms: [],
  additionalInformation: [],
  reviewConfirmedAt: null,
  interventionStartedAt: null,
  createdAt: '2099-01-01T10:22:00+08:00',
  updatedAt: '2099-01-01T10:22:00+08:00',
  timeline: [],
}

describe('Shared Case Store and conversation context', () => {
  beforeEach(() => localStorage.clear())

  it('persists the unified context, cases, and role across a simulated refresh', () => {
    const firstSession = createDemoStore('refresh-test')
    firstSession.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    firstSession.getState().setActiveRole('FAMILY')

    const refreshed = createDemoStore('refresh-test')
    expect(refreshed.getState().activeRole).toBe('FAMILY')
    expect(refreshed.getState().conversationState.elder).toMatchObject({
      currentIntent: 'SERVICE_REQUEST',
      currentSubject: 'E001',
      conversationMode: 'COLLECTING_SERVICE',
      missingInformation: ['HOSPITAL', 'APPOINTMENT_TIME'],
    })
    expect(refreshed.getState().conversationState.elder.messages).toHaveLength(2)
  })

  it('resets every persisted domain field to the deterministic initial state', () => {
    const store = createDemoStore('reset-test')
    store.getState().saveCase(testCase)
    store.getState().setActiveRole('STAFF')
    store.getState().resetDemo()
    const expected = createInitialState()
    expected.sensorSnapshots.E001.updatedAt = store.getState().sensorSnapshots.E001.updatedAt
    expect(store.getState()).toMatchObject(expected)
  })

  it('derives workload numbers entirely from shared cases', () => {
    const store = createDemoStore('workload-test')
    expect(selectWorkload(store.getState())).toEqual({ pending: 0, inProgress: 0, highRisk: 0 })
    store.getState().saveCase(testCase)
    expect(selectWorkload(store.getState())).toEqual({ pending: 1, inProgress: 0, highRisk: 0 })
  })

  it('imports an external order idempotently and keeps staff transitions in the shared Case', () => {
    const store = createDemoStore('openhex-order-test')
    const input = {
      caseId: 'CASE-20260919-002', caseType: 'SERVICE' as const, title: '陪诊 / 就医协助', requestSummary: '老人需要陪诊',
      serviceType: 'MEDICAL_ESCORT' as const, hospital: '朝阳医院', appointmentTime: '明日 14:30',
    }
    expect(store.getState().importOpenhexCase(input)).toBe(true)
    expect(store.getState().importOpenhexCase(input)).toBe(false)
    expect(selectActiveCases(store.getState()).map((careCase) => careCase.caseId)).toEqual([input.caseId])
    expect(store.getState().cases[input.caseId]).toMatchObject({ caseSource: 'OPENHEX', status: 'WAITING' })
    store.getState().setActiveRole('STAFF')
    expect(store.getState().moveServiceCase(input.caseId, 'ACCEPTED')).toBe(true)
    expect(createDemoStore('openhex-order-test').getState().cases[input.caseId].status).toBe('ACCEPTED')
  })

  it('upgrades an underspecified external order when Agent history provides service details', () => {
    const store = createDemoStore('openhex-enrichment-test')
    const fallback = {
      caseId: 'CASE-20260919-003', caseType: 'EVALUATION' as const,
      title: '待评估需求', requestSummary: '已创建工单 CASE-20260919-003。',
      serviceType: null, hospital: null, appointmentTime: null,
    }
    expect(store.getState().importOpenhexCase(fallback)).toBe(true)
    expect(store.getState().importOpenhexCase({
      ...fallback, caseType: 'SERVICE', title: '陪诊 / 就医协助', serviceType: 'MEDICAL_ESCORT',
      requestSummary: '老人需要陪诊', hospital: '朝阳医院', appointmentTime: '明日 14:30',
    })).toBe(true)
    expect(Object.keys(store.getState().cases)).toEqual([fallback.caseId])
    expect(store.getState().cases[fallback.caseId]).toMatchObject({
      caseType: 'SERVICE', serviceType: 'MEDICAL_ESCORT', requestSummary: '老人需要陪诊',
      hospital: '朝阳医院', appointmentTime: '明日 14:30', evaluationDecision: null,
    })
  })

  it('fills fields over two turns and creates the original escort Golden Path', () => {
    const store = createDemoStore('escort-context-test')
    store.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    expect(store.getState().cases).toEqual({})
    expect(store.getState().conversationState.elder.collectedInformation.serviceRequest).toMatchObject({
      date: '明日', hospital: null, appointmentTime: null, timePeriod: 'AFTERNOON',
    })

    store.getState().submitElderMessage('朝阳医院，两点半')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      status: 'WAITING', hospital: '朝阳医院', appointmentTime: '明日 14:30',
    })
    expect(store.getState().conversationState.elder.activeCaseId).toBe('CASE-001')
  })

  it('applies a correction before and after Case creation to the same Case', () => {
    const store = createDemoStore('escort-correction-test')
    store.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    store.getState().submitElderMessage('不是明天，是后天，朝阳医院，两点半')
    expect(store.getState().cases['CASE-001'].appointmentTime).toBe('后日 14:30')

    store.getState().submitElderMessage('不是后天，是明天')
    expect(store.getState().cases['CASE-001'].appointmentTime).toBe('明日 14:30')
    expect(store.getState().cases['CASE-001'].agentSummary).toContain('明日 14:30')
    expect(store.getState().cases['CASE-001'].requestSummary).toContain('明日 14:30')
    expect(Object.keys(store.getState().cases)).toEqual(['CASE-001'])
    expect(store.getState().cases['CASE-001'].timeline.at(-1)?.label).toContain('老人更新陪诊信息')
  })

  it('keeps later conversation attached to the active escort Case', () => {
    const store = createDemoStore('escort-active-context-test')
    store.getState().submitElderMessage('我明天下午要去医院，但是没人陪我')
    store.getState().submitElderMessage('朝阳医院，两点半')
    store.getState().submitElderMessage('这件事安排到哪里了')
    expect(store.getState().conversationState.elder.activeCaseId).toBe('CASE-001')
    expect(store.getState().conversationState.elder.messages.at(-1)?.text).toContain('陪诊安排还在处理中')
    expect(Object.keys(store.getState().cases)).toEqual(['CASE-001'])
  })

  it('creates the correct P0 event type rather than mapping every risk to FALL', () => {
    const store = createDemoStore('risk-type-test')
    store.getState().submitElderMessage('我现在喘不上气')
    expect(store.getState().cases['CASE-002']).toMatchObject({
      eventType: 'BREATHING_DIFFICULTY',
      latestRiskEventType: 'BREATHING_DIFFICULTY',
      detectedRiskEvents: ['BREATHING_DIFFICULTY'],
      priority: 'P0',
      status: 'WAITING_FOR_REVIEW',
    })
  })

  it('keeps P0 open and asks for free description after “暂时没有这些情况”', () => {
    const store = createDemoStore('risk-none-test')
    store.getState().submitElderMessage('我刚刚摔了一跤，现在起不来了')
    expect(store.getState().recordRiskFollowUp('NONE_REPORTED')).toBe(true)
    expect(store.getState().cases['CASE-002']).toMatchObject({
      status: 'WAITING_FOR_REVIEW', priority: 'P0', riskLevel: 'CRITICAL',
      reportedSymptoms: ['NONE_REPORTED'],
    })
    expect(store.getState().conversationState.elder).toMatchObject({
      conversationMode: 'OPEN_RISK_DESCRIPTION',
      lastAgentQuestion: '好的。还有没有其他不舒服，或者刚才发生了什么？您可以直接跟我说。',
    })
    expect(store.getState().conversationState.elder.messages.at(-1)?.text).toBe(
      '好的。还有没有其他不舒服，或者刚才发生了什么？您可以直接跟我说。',
    )
  })

  it('writes free description and reclassified signals into the same active Safety Case', () => {
    const store = createDemoStore('risk-supplement-test')
    store.getState().submitElderMessage('我刚刚摔了一跤，现在起不来了')
    store.getState().recordRiskFollowUp('NONE_REPORTED')
    store.getState().submitElderMessage('我现在又觉得喘不上气')

    expect(Object.keys(store.getState().cases)).toEqual(['CASE-002'])
    expect(store.getState().cases['CASE-002']).toMatchObject({
      eventType: 'FALL',
      latestRiskEventType: 'BREATHING_DIFFICULTY',
      detectedRiskEvents: ['FALL', 'BREATHING_DIFFICULTY'],
      status: 'WAITING_FOR_REVIEW',
      priority: 'P0',
    })
    expect(store.getState().cases['CASE-002'].additionalInformation).toContain('我现在又觉得喘不上气')
  })

  it('does not create a duplicate while the same Safety Case is active', () => {
    const store = createDemoStore('active-risk-idempotency-test')
    const phrase = '我刚刚摔了一跤，现在起不来了'
    store.getState().submitElderMessage(phrase)
    store.getState().submitElderMessage(phrase)
    expect(Object.keys(store.getState().cases)).toEqual(['CASE-002'])
    expect(store.getState().cases['CASE-002'].additionalInformation).toEqual([phrase])
  })

  it('allows a new unique Safety Case after the previous one is completed', () => {
    const store = createDemoStore('repeated-risk-test')
    store.getState().submitElderMessage('我刚刚摔了一跤，现在起不来了')
    store.getState().setActiveRole('STAFF')
    expect(store.getState().confirmAndInterveneSafetyCase('CASE-002')).toBe(true)
    expect(store.getState().moveSafetyCase('CASE-002', 'COMPLETED')).toBe(true)
    store.getState().setActiveRole('ELDER')
    store.getState().submitElderMessage('我现在喘不上气')

    expect(Object.keys(store.getState().cases).sort()).toEqual(['CASE-002', 'CASE-003'])
    expect(store.getState().cases['CASE-002'].status).toBe('COMPLETED')
    expect(store.getState().cases['CASE-003']).toMatchObject({
      caseId: 'CASE-003', eventType: 'BREATHING_DIFFICULTY', status: 'WAITING_FOR_REVIEW',
    })
  })

  it('generates dynamic unique Case IDs from existing data', () => {
    expect(createNextSafetyCaseId({})).toBe('CASE-002')
    expect(createNextSafetyCaseId({ 'CASE-009': { ...testCase, caseId: 'CASE-009' } })).toBe('CASE-010')
  })

  it('preserves the human-only ordered P0 state machine and P0 sorting', () => {
    const store = createDemoStore('risk-state-machine-test')
    store.getState().saveCase(testCase)
    store.getState().submitElderMessage('我刚刚摔了一跤，现在起不来了')
    expect(store.getState().moveSafetyCase('CASE-002', 'CONFIRMED')).toBe(false)
    expect(selectActiveCases(store.getState()).map((careCase) => careCase.caseId)).toEqual(['CASE-002', 'CASE-TEST'])

    store.getState().setActiveRole('STAFF')
    expect(store.getState().confirmAndInterveneSafetyCase('CASE-002')).toBe(true)
    expect(store.getState().cases['CASE-002'].timeline.slice(-2).map((event) => event.label)).toEqual([
      '人工确认风险', '工作人员已介入处理',
    ])
    expect(store.getState().moveSafetyCase('CASE-002', 'COMPLETED')).toBe(true)
  })
})
