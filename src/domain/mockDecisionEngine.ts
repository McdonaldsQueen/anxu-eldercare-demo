import type {
  CareCase,
  ConversationSession,
  MissingInformation,
  RiskEventType,
  ServiceRequestDraft,
} from './models'
import { RISK_CATALOG } from './riskCatalog'

export type DecisionAction =
  | 'CLARIFY'
  | 'CREATE_CASE'
  | 'UPDATE_CASE'
  | 'SUPPLEMENT_CASE'
  | 'QUERY'
  | 'ANSWER'
  | 'ESCALATE'

type ContextWithoutMessages = Omit<ConversationSession, 'messages'>

export interface ElderDecision {
  intent: 'SERVICE_REQUEST' | 'HELP_REQUEST' | 'UNKNOWN'
  risk: 'NORMAL' | 'CRITICAL'
  information: 'INCOMPLETE' | 'COMPLETE' | 'NOT_APPLICABLE'
  action: DecisionAction
  reply: string
  draft: ServiceRequestDraft | null
  riskEventType: RiskEventType | null
  targetCaseId: string | null
  nextContext: ContextWithoutMessages
}

export interface RiskClassification {
  eventType: RiskEventType
  evidence: string
}

const riskRules: Array<{ eventType: RiskEventType; pattern: RegExp }> = [
  { eventType: 'LOSS_OF_CONSCIOUSNESS', pattern: /(失去意识|没有意识|昏迷|叫不醒|晕倒了?|突然晕倒)/ },
  { eventType: 'BREATHING_DIFFICULTY', pattern: /(呼吸困难|喘不上气|透不过气|不能呼吸|呼吸不上来)/ },
  { eventType: 'FALL', pattern: /(摔(了|一跤)|摔倒|跌倒|滑倒)/ },
  { eventType: 'BLEEDING', pattern: /(流血|出血|血止不住|一直在流血)/ },
  { eventType: 'SUDDEN_DIZZINESS', pattern: /(突然.{0,3}(头晕|眩晕)|头晕得厉害|天旋地转)/ },
  { eventType: 'ENVIRONMENT_HAZARD', pattern: /(着火|起火|有烟|煤气泄漏|煤气味|燃气泄漏|漏电|电线冒火|房间进水)/ },
  { eventType: 'LOST_OR_MISSING', pattern: /(迷路|找不到家|不知道在哪|走失|找不到老人|老人不见了)/ },
  { eventType: 'OTHER_RISK', pattern: /(救命|有危险|很危险|出事了|紧急情况|马上来帮我)/ },
]

export function classifyRiskEvent(text: string): RiskClassification | null {
  for (const rule of riskRules) {
    const match = text.match(rule.pattern)
    if (match) return { eventType: rule.eventType, evidence: match[0] }
  }
  return null
}

const hasEscortIntent = (text: string) =>
  /医院|看病|就诊|挂号/.test(text) &&
  /(没人.{0,4}陪|需要.{0,3}陪|陪我|陪同|陪诊)/.test(text)

const parseDate = (text: string) => {
  const correction = text.match(/不是(?:今天|明天|后天|今日|明日|后日)[，,\s]*是(今天|明天|后天|今日|明日|后日)/)
  if (correction) {
    if (/后天|后日/.test(correction[1])) return '后日'
    if (/明天|明日/.test(correction[1])) return '明日'
    return '今日'
  }
  if (/后天|后日/.test(text)) return '后日'
  if (/明天|明日/.test(text)) return '明日'
  if (/今天|今日/.test(text)) return '今日'
  return null
}

const parseHospital = (text: string) => {
  const match = text.match(/(朝阳医院|协和医院|同仁医院|积水潭医院|安贞医院|宣武医院|天坛医院|人民医院|中日友好医院|北医三院)/)
  return match?.[1] ?? null
}

const parseTimePeriod = (
  text: string,
  current: ServiceRequestDraft['timePeriod'],
) => {
  if (/下午|傍晚|晚上/.test(text)) return 'AFTERNOON' as const
  if (/上午|早上|清晨/.test(text)) return 'MORNING' as const
  return current
}

