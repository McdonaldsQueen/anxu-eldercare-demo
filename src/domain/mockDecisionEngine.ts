import type {
  CareCase,
  ConversationSession,
  FamilyRequestDraft,
  MissingInformation,
  RiskEventType,
  ServiceCategory,
  ServiceRequestDraft,
} from './models'
import { RISK_CATALOG } from './riskCatalog'

export type DecisionAction =
  | 'CLARIFY'
  | 'CREATE_CASE'
  | 'CREATE_EVALUATION'
  | 'UPDATE_CASE'
  | 'SUPPLEMENT_CASE'
  | 'QUERY'
  | 'ANSWER'
  | 'ESCALATE'

type ContextWithoutMessages = Omit<ConversationSession, 'messages'>

export interface ElderDecision {
  intent: 'SERVICE_REQUEST' | 'EVALUATION_REQUEST' | 'HELP_REQUEST' | 'UNKNOWN'
  risk: 'NORMAL' | 'CRITICAL'
  information: 'INCOMPLETE' | 'COMPLETE' | 'NOT_APPLICABLE'
  action: DecisionAction
  reply: string
  draft: ServiceRequestDraft | null
  riskEventType: RiskEventType | null
  riskEvidence?: string | null
  targetCaseId: string | null
  nextContext: ContextWithoutMessages
}

export interface FamilyDecision {
  intent: 'FAMILY_REQUEST' | 'EVALUATION_REQUEST' | 'HELP_REQUEST' | 'UNKNOWN'
  risk: 'NORMAL' | 'CRITICAL'
  information: 'INCOMPLETE' | 'COMPLETE' | 'NOT_APPLICABLE'
  action: DecisionAction
  reply: string
  draft: FamilyRequestDraft | null
  riskEventType: RiskEventType | null
  riskEvidence?: string | null
  targetCaseId: string | null
  nextContext: ContextWithoutMessages
}

export interface RiskClassification {
  eventType: RiskEventType
  evidence: string
}

const riskRules: Array<{ eventType: RiskEventType; pattern: RegExp }> = [
  { eventType: 'LOSS_OF_CONSCIOUSNESS', pattern: /(失去意识|没有意识|昏迷|叫不醒|晕倒了?|突然晕倒)/ },
  { eventType: 'BREATHING_DIFFICULTY', pattern: /(胸口闷.{0,5}(喘不上气|呼吸困难)|呼吸困难|喘不上气|透不过气|不能呼吸|呼吸不上来)/ },
  { eventType: 'FALL', pattern: /(摔(了|一跤)|摔倒|跌倒|滑倒)/ },
  { eventType: 'BLEEDING', pattern: /(流血|出血|血止不住|一直在流血)/ },
  { eventType: 'SUDDEN_DIZZINESS', pattern: /(突然.{0,3}(头晕|眩晕)|头晕得厉害|天旋地转)/ },
  { eventType: 'ENVIRONMENT_HAZARD', pattern: /(着火|起火|有烟|煤气泄漏|煤气味|燃气泄漏|漏电|电线冒火|房间进水)/ },
  { eventType: 'LOST_OR_MISSING', pattern: /(迷路|找不到家|不知道(自己)?在哪|走失|老人不见了)/ },
  { eventType: 'OTHER_RISK', pattern: /(救命|有危险|很危险|出事了|紧急情况|马上来帮我)/ },
]

export function classifyRiskEvent(text: string): RiskClassification | null {
  for (const rule of riskRules) {
    const match = text.match(rule.pattern)
    if (match) return { eventType: rule.eventType, evidence: match[0] }
  }
  return null
}

const emptyServiceDraft = (category: ServiceCategory, serviceType: ServiceRequestDraft['serviceType']): ServiceRequestDraft => ({
  subjectElderId: 'E001',
  category,
  serviceType,
  date: null,
  hospital: null,
  appointmentTime: null,
  timePeriod: null,
  destination: null,
  assistanceNeeded: null,
  requestSummary: null,
})

const hasEscortIntent = (text: string) =>
  /(医院|看病|就诊|挂号|复查)/.test(text) &&
  /(今天|明天|后天|下周|没人.{0,4}陪|需要.{0,3}陪|陪我|陪同|陪诊|协助|要去|去.*医院|复查)/.test(text)

