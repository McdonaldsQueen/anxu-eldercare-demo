import { beforeEach, describe, expect, it } from 'vitest'
import { decideElderInput } from '../domain/mockDecisionEngine'
import { createInitialConversationState } from '../data/mockData'
import { createDemoStore, selectActiveCases } from './demoStore'

describe('Phase 4 business convergence', () => {
  beforeEach(() => localStorage.clear())

  it('creates every detected Safety Case in WAITING_FOR_REVIEW', () => {
    const store = createDemoStore('p4-safety-waiting')
    store.getState().submitElderMessage('我胸口闷，喘不上气')
    expect(store.getState().cases['CASE-002']).toMatchObject({
      caseType: 'SAFETY',
      status: 'WAITING_FOR_REVIEW',
      suggestedRiskType: 'BREATHING_DIFFICULTY',
      suggestedRiskLevel: 'P0',
      finalPriority: null,
      safetyReviewOutcome: 'PENDING',
    })
  })

  it('keeps AI P0 as a suggestion until staff confirms a final priority', () => {
    const store = createDemoStore('p4-safety-boundary')
    store.getState().submitElderMessage('我摔倒了')
    const candidate = store.getState().cases['CASE-002']
    expect(candidate.suggestedRiskLevel).toBe('P0')
    expect(candidate.finalPriority).toBeNull()
    expect(candidate.status).toBe('WAITING_FOR_REVIEW')
  })

  it('allows staff to lower or raise final priority and records the edit in Timeline', () => {
    const store = createDemoStore('p4-human-review')
    store.getState().submitElderMessage('我摔倒了')
    store.getState().setActiveRole('STAFF')
    expect(store.getState().reviewSafetyCase('CASE-002', {
      finalPriority: 'P2',
      finalRiskType: 'OTHER_RISK',
      immediateIntervention: false,
    })).toBe(true)
    const reviewed = store.getState().cases['CASE-002']
    expect(reviewed).toMatchObject({
      finalPriority: 'P2',
      finalRiskType: 'OTHER_RISK',
      status: 'CONFIRMED',
      safetyReviewOutcome: 'CONFIRMED',
    })
    expect(reviewed.timeline.some((event) => event.label.includes('已修改 AI 建议'))).toBe(true)
  })

  it('supports an explicit false-positive decision only through staff review', () => {
    const store = createDemoStore('p4-false-positive')
    store.getState().submitElderMessage('我摔倒了')
    expect(store.getState().reviewSafetyCase('CASE-002', {
      finalPriority: 'P2', finalRiskType: 'OTHER_RISK', immediateIntervention: false, falsePositive: true,
    })).toBe(false)
    store.getState().setActiveRole('STAFF')
    expect(store.getState().reviewSafetyCase('CASE-002', {
      finalPriority: 'P2', finalRiskType: 'OTHER_RISK', immediateIntervention: false, falsePositive: true,
    })).toBe(true)
    expect(store.getState().cases['CASE-002'].safetyReviewOutcome).toBe('FALSE_POSITIVE')
  })

  it('creates a new escort context while an active Safety Case remains open', () => {
    const store = createDemoStore('p4-parallel-case')
    store.getState().submitElderMessage('我刚才摔了一跤')
    store.getState().submitElderMessage('我明天下午还要去医院')
    expect(store.getState().cases['CASE-002'].status).toBe('WAITING_FOR_REVIEW')
    expect(store.getState().conversationState.elder).toMatchObject({
      currentIntent: 'SERVICE_REQUEST',
      conversationMode: 'COLLECTING_SERVICE',
    })
    store.getState().submitElderMessage('朝阳医院，两点半')
    expect(Object.values(store.getState().cases).map((careCase) => careCase.caseType).sort()).toEqual(['SAFETY', 'SERVICE'])
  })

  it('does not let old risk context contaminate a later walking request', () => {
    const store = createDemoStore('p4-risk-reset')
    store.getState().submitElderMessage('我突然头晕得厉害')
    store.getState().submitElderMessage('我下午想下楼走走，能不能找个人陪我')
    expect(store.getState().conversationState.elder.currentIntent).toBe('SERVICE_REQUEST')
    expect(Object.values(store.getState().cases).filter((careCase) => careCase.caseType === 'SAFETY')).toHaveLength(1)
    expect(Object.values(store.getState().cases).some((careCase) => careCase.serviceType === 'ACCOMPANIED_TRAVEL')).toBe(true)
  })

  it('does not treat wheelchair pushing language as a risk signal', () => {
    const decision = decideElderInput(
      '我想去活动中心，需要有人推我过去',
      createInitialConversationState().elder,
      {},
    )
    expect(decision).toMatchObject({
      intent: 'SERVICE_REQUEST',
      risk: 'NORMAL',
      action: 'CLARIFY',
    })
    expect(decision.riskEventType).toBeNull()
  })

  it('creates daily living, item handover, and configured booking SERVICE cases', () => {
    const inputs = [
      ['我想洗澡，需要人帮一下', 'DAILY_LIVING_ASSISTANCE'],
      ['我的东西到了，能不能帮我送过来', 'ITEM_HANDOVER'],
      ['我想预约理发', 'CENTER_SERVICE_BOOKING'],
    ] as const
    for (const [index, [input, serviceType]] of inputs.entries()) {
      const store = createDemoStore(`p4-service-${index}`)
      store.getState().submitElderMessage(input)
      expect(Object.values(store.getState().cases)[0]).toMatchObject({ caseType: 'SERVICE', serviceType })
    }
  })

  it('recognizes an out-of-reach item as daily help without requiring a help keyword', () => {
    const store = createDemoStore('p4-daily-minimum')
    store.getState().submitElderMessage('房间有东西够不到')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'SERVICE',
      serviceType: 'DAILY_LIVING_ASSISTANCE',
    })
  })

  it('creates FAMILY_REQUEST when family cannot contact the bound elder', () => {
    const store = createDemoStore('p4-family-contact')
    store.getState().submitFamilyMessage('我今天一直联系不上我妈')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      serviceType: 'CONTACT_CHECK',
      subjectElderId: 'E001',
    })
  })

  it('uses Safety Override for contact failure plus an explicit risk signal', () => {
    const store = createDemoStore('p4-family-risk')
    store.getState().submitFamilyMessage('我爸一直联系不上，而且他今天早上说自己头晕')
    expect(store.getState().cases['CASE-002']).toMatchObject({
      caseType: 'SAFETY',
      status: 'WAITING_FOR_REVIEW',
      requesterRole: 'FAMILY',
    })
  })

  it('creates a FAMILY_REQUEST for a complete family item handover', () => {
    const store = createDemoStore('p4-family-item')
    store.getState().submitFamilyMessage('我给妈妈买了衣服，已经送到养老中心，麻烦送给她')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      serviceType: 'FAMILY_ITEM_HANDOVER',
      itemType: 'GENERAL',
      itemName: '衣服',
      itemArrivalStatus: 'ARRIVED',
    })
  })

  it('keeps ordinary delivery instructions on FAMILY_REQUEST instead of treating them as medication service', () => {
    const store = createDemoStore('p4-family-delivery-instruction')
    store.getState().submitFamilyMessage('我给妈妈买了衣服，已经送到养老中心，请放在床头')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      specialInstruction: '请放在床头',
    })
  })

  it('stores only family-provided medicine dosage text and never invents a dosage', () => {
    const store = createDemoStore('p4-medicine-no-dose')
    store.getState().submitFamilyMessage('我给妈妈送了降压药，已经送到养老中心')
    const careCase = store.getState().cases['CASE-001']
    expect(careCase).toMatchObject({ itemType: 'MEDICINE', itemName: '降压药' })
    expect(careCase.providedDosageInstructions).toBeNull()
  })

  it('records supplied medicine instructions verbatim', () => {
    const store = createDemoStore('p4-medicine-dose')
    store.getState().submitFamilyMessage('我给妈妈送了降压药，已经送到养老中心，每天一次')
    expect(store.getState().cases['CASE-001'].providedDosageInstructions).toBe('每天一次')
  })

  it('routes special medication assistance to Evaluation while preserving specialInstruction', () => {
    const store = createDemoStore('p4-medicine-eval')
    store.getState().submitFamilyMessage('我给妈妈送了降压药，已经送到养老中心，每天晚上提醒妈妈吃药')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'EVALUATION',
      itemType: 'MEDICINE',
      specialInstruction: '提醒妈妈吃药',
      evaluationDecision: 'PENDING',
    })
  })

  it('creates an EVALUATION Case for an undefined service without auto-declining it', () => {
    const store = createDemoStore('p4-evaluation')
    store.getState().submitElderMessage('我想预约按摩服务')
    expect(store.getState().cases['CASE-001']).toMatchObject({
      caseType: 'EVALUATION',
      status: 'WAITING',
      evaluationDecision: 'PENDING',
    })
    expect(store.getState().cases['CASE-001'].evaluationReason).toBeUndefined()
  })

  it('requires staff and a reason to decline an Evaluation Case', () => {
    const store = createDemoStore('p4-evaluation-decline')
    store.getState().submitElderMessage('我想预约按摩服务')
    expect(store.getState().decideEvaluationCase('CASE-001', false, '当前没有对应服务')).toBe(false)
    store.getState().setActiveRole('STAFF')
    expect(store.getState().decideEvaluationCase('CASE-001', false)).toBe(false)
    expect(store.getState().decideEvaluationCase('CASE-001', false, '当前没有对应服务')).toBe(true)
    expect(store.getState().cases['CASE-001']).toMatchObject({
      status: 'DECLINED',
      evaluationDecision: 'DECLINED',
      evaluationReason: '当前没有对应服务',
    })
  })

  it('orders the shared staff queue by review safety, confirmed safety, service, family, evaluation', () => {
    const store = createDemoStore('p4-sort')
    store.getState().submitElderMessage('我想预约按摩服务')
    store.getState().submitFamilyMessage('我今天一直联系不上我妈')
    store.getState().submitElderMessage('我想洗澡，需要人帮一下')
    store.getState().submitElderMessage('我摔倒了')
    const orderedTypes = selectActiveCases(store.getState()).map((careCase) => careCase.caseType)
    expect(orderedTypes).toEqual(['SAFETY', 'SERVICE', 'FAMILY_REQUEST', 'EVALUATION'])
  })

  it('syncs one shared family request through staff completion to the family view state', () => {
    const store = createDemoStore('p4-shared-sync')
    store.getState().submitFamilyMessage('我今天一直联系不上我妈')
    store.getState().setActiveRole('STAFF')
    expect(store.getState().moveServiceCase('CASE-001', 'ACCEPTED')).toBe(true)
    expect(store.getState().moveServiceCase('CASE-001', 'IN_PROGRESS')).toBe(true)
    expect(store.getState().moveServiceCase('CASE-001', 'COMPLETED')).toBe(true)
    expect(store.getState().cases['CASE-001'].status).toBe('COMPLETED')
    expect(store.getState().cases['CASE-001'].timeline.at(-1)?.label).toContain('同步结果')
  })
})