const parseAppointmentTime = (
  text: string,
  period: ServiceRequestDraft['timePeriod'],
) => {
  if (/14[:：]30/.test(text)) return '14:30'
  if (/09[:：]30|9[:：]30/.test(text)) return '09:30'
  if (/(两|2)点半/.test(text)) return period === 'MORNING' ? '02:30' : '14:30'
  if (/(九|9)点半/.test(text)) return period === 'AFTERNOON' ? '21:30' : '09:30'
  const exact = text.match(/(上午|下午)?\s*(\d{1,2})[点时:]([0-5]?\d)?/)
  if (!exact) return null
  let hour = Number(exact[2])
  const minute = Number(exact[3] ?? 0)
  const parsedPeriod = exact[1] === '下午' ? 'AFTERNOON' : exact[1] === '上午' ? 'MORNING' : period
  if (parsedPeriod === 'AFTERNOON' && hour < 12) hour += 12
  if (parsedPeriod === 'MORNING' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function mergeServiceDraft(
  current: ServiceRequestDraft | null,
  text: string,
): ServiceRequestDraft {
  const timePeriod = parseTimePeriod(text, current?.timePeriod ?? null)
  return {
    subjectElderId: current?.subjectElderId ?? 'E001',
    serviceType: current?.serviceType ?? 'MEDICAL_ESCORT',
    date: parseDate(text) ?? current?.date ?? null,
    hospital: parseHospital(text) ?? current?.hospital ?? null,
    appointmentTime: parseAppointmentTime(text, timePeriod) ?? current?.appointmentTime ?? null,
    timePeriod,
  }
}

const missingFor = (draft: ServiceRequestDraft): MissingInformation[] => {
  const missing: MissingInformation[] = []
  if (!draft.date) missing.push('DATE')
  if (!draft.hospital) missing.push('HOSPITAL')
  if (!draft.appointmentTime) missing.push('APPOINTMENT_TIME')
  return missing
}

const clarificationFor = (missing: MissingInformation[]) => {
  if (missing.includes('DATE') && missing.includes('HOSPITAL') && missing.includes('APPOINTMENT_TIME')) {
    return '可以，我帮您安排。请告诉我哪天、去哪家医院，大概几点？'
  }
  if (missing.includes('HOSPITAL') && missing.includes('APPOINTMENT_TIME')) {
    return '可以，我帮您安排。您去哪家医院？大概几点的号？'
  }
  if (missing.includes('DATE')) return '好的。您准备哪天去医院？'
  if (missing.includes('HOSPITAL')) return '好的。您准备去哪家医院？'
  return '好的。大概几点的号？'
}

const isActive = (careCase: CareCase) => careCase.status !== 'COMPLETED'

const latestActiveCase = (
  cases: Record<string, CareCase>,
  caseType: 'SAFETY' | 'MOBILITY',
) => Object.values(cases)
  .filter((careCase) => careCase.caseType === caseType && isActive(careCase))
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

const draftFromCase = (careCase: CareCase): ServiceRequestDraft => {
  const parts = careCase.appointmentTime?.split(' ') ?? []
  const date = parts[0] ?? null
  const appointmentTime = parts[1] ?? null
  const hour = appointmentTime ? Number(appointmentTime.split(':')[0]) : 0
  return {
    subjectElderId: careCase.subjectElderId,
    serviceType: 'MEDICAL_ESCORT',
    date,
    hospital: careCase.hospital,
    appointmentTime,
    timePeriod: appointmentTime ? (hour >= 12 ? 'AFTERNOON' : 'MORNING') : null,
  }
}

const containsServiceInformation = (text: string) =>
  Boolean(parseDate(text) || parseHospital(text) || parseAppointmentTime(text, null))

const makeContext = (
  session: ConversationSession,
  values: Partial<ContextWithoutMessages>,
): ContextWithoutMessages => ({
  currentIntent: values.currentIntent ?? session.currentIntent,
  currentSubject: values.currentSubject ?? session.currentSubject,
  conversationMode: values.conversationMode ?? session.conversationMode,
  lastAgentQuestion: values.lastAgentQuestion === undefined ? session.lastAgentQuestion : values.lastAgentQuestion,
  collectedInformation: values.collectedInformation ?? session.collectedInformation,
  missingInformation: values.missingInformation ?? session.missingInformation,
  activeCaseId: values.activeCaseId === undefined ? session.activeCaseId : values.activeCaseId,
})

export function decideElderInput(
  rawText: string,
  session: ConversationSession,
  cases: Record<string, CareCase>,
): ElderDecision {
  const text = rawText.trim()
  const riskClassification = classifyRiskEvent(text)
  const activeSafetyCase = latestActiveCase(cases, 'SAFETY')

  // Risk Override is evaluated before service intent and service context.
  if (activeSafetyCase) {
    const nextRiskType = riskClassification?.eventType ?? activeSafetyCase.latestRiskEventType ?? activeSafetyCase.eventType ?? 'OTHER_RISK'
    const definition = RISK_CATALOG[nextRiskType]
    const reply = riskClassification
      ? `我记下了，已经补充到当前安全事件里。${definition.followUpQuestion}`
      : '我记下了，已经补充到当前安全事件里。工作人员会结合这些信息处理。'
    return {
      intent: 'HELP_REQUEST', risk: 'CRITICAL', information: 'COMPLETE',
      action: 'SUPPLEMENT_CASE', reply,
      draft: session.collectedInformation.serviceRequest,
      riskEventType: riskClassification?.eventType ?? null,
      targetCaseId: activeSafetyCase.caseId,
      nextContext: makeContext(session, {
        currentIntent: 'HELP_REQUEST', conversationMode: 'ACTIVE_RISK',
        lastAgentQuestion: riskClassification ? definition.followUpQuestion : null,
        activeCaseId: activeSafetyCase.caseId,
        collectedInformation: {
          ...session.collectedInformation,
          riskEventType: nextRiskType,
          additionalDetails: [...session.collectedInformation.additionalDetails, text],
        },
      }),
    }
  }

  if (riskClassification) {
    const definition = RISK_CATALOG[riskClassification.eventType]
    return {
      intent: 'HELP_REQUEST', risk: 'CRITICAL', information: 'COMPLETE',
      action: 'ESCALATE',
      reply: `我先帮您联系工作人员。${definition.guidance}`,
      draft: session.collectedInformation.serviceRequest,
      riskEventType: riskClassification.eventType,
      targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'HELP_REQUEST', conversationMode: 'COLLECTING_RISK',
        lastAgentQuestion: definition.followUpQuestion,
        collectedInformation: {
          ...session.collectedInformation,
          riskEventType: riskClassification.eventType,
          additionalDetails: [...session.collectedInformation.additionalDetails, text],
        },
        missingInformation: [],
      }),
    }
  }

  const activeServiceCase = latestActiveCase(cases, 'MOBILITY')
  if (activeServiceCase) {
    if (containsServiceInformation(text)) {
      const currentDraft = draftFromCase(activeServiceCase)
      const draft = mergeServiceDraft(currentDraft, text)
      const changed = draft.date !== currentDraft.date ||
        draft.hospital !== currentDraft.hospital ||
        draft.appointmentTime !== currentDraft.appointmentTime
      if (!changed) {
        return {
          intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
          action: 'QUERY',
          reply: '这些陪诊信息已经记在当前安排里了，没有重复创建新的事情。',
          draft, riskEventType: null, targetCaseId: activeServiceCase.caseId,
          nextContext: makeContext(session, {
            currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
            activeCaseId: activeServiceCase.caseId,
            collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
          }),
        }
      }
      return {
        intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
        action: 'UPDATE_CASE',
        reply: `好的，已经把陪诊安排更新为${draft.date} ${draft.appointmentTime}，${draft.hospital}。`,
        draft, riskEventType: null, targetCaseId: activeServiceCase.caseId,
        nextContext: makeContext(session, {
          currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
          lastAgentQuestion: null, activeCaseId: activeServiceCase.caseId,
          collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
          missingInformation: [],
        }),
      }
    }
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
      action: 'QUERY',
      reply: '这件陪诊安排还在处理中。您如果要修改日期、医院或时间，可以直接告诉我。',
      draft: draftFromCase(activeServiceCase), riskEventType: null,
      targetCaseId: activeServiceCase.caseId,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
        activeCaseId: activeServiceCase.caseId,
      }),
    }
  }

  const isContinuingEscort = session.currentIntent === 'SERVICE_REQUEST' && session.conversationMode === 'COLLECTING_SERVICE'
  if (hasEscortIntent(text) || isContinuingEscort) {
    const draft = mergeServiceDraft(session.collectedInformation.serviceRequest, text)
    const missingInformation = missingFor(draft)
    if (missingInformation.length === 0) {
      return {
        intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
        action: 'CREATE_CASE',
        reply: '好的，我记下了。我现在帮您联系服务中心安排陪诊，有结果马上告诉您。',
        draft, riskEventType: null, targetCaseId: null,
        nextContext: makeContext(session, {
          currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
          lastAgentQuestion: null,
          collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
          missingInformation: [],
        }),
      }
    }
    const question = clarificationFor(missingInformation)
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'INCOMPLETE',
      action: 'CLARIFY', reply: question, draft,
      riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST', conversationMode: 'COLLECTING_SERVICE',
        lastAgentQuestion: question,
        collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
        missingInformation,
      }),
    }
  }

  const fallback = '我还没完全听明白。您是需要陪诊安排，还是遇到了需要马上处理的安全情况？'
  return {
    intent: 'UNKNOWN', risk: 'NORMAL', information: 'NOT_APPLICABLE',
    action: 'ANSWER', reply: fallback,
    draft: session.collectedInformation.serviceRequest,
    riskEventType: null, targetCaseId: null,
    nextContext: makeContext(session, {
      currentIntent: 'UNKNOWN', conversationMode: 'IDLE', lastAgentQuestion: fallback,
    }),
  }
}