const hasTravelIntent = (text: string) =>
  /(活动中心|下楼|散步|社区|办事|出去|出行)/.test(text) &&
  /(陪|推|去|走|送|协助)/.test(text)

const hasDailyLivingIntent = (text: string) =>
  /够不到/.test(text) ||
  (/(洗澡|整理|收拾|生活)/.test(text) && /(帮|协助|工作人员|需要人)/.test(text))

const hasItemHandoverIntent = (text: string) =>
  /(家属送来|东西到了|物品到了|包裹到了|帮我拿|送过来|转交给我)/.test(text)

const hasConfiguredBookingIntent = (text: string) =>
  /(预约.{0,4}理发|参加.{0,6}活动|活动中心的活动)/.test(text)

const classifyServiceCategory = (text: string): ServiceCategory | null => {
  if (hasEscortIntent(text)) return 'MEDICAL_ESCORT'
  if (hasTravelIntent(text)) return 'ACCOMPANIED_TRAVEL'
  if (hasDailyLivingIntent(text)) return 'DAILY_LIVING_ASSISTANCE'
  if (hasItemHandoverIntent(text)) return 'ITEM_HANDOVER'
  if (hasConfiguredBookingIntent(text)) return 'CENTER_SERVICE_BOOKING'
  return null
}

const looksLikeClearUnsupportedRequest = (text: string) =>
  /(我想|能不能|可不可以|麻烦|帮我|需要|预约|想要)/.test(text) &&
  text.length >= 5 &&
  !/(说件事情|说个事|不太清楚|没说清楚)/.test(text)

const parseDate = (text: string) => {
  const correction = text.match(/不是(?:今天|明天|后天|今日|明日|后日|下周)[，,\s]*是(今天|明天|后天|今日|明日|后日|下周)/)
  const value = correction?.[1] ?? text
  if (/下周/.test(value)) return '下周'
  if (/后天|后日/.test(value)) return '后日'
  if (/明天|明日/.test(value)) return '明日'
  if (/今天|今日/.test(value)) return '今日'
  return null
}

const parseHospital = (text: string) => {
  const match = text.match(/([\u4e00-\u9fa5]{2,12}(?:医院|医馆))/)
  const candidate = match?.[1] ?? null
  if (!candidate || /(我|明天|今天|后天|下周|要去|准备去)/.test(candidate)) return null
  return candidate
}

const parseTimePeriod = (text: string, current: ServiceRequestDraft['timePeriod']) => {
  if (/下午|傍晚|晚上/.test(text)) return 'AFTERNOON' as const
  if (/上午|早上|清晨/.test(text)) return 'MORNING' as const
  return current
}

