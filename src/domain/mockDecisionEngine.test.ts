import { describe, expect, it } from 'vitest'
import { createInitialConversationState } from '../data/mockData'
import { classifyRiskEvent, decideElderInput } from './mockDecisionEngine'
import { RISK_CATALOG } from './riskCatalog'

describe('Conversation Decision Engine', () => {
  it('uses conversation context to complete hospital and time on the next turn', () => {
    const initial = createInitialConversationState().elder
    const first = decideElderInput(
      '我明天下午要去医院，但是没人陪我',
      initial,
      {},
    )

    expect(first.action).toBe('CLARIFY')
    expect(first.nextContext).toMatchObject({
      currentIntent: 'SERVICE_REQUEST',
      currentSubject: 'E001',
      conversationMode: 'COLLECTING_SERVICE',
      lastAgentQuestion: '可以，我帮您安排。您去哪家医院？大概几点的号？',
      missingInformation: ['HOSPITAL', 'APPOINTMENT_TIME'],
    })

    const session = { ...first.nextContext, messages: initial.messages }
    const second = decideElderInput('朝阳医院，两点半', session, {})
    expect(second.action).toBe('CREATE_CASE')
    expect(second.draft).toMatchObject({
      date: '明日',
      hospital: '朝阳医院',
      appointmentTime: '14:30',
      timePeriod: 'AFTERNOON',
    })
    expect(second.nextContext.missingInformation).toEqual([])
  })

  it('lets an explicit correction overwrite information collected earlier', () => {
    const initial = createInitialConversationState().elder
    const first = decideElderInput(
      '我明天下午要去医院，但是没人陪我',
      initial,
      {},
    )
    const session = { ...first.nextContext, messages: [] }
    const corrected = decideElderInput(
      '不是明天，是后天，朝阳医院，两点半',
      session,
      {},
    )

    expect(corrected.action).toBe('CREATE_CASE')
    expect(corrected.draft).toMatchObject({
      date: '后日',
      hospital: '朝阳医院',
      appointmentTime: '14:30',
    })
  })

  it('returns a natural clarification instead of going silent for unknown input', () => {
    const decision = decideElderInput('这个事情我说不太清楚', createInitialConversationState().elder, {})
    expect(decision.action).toBe('ANSWER')
    expect(decision.reply).toContain('陪诊安排')
    expect(decision.nextContext.lastAgentQuestion).toBe(decision.reply)
  })

  it('classifies all V1 risk event types independently', () => {
    const samples = {
      FALL: '我刚刚摔了一跤，现在起不来了',
      BREATHING_DIFFICULTY: '我现在喘不上气',
      BLEEDING: '我的手一直在流血',
      SUDDEN_DIZZINESS: '我突然头晕得厉害',
      LOSS_OF_CONSCIOUSNESS: '旁边的人突然晕倒了',
      ENVIRONMENT_HAZARD: '屋里闻到煤气味',
      LOST_OR_MISSING: '我迷路了，找不到家',
      OTHER_RISK: '救命，我这里有危险',
    } as const

    for (const [eventType, text] of Object.entries(samples)) {
      expect(classifyRiskEvent(text)?.eventType).toBe(eventType)
    }
  })

  it('provides different follow-up content for different risks', () => {
    expect(RISK_CATALOG.FALL.followUpQuestion).not.toBe(
      RISK_CATALOG.ENVIRONMENT_HAZARD.followUpQuestion,
    )
    expect(RISK_CATALOG.BREATHING_DIFFICULTY.options.map((item) => item.label)).toContain('说话很困难')
    expect(RISK_CATALOG.LOST_OR_MISSING.options.map((item) => item.label)).toContain('说不清当前位置')
    for (const definition of Object.values(RISK_CATALOG)) {
      expect(definition.options.at(-1)?.label).toBe('暂时没有这些情况')
    }
  })

  it('applies Risk Override before an existing service context', () => {
    const initial = createInitialConversationState().elder
    const session = {
      ...initial,
      currentIntent: 'SERVICE_REQUEST' as const,
      conversationMode: 'COLLECTING_SERVICE' as const,
    }
    const decision = decideElderInput('我现在喘不上气', session, {})
    expect(decision).toMatchObject({
      intent: 'HELP_REQUEST',
      risk: 'CRITICAL',
      action: 'ESCALATE',
      riskEventType: 'BREATHING_DIFFICULTY',
    })
  })
})