const parseAppointmentTime = (text: string, period: ServiceRequestDraft['timePeriod']) => {
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

const parseDestination = (text: string) => {
  if (/活动中心/.test(text)) return '活动中心'
  if (/下楼|散步/.test(text)) return '楼下散步'
  const match = text.match(/去([\u4e00-\u9fa5]{2,12})(?:办|，|,|。|$)/)
  return match?.[1] ?? null
}

const parseAssistance = (text: string) => {
  if (/推我|轮椅|需要人推/.test(text)) return '轮椅推行协助'
  if (/陪我|陪同|找个人陪/.test(text)) return '人员陪同'
  if (/送我/.test(text)) return '接送协助'
  return null
}

export function mergeServiceDraft(current: ServiceRequestDraft | null, text: string, category?: ServiceCategory): ServiceRequestDraft {
  const resolvedCategory = category ?? current?.category ?? 'MEDICAL_ESCORT'
  const serviceType = resolvedCategory === 'MEDICAL_ESCORT' ? 'MEDICAL_ESCORT'
    : resolvedCategory === 'ACCOMPANIED_TRAVEL' ? 'ACCOMPANIED_TRAVEL'
      : resolvedCategory === 'DAILY_LIVING_ASSISTANCE' ? 'DAILY_LIVING_ASSISTANCE'
        : resolvedCategory === 'ITEM_HANDOVER' ? 'ITEM_HANDOVER'
          : resolvedCategory === 'CENTER_SERVICE_BOOKING' ? 'CENTER_SERVICE_BOOKING'
            : null
  const base = current?.category === resolvedCategory ? current : emptyServiceDraft(resolvedCategory, serviceType)
  const timePeriod = parseTimePeriod(text, base.timePeriod)
  return {
    ...base,
    subjectElderId: base.subjectElderId ?? 'E001',
    category: resolvedCategory,
    serviceType,
    date: parseDate(text) ?? base.date,
    hospital: parseHospital(text) ?? base.hospital,
    appointmentTime: parseAppointmentTime(text, timePeriod) ?? base.appointmentTime,
    timePeriod,
    destination: parseDestination(text) ?? base.destination,
    assistanceNeeded: parseAssistance(text) ?? base.assistanceNeeded,
    requestSummary: text || base.requestSummary,
  }
}

const missingFor = (draft: ServiceRequestDraft): MissingInformation[] => {
  if (draft.category === 'MEDICAL_ESCORT') {
    const missing: MissingInformation[] = []
    if (!draft.date) missing.push('DATE')
    if (!draft.hospital) missing.push('HOSPITAL')
    if (!draft.appointmentTime) missing.push('APPOINTMENT_TIME')
    return missing
  }
  if (draft.category === 'ACCOMPANIED_TRAVEL') {
    const missing: MissingInformation[] = []
    if (!draft.destination) missing.push('DESTINATION')
    if (!draft.timePeriod && !draft.appointmentTime && !draft.date) missing.push('DATE')
    if (!draft.assistanceNeeded) missing.push('ASSISTANCE')
    return missing
  }
  return []
}

const clarificationFor = (missing: MissingInformation[], category?: ServiceCategory | null) => {
  if (category === 'ACCOMPANIED_TRAVEL') {
    if (missing.includes('DATE')) return '好的。您想什么时候去？'
    if (missing.includes('DESTINATION')) return '好的。您想去哪里？'
    return '好的。您需要工作人员陪同、轮椅推行，还是其他协助？'
  }
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

const isActive = (careCase: CareCase) => !['COMPLETED', 'DECLINED'].includes(careCase.status)
const latestActiveCase = (cases: Record<string, CareCase>, predicate: (careCase: CareCase) => boolean) =>
  Object.values(cases).filter((careCase) => predicate(careCase) && isActive(careCase))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

const draftFromCase = (careCase: CareCase): ServiceRequestDraft => {
  const parts = careCase.appointmentTime?.split(' ') ?? []
  const appointmentTime = parts[1] ?? null
  const hour = appointmentTime ? Number(appointmentTime.split(':')[0]) : 0
  return {
    subjectElderId: careCase.subjectElderId,
    category: 'MEDICAL_ESCORT',
    serviceType: 'MEDICAL_ESCORT',
    date: parts[0] ?? null,
    hospital: careCase.hospital,
    appointmentTime,
    timePeriod: appointmentTime ? (hour >= 12 ? 'AFTERNOON' : 'MORNING') : null,
    destination: null,
    assistanceNeeded: null,
    requestSummary: careCase.requestSummary ?? null,
  }
}

const containsServiceInformation = (text: string) =>
  Boolean(parseDate(text) || parseHospital(text) || parseAppointmentTime(text, null))

const makeContext = (session: ConversationSession, values: Partial<ContextWithoutMessages>): ContextWithoutMessages => ({
  currentIntent: values.currentIntent ?? session.currentIntent,
  currentSubject: values.currentSubject ?? session.currentSubject,
  conversationMode: values.conversationMode ?? session.conversationMode,
  lastAgentQuestion: values.lastAgentQuestion === undefined ? session.lastAgentQuestion : values.lastAgentQuestion,
  collectedInformation: values.collectedInformation ?? session.collectedInformation,
  missingInformation: values.missingInformation ?? session.missingInformation,
  activeCaseId: values.activeCaseId === undefined ? session.activeCaseId : values.activeCaseId,
})

const serviceReply = (category?: ServiceCategory | null) => {
  if (category === 'MEDICAL_ESCORT') return '好的，我记下了。我现在帮您联系服务中心安排陪诊，有结果马上告诉您。'
  if (category === 'ACCOMPANIED_TRAVEL') return '好的，出行陪同需求已经提交给服务中心。'
  if (category === 'DAILY_LIVING_ASSISTANCE') return '好的，日常生活协助需求已经提交给工作人员。'
  if (category === 'ITEM_HANDOVER') return '好的，物品转交需求已经提交给工作人员。'
  return '好的，预约需求已经提交给服务中心。'
}

export function decideElderInput(rawText: string, session: ConversationSession, cases: Record<string, CareCase>): ElderDecision {
  const text = rawText.trim()
  const riskClassification = classifyRiskEvent(text)
  const activeSafetyCase = latestActiveCase(cases, (careCase) => careCase.caseType === 'SAFETY')

  // Deterministic Risk Override: only the current message can activate this branch.
  if (riskClassification) {
    const definition = RISK_CATALOG[riskClassification.eventType]
    const isSameRiskThread = activeSafetyCase && ['COLLECTING_RISK', 'OPEN_RISK_DESCRIPTION', 'ACTIVE_RISK'].includes(session.conversationMode)
    return {
      intent: 'HELP_REQUEST', risk: 'CRITICAL', information: 'COMPLETE',
      action: isSameRiskThread ? 'SUPPLEMENT_CASE' : 'ESCALATE',
      reply: isSameRiskThread
        ? `我记下了，已经补充到当前安全事件里。${definition.followUpQuestion}`
        : `我先帮您联系工作人员。${definition.guidance}`,
      draft: null,
      riskEventType: riskClassification.eventType,
      riskEvidence: riskClassification.evidence,
      targetCaseId: isSameRiskThread ? activeSafetyCase.caseId : null,
      nextContext: makeContext(session, {
        currentIntent: 'HELP_REQUEST',
        conversationMode: 'COLLECTING_RISK',
        lastAgentQuestion: definition.followUpQuestion,
        activeCaseId: isSameRiskThread ? activeSafetyCase.caseId : null,
        collectedInformation: {
          ...session.collectedInformation,
          serviceRequest: null,
          riskEventType: riskClassification.eventType,
          additionalDetails: [text],
        },
        missingInformation: [],
      }),
    }
  }

  // Explicit new service intent exits any old risk or service context.
  const explicitCategory = classifyServiceCategory(text)
  if (explicitCategory) {
    const draft = mergeServiceDraft(null, text, explicitCategory)
    const missingInformation = missingFor(draft)
    const question = clarificationFor(missingInformation, explicitCategory)
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL',
      information: missingInformation.length ? 'INCOMPLETE' : 'COMPLETE',
      action: missingInformation.length ? 'CLARIFY' : 'CREATE_CASE',
      reply: missingInformation.length ? question : serviceReply(explicitCategory),
      draft, riskEventType: null, riskEvidence: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST',
        conversationMode: missingInformation.length ? 'COLLECTING_SERVICE' : 'ACTIVE_SERVICE',
        lastAgentQuestion: missingInformation.length ? question : null,
        activeCaseId: null,
        collectedInformation: {
          serviceRequest: draft, familyRequest: null,
          riskEventType: null, riskDetails: [], additionalDetails: [],
        },
        missingInformation,
      }),
    }
  }

  // A field-only reply continues a collecting service context.
  if (session.currentIntent === 'SERVICE_REQUEST' && session.conversationMode === 'COLLECTING_SERVICE' && session.collectedInformation.serviceRequest) {
    const draft = mergeServiceDraft(session.collectedInformation.serviceRequest, text)
    const missingInformation = missingFor(draft)
    const question = clarificationFor(missingInformation, draft.category)
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL',
      information: missingInformation.length ? 'INCOMPLETE' : 'COMPLETE',
      action: missingInformation.length ? 'CLARIFY' : 'CREATE_CASE',
      reply: missingInformation.length ? question : serviceReply(draft.category),
      draft, riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST',
        conversationMode: missingInformation.length ? 'COLLECTING_SERVICE' : 'ACTIVE_SERVICE',
        lastAgentQuestion: missingInformation.length ? question : null,
        activeCaseId: null,
        collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
        missingInformation,
      }),
    }
  }

  // Corrections/status questions can target the active escort, but do not own unrelated messages.
  const activeEscort = latestActiveCase(cases, (careCase) =>
    ['SERVICE', 'MOBILITY'].includes(careCase.caseType) && careCase.serviceType === 'MEDICAL_ESCORT')
  if (activeEscort && containsServiceInformation(text)) {
    const currentDraft = draftFromCase(activeEscort)
    const draft = mergeServiceDraft(currentDraft, text)
    const changed = draft.date !== currentDraft.date || draft.hospital !== currentDraft.hospital || draft.appointmentTime !== currentDraft.appointmentTime
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
      action: changed ? 'UPDATE_CASE' : 'QUERY',
      reply: changed
        ? `好的，已经把陪诊安排更新为${draft.date} ${draft.appointmentTime}，${draft.hospital}。`
        : '这些陪诊信息已经记在当前安排里了，没有重复创建新的事情。',
      draft, riskEventType: null, targetCaseId: activeEscort.caseId,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
        lastAgentQuestion: null, activeCaseId: activeEscort.caseId,
        collectedInformation: { ...session.collectedInformation, serviceRequest: draft },
        missingInformation: [],
      }),
    }
  }
  if (activeEscort && /(安排到哪里|进度|怎么样了|处理到哪)/.test(text)) {
    return {
      intent: 'SERVICE_REQUEST', risk: 'NORMAL', information: 'COMPLETE', action: 'QUERY',
      reply: '这件陪诊安排还在处理中。您如果要修改日期、医院或时间，可以直接告诉我。',
      draft: draftFromCase(activeEscort), riskEventType: null, targetCaseId: activeEscort.caseId,
      nextContext: makeContext(session, {
        currentIntent: 'SERVICE_REQUEST', conversationMode: 'ACTIVE_SERVICE',
        activeCaseId: activeEscort.caseId,
      }),
    }
  }

  if (looksLikeClearUnsupportedRequest(text)) {
    const draft = { ...emptyServiceDraft('EVALUATION', null), requestSummary: text }
    return {
      intent: 'EVALUATION_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
      action: 'CREATE_EVALUATION',
      reply: '我明白您想完成的事情了。我先建立待评估需求，由工作人员确认中心是否可以承接。',
      draft, riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'EVALUATION_REQUEST', conversationMode: 'IDLE', lastAgentQuestion: null,
        activeCaseId: null,
        collectedInformation: { serviceRequest: null, familyRequest: null, riskEventType: null, riskDetails: [], additionalDetails: [] },
        missingInformation: [],
      }),
    }
  }

  const fallback = '我还没完全听明白。请告诉我您是需要陪诊安排、日常协助，还是想完成其他事情，我会继续帮您整理。'
  return {
    intent: 'UNKNOWN', risk: 'NORMAL', information: 'NOT_APPLICABLE',
    action: 'ANSWER', reply: fallback, draft: null, riskEventType: null, targetCaseId: null,
    nextContext: makeContext(session, {
      currentIntent: 'UNKNOWN', conversationMode: 'IDLE', lastAgentQuestion: fallback,
      activeCaseId: null,
    }),
  }
}

const emptyFamilyDraft = (): FamilyRequestDraft => ({
  subjectElderId: 'E001', serviceType: null, itemType: null, itemName: null,
  itemArrivalStatus: null, providedDosageInstructions: null,
  specialInstruction: null, requestSummary: null,
})

const parseFamilyItem = (text: string, current: FamilyRequestDraft | null): FamilyRequestDraft => {
  const isMedicine = /(药|药品|药物)/.test(text) || current?.itemType === 'MEDICINE'
  const itemMatch = text.match(/(?:买了|送来|送到|转交)(?:一(?:些|件|盒|瓶))?([^，,。]{1,12}?)(?:，|,|。|已经|还没|麻烦|请|$)/)
  const medicineMatch = text.match(/(?:买了|送了|送来|送到)(?:一(?:些|盒|瓶))?([^，,。]{1,16}?(?:片|胶囊|口服液|药))/)
  const dosageMatch = text.match(/((?:每次|一次|每天|每日|早晚|饭前|饭后)[^，,。]{0,20}(?:片|粒|毫升|ml|mg|次))/i)
  const specialMatch = text.match(/((?:提醒|协助|监督|帮她|帮他)[^，,。]{0,30}(?:吃药|服药|用药)[^，,。]{0,20})/)
  const deliveryInstructionMatch = text.match(/((?:请|麻烦)?(?:放在|冷藏|本人签收|当面交给)[^，,。]{1,20})/)
  const arrived = /(已经|已)(?:送到|到达).{0,6}(养老中心|中心|前台)|中心已经收到/.test(text)
    ? 'ARRIVED' as const
    : /(还没|尚未|准备)(?:送到|到达)/.test(text)
      ? 'NOT_ARRIVED' as const
      : current?.itemArrivalStatus ?? null
  return {
    ...(current ?? emptyFamilyDraft()),
    serviceType: 'FAMILY_ITEM_HANDOVER',
    itemType: isMedicine ? 'MEDICINE' : 'GENERAL',
    itemName: medicineMatch?.[1] ?? itemMatch?.[1]?.trim() ?? current?.itemName ?? null,
    itemArrivalStatus: arrived,
    // These two fields only ever contain substrings supplied by the family message.
    providedDosageInstructions: dosageMatch?.[1] ?? current?.providedDosageInstructions ?? null,
    specialInstruction: specialMatch?.[1] ?? deliveryInstructionMatch?.[1] ?? current?.specialInstruction ?? null,
    requestSummary: text,
  }
}

const familyItemMissing = (draft: FamilyRequestDraft): MissingInformation[] => {
  const missing: MissingInformation[] = []
  if (!draft.itemName) missing.push('ITEM_NAME')
  if (!draft.itemArrivalStatus) missing.push('ITEM_ARRIVAL_STATUS')
  return missing
}

export function decideFamilyInput(rawText: string, session: ConversationSession, cases: Record<string, CareCase>): FamilyDecision {
  const text = rawText.trim()
  let riskClassification = classifyRiskEvent(text)
  if (!riskClassification && /(联系不上|打不通|找不到)/.test(text) && /(头晕|胸闷|不舒服|摔)/.test(text)) {
    riskClassification = { eventType: /头晕/.test(text) ? 'SUDDEN_DIZZINESS' : 'OTHER_RISK', evidence: text }
  }
  const activeSafetyCase = latestActiveCase(cases, (careCase) => careCase.caseType === 'SAFETY')
  if (riskClassification) {
    const definition = RISK_CATALOG[riskClassification.eventType]
    const sameThread = activeSafetyCase && session.currentIntent === 'HELP_REQUEST'
    return {
      intent: 'HELP_REQUEST', risk: 'CRITICAL', information: 'COMPLETE',
      action: sameThread ? 'SUPPLEMENT_CASE' : 'ESCALATE',
      reply: `这包含明确的安全风险信号，我已先建立待人工审核的安全事件。工作人员会尽快核实。${definition.guidance}`,
      draft: null, riskEventType: riskClassification.eventType, riskEvidence: riskClassification.evidence,
      targetCaseId: sameThread ? activeSafetyCase.caseId : null,
      nextContext: makeContext(session, {
        currentIntent: 'HELP_REQUEST', conversationMode: 'ACTIVE_RISK',
        lastAgentQuestion: null, activeCaseId: sameThread ? activeSafetyCase.caseId : null,
        collectedInformation: { serviceRequest: null, familyRequest: null, riskEventType: riskClassification.eventType, riskDetails: [], additionalDetails: [text] },
        missingInformation: [],
      }),
    }
  }

  if (/(联系不上|打不通|一直没接|找不到).{0,12}(我妈|妈妈|我爸|爸爸|老人)/.test(text) ||
      /(我妈|妈妈|我爸|爸爸|老人).{0,12}(联系不上|打不通|一直没接)/.test(text)) {
    const draft: FamilyRequestDraft = {
      ...emptyFamilyDraft(), serviceType: 'CONTACT_CHECK',
      requestSummary: '协助确认老人当前情况并联系家属',
    }
    return {
      intent: 'FAMILY_REQUEST', risk: 'NORMAL', information: 'COMPLETE', action: 'CREATE_CASE',
      reply: '已为当前绑定老人建立联系确认任务。工作人员会核实老人情况并把结果同步给您。',
      draft, riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'FAMILY_REQUEST', conversationMode: 'IDLE', lastAgentQuestion: null, activeCaseId: null,
        collectedInformation: { serviceRequest: null, familyRequest: draft, riskEventType: null, riskDetails: [], additionalDetails: [] },
        missingInformation: [],
      }),
    }
  }

  const explicitItem = /(买了|送了|送到|转交|交给).{0,18}(东西|物品|药|衣服|包裹)|(?:东西|物品|药|衣服|包裹).{0,18}(送给|交给)/.test(text)
  const continuingItem = session.currentIntent === 'FAMILY_REQUEST' &&
    session.conversationMode === 'COLLECTING_FAMILY_REQUEST' &&
    session.collectedInformation.familyRequest?.serviceType === 'FAMILY_ITEM_HANDOVER'
  if (explicitItem || continuingItem) {
    const draft = parseFamilyItem(text, explicitItem ? null : session.collectedInformation.familyRequest ?? null)
    const missing = familyItemMissing(draft)
    const needsEvaluation = draft.itemType === 'MEDICINE' &&
      Boolean(draft.specialInstruction && /(吃药|服药|用药|提醒|协助|监督)/.test(draft.specialInstruction))
    const action = missing.length ? 'CLARIFY' : needsEvaluation ? 'CREATE_EVALUATION' : 'CREATE_CASE'
    const reply = missing.includes('ITEM_NAME')
      ? '请告诉我需要转交的物品是什么？'
      : missing.includes('ITEM_ARRIVAL_STATUS')
        ? '请确认物品是否已经送达养老中心？'
        : needsEvaluation
          ? '药品和家属提供的要求已如实记录。服药协助需要工作人员按中心规则评估，我已建立待评估需求。'
          : '物品转交需求已提交。工作人员确认并交付后会把结果同步给您。'
    return {
      intent: needsEvaluation ? 'EVALUATION_REQUEST' : 'FAMILY_REQUEST',
      risk: 'NORMAL', information: missing.length ? 'INCOMPLETE' : 'COMPLETE',
      action, reply, draft, riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: needsEvaluation ? 'EVALUATION_REQUEST' : 'FAMILY_REQUEST',
        conversationMode: missing.length ? 'COLLECTING_FAMILY_REQUEST' : 'IDLE',
        lastAgentQuestion: missing.length ? reply : null, activeCaseId: null,
        collectedInformation: { serviceRequest: null, familyRequest: draft, riskEventType: null, riskDetails: [], additionalDetails: [] },
        missingInformation: missing,
      }),
    }
  }

  if (looksLikeClearUnsupportedRequest(text)) {
    const draft: FamilyRequestDraft = { ...emptyFamilyDraft(), requestSummary: text }
    return {
      intent: 'EVALUATION_REQUEST', risk: 'NORMAL', information: 'COMPLETE',
      action: 'CREATE_EVALUATION',
      reply: '这不在家属端标准服务目录中，我已建立待评估需求，由工作人员决定是否承接。',
      draft, riskEventType: null, targetCaseId: null,
      nextContext: makeContext(session, {
        currentIntent: 'EVALUATION_REQUEST', conversationMode: 'IDLE', lastAgentQuestion: null, activeCaseId: null,
        collectedInformation: { serviceRequest: null, familyRequest: null, riskEventType: null, riskDetails: [], additionalDetails: [] },
        missingInformation: [],
      }),
    }
  }

  const fallback = '家属端目前可协助“联系不上老人”和“物品转交”。请告诉我您要处理哪一件事。'
  return {
    intent: 'UNKNOWN', risk: 'NORMAL', information: 'NOT_APPLICABLE', action: 'ANSWER',
    reply: fallback, draft: null, riskEventType: null, targetCaseId: null,
    nextContext: makeContext(session, {
      currentIntent: 'UNKNOWN', conversationMode: 'IDLE', lastAgentQuestion: fallback, activeCaseId: null,
    }),
  }
}
