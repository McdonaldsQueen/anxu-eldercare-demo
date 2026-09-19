import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createInitialConversationState,
  DEMO_ELDER_FAMILY_RELATIONS,
  DEMO_ELDER_PROFILES,
  DEMO_FAMILY_PROFILES,
  DEMO_INSTITUTIONS,
  DEMO_SCHEMA_VERSION,
  DEMO_STAFF_PROFILES,
} from '../data/mockData'
import { transitionSafetyCase, transitionServiceCase } from '../domain/caseStateMachine'
import { RELATIONSHIP_LABELS } from '../domain/identity'
import { interpretFamilyRequest } from '../domain/familyRequestInterpreter'
import { initialSensorSnapshot, simulateSensorReading } from '../domain/sensorRules'
import { decideElderInput } from '../domain/mockDecisionEngine'
import { OPEN_DESCRIPTION_PROMPT, RISK_CATALOG, RISK_FOLLOW_UP_LABELS } from '../domain/riskCatalog'
import type {
  CareCase,
  CareCaseStatus,
  ContactCheckRequestInput,
  ConversationMessage,
  ConversationSession,
  ConversationState,
  ElderFamilyRelation,
  ElderProfile,
  FamilyNaturalRequestInput,
  FamilyInvitationInput,
  FamilyProfile,
  Institution,
  ItemHandoverRequestInput,
  RiskEventType,
  RiskFollowUpAnswer,
  Role,
  SensorScenario,
  SensorSnapshot,
  SafetyReviewInput,
  ServiceRequestDraft,
  StaffProfile,
  TimelineEvent,
} from '../domain/models'

export const DEMO_STORAGE_KEY = 'anxu-eldercare-demo-state'

export interface DemoStateData {
  cases: Record<string, CareCase>
  institutions: Record<string, Institution>
  elderProfiles: Record<string, ElderProfile>
  familyProfiles: Record<string, FamilyProfile>
  staffProfiles: Record<string, StaffProfile>
  elderFamilyRelations: Record<string, ElderFamilyRelation>
  activeRole: Role
  activeFamilyUserId: string
  selectedFamilyElderId: string | null
  conversationState: ConversationState
  sensorSnapshots: Record<string, SensorSnapshot>
  schemaVersion: number
}

export interface DemoStore extends DemoStateData {
  setActiveRole: (role: Role) => void
  setActiveFamilyUser: (familyUserId: string) => boolean
  selectFamilyElder: (elderId: string) => boolean
  saveElderProfile: (profile: ElderProfile) => void
  inviteFamilyRelation: (input: FamilyInvitationInput) => string | null
  confirmFamilyRelation: (relationId: string) => boolean
  saveCase: (careCase: CareCase) => void
  submitElderMessage: (text: string) => void
  createFamilyContactRequest: (input: ContactCheckRequestInput) => string | null
  createFamilyItemRequest: (input: ItemHandoverRequestInput) => string | null
  createFamilyNaturalRequest: (input: FamilyNaturalRequestInput) => string | null
  simulateSensorEvent: (elderId: string, scenario: SensorScenario) => string | null
  resetSensorState: () => void
  completeFamilyRequest: (caseId: string, resolutionResult: string) => boolean
  moveEscortCase: (caseId: string, targetStatus: CareCaseStatus) => boolean
  moveServiceCase: (caseId: string, targetStatus: CareCaseStatus) => boolean
  recordRiskFollowUp: (answer: RiskFollowUpAnswer) => boolean
  reviewSafetyCase: (caseId: string, review: SafetyReviewInput) => boolean
  moveSafetyCase: (caseId: string, targetStatus: CareCaseStatus) => boolean
  confirmAndInterveneSafetyCase: (caseId: string) => boolean
  decideEvaluationCase: (caseId: string, accepted: boolean, reason?: string) => boolean
  resetDemo: () => void
  resetGoldenPathDemo: () => void
}

const cloneRecord = <T extends object>(source: Record<string, T>) =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, { ...value }])) as Record<string, T>

export const createInitialState = (): DemoStateData => ({
  cases: {},
  institutions: cloneRecord(DEMO_INSTITUTIONS),
  elderProfiles: cloneRecord(DEMO_ELDER_PROFILES),
  familyProfiles: cloneRecord(DEMO_FAMILY_PROFILES),
  staffProfiles: cloneRecord(DEMO_STAFF_PROFILES),
  elderFamilyRelations: cloneRecord(DEMO_ELDER_FAMILY_RELATIONS),
  activeRole: 'ELDER',
  activeFamilyUserId: 'F001',
  selectedFamilyElderId: null,
  conversationState: createInitialConversationState(),
  sensorSnapshots: { E001: initialSensorSnapshot('E001') },
  schemaVersion: DEMO_SCHEMA_VERSION,
})

export const createGoldenPathState = (): DemoStateData => {
  const initial = createInitialState()
  return {
    ...initial,
    activeRole: 'STAFF',
    elderFamilyRelations: {
      'REL-002': { ...DEMO_ELDER_FAMILY_RELATIONS['REL-002'] },
    },
  }
}

const isActive = (careCase: CareCase) => !['COMPLETED', 'DECLINED'].includes(careCase.status)

const nextCaseId = (cases: Record<string, CareCase>, minimum = 1) => {
  const highest = Object.keys(cases).reduce((current, id) => {
    const match = id.match(/^CASE-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `CASE-${String(Math.max(minimum, highest + 1)).padStart(3, '0')}`
}

export const createNextSafetyCaseId = (cases: Record<string, CareCase>) => nextCaseId(cases, 2)
const createServiceCaseId = (cases: Record<string, CareCase>) => cases['CASE-001'] ? nextCaseId(cases) : 'CASE-001'

const nextRelationId = (relations: Record<string, ElderFamilyRelation>) => {
  const highest = Object.keys(relations).reduce((current, id) => {
    const match = id.match(/^REL-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `REL-${String(highest + 1).padStart(3, '0')}`
}

const nextFamilyUserId = (profiles: Record<string, FamilyProfile>) => {
  const highest = Object.keys(profiles).reduce((current, id) => {
    const match = id.match(/^F(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `F${String(highest + 1).padStart(3, '0')}`
}

const createMessagePair = (
  role: Extract<Role, 'ELDER' | 'FAMILY'>,
  existingMessages: ConversationMessage[],
  text: string,
  reply: string,
  now: string,
) => {
  const prefix = role.toLowerCase()
  const nextNumber = existingMessages.length + 1
  return [
    ...existingMessages,
    { id: `${prefix}-message-${nextNumber}`, sender: 'USER' as const, text, sentAt: now },
    { id: `${prefix}-message-${nextNumber + 1}`, sender: 'ASSISTANT' as const, text: reply, sentAt: now },
  ]
}

const baseCase = (
  caseId: string,
  requesterId: string,
  requesterRole: Extract<Role, 'ELDER' | 'FAMILY'>,
  now: string,
): Pick<CareCase,
  'caseId' | 'caseSource' | 'subjectElderId' | 'requesterId' | 'requesterRole' | 'eventType' |
  'detectedRiskEvents' | 'latestRiskEventType' | 'riskLevel' | 'priority' | 'status' |
  'hospital' | 'appointmentTime' | 'assignedStaff' | 'arrivalTime' | 'selfHandling' |
  'reportedSymptoms' | 'additionalInformation' | 'reviewConfirmedAt' |
  'interventionStartedAt' | 'createdAt' | 'updatedAt' | 'timeline'
> => ({
  caseId, caseSource: requesterRole === 'FAMILY' ? 'FAMILY_REQUEST' : 'ELDER_INPUT', subjectElderId: 'E001', requesterId, requesterRole,
  eventType: null, detectedRiskEvents: [], latestRiskEventType: null,
  riskLevel: 'NORMAL', priority: 'P2', status: 'WAITING',
  hospital: null, appointmentTime: null, assignedStaff: null, arrivalTime: null,
  selfHandling: null, reportedSymptoms: [], additionalInformation: [],
  reviewConfirmedAt: null, interventionStartedAt: null,
  createdAt: now, updatedAt: now, timeline: [],
})

const createSafetyCase = (
  cases: Record<string, CareCase>,
  text: string,
  riskEventType: RiskEventType,
  evidence: string | null | undefined,
  requesterRole: Extract<Role, 'ELDER' | 'FAMILY'>,
  now: string,
) => {
  const caseId = createNextSafetyCaseId(cases)
  const definition = RISK_CATALOG[riskEventType]
  const requesterId = requesterRole === 'ELDER' ? 'E001' : 'F001'
  const reportActor = requesterRole === 'ELDER' ? '老人' : '家属'
  const careCase: CareCase = {
    ...baseCase(caseId, requesterId, requesterRole, now),
    caseType: 'SAFETY',
    serviceType: null,
    title: definition.caseTitle,
    requestSummary: text,
    eventType: riskEventType,
    detectedRiskEvents: [riskEventType],
    latestRiskEventType: riskEventType,
    riskLevel: 'CRITICAL',
    // priority is retained for Phase 3.5 display compatibility; finalPriority is authoritative.
    priority: 'P0',
    suggestedRiskLevel: 'P0',
    suggestedRiskType: riskEventType,
    riskSignals: evidence ? [evidence] : [text],
    reasoningSummary: `当前表达命中${definition.label}风险信号，按 Safety First 规则先建候选事件。`,
    finalPriority: null,
    finalRiskType: null,
    safetyReviewOutcome: 'PENDING',
    immediateIntervention: null,
    status: 'WAITING_FOR_REVIEW',
    selfHandling: riskEventType === 'FALL' && /(起不来|无法.{0,4}起身|不能.{0,4}起来)/.test(text) ? 'UNABLE' : null,
    additionalInformation: [text],
    timeline: [
      { id: `${caseId}-timeline-1`, occurredAt: now, label: `${reportActor}原始表达：${text}`, actorRole: requesterRole, statusAfter: 'WAITING_FOR_REVIEW' },
      { id: `${caseId}-timeline-2`, occurredAt: now, label: `AI 建议：${definition.label} · P0（待人工确认）`, actorRole: 'SYSTEM', statusAfter: 'WAITING_FOR_REVIEW' },
      { id: `${caseId}-timeline-3`, occurredAt: now, label: 'Safety Case 已建立并通知服务中心', actorRole: 'SYSTEM', statusAfter: 'WAITING_FOR_REVIEW' },
    ],
  }
  return careCase
}

const createElderServiceCase = (
  cases: Record<string, CareCase>,
  draft: ServiceRequestDraft,
  now: string,
) => {
  const caseId = createServiceCaseId(cases)
  const titles = {
    MEDICAL_ESCORT: '陪诊 / 就医协助',
    ACCOMPANIED_TRAVEL: '出行 / 陪同',
    DAILY_LIVING_ASSISTANCE: '日常生活协助',
    ITEM_HANDOVER: '物品代办 / 转交',
    CENTER_SERVICE_BOOKING: '养老中心服务预约',
    EVALUATION: '待评估需求',
  } as const
  const title = titles[draft.category ?? 'MEDICAL_ESCORT']
  const summary = draft.category === 'MEDICAL_ESCORT'
    ? `${draft.date} ${draft.appointmentTime} · ${draft.hospital}`
    : draft.requestSummary ?? title
  const careCase: CareCase = {
    ...baseCase(caseId, 'E001', 'ELDER', now),
    caseType: 'SERVICE',
    serviceType: draft.serviceType,
    title,
    requestSummary: summary,
    agentSummary: draft.category === 'MEDICAL_ESCORT'
      ? `老人需要陪诊：${draft.date} ${draft.appointmentTime}，前往${draft.hospital}。`
      : `老人需求：${summary}`,
    staffActionSummary: draft.category === 'MEDICAL_ESCORT'
      ? '确认就诊时间与陪同安排，接单后反馈老人。'
      : '核对需求，安排服务并反馈老人。',
    hospital: draft.hospital,
    appointmentTime: draft.category === 'MEDICAL_ESCORT'
      ? `${draft.date} ${draft.appointmentTime}`
      : [draft.date, draft.appointmentTime ?? (draft.timePeriod === 'AFTERNOON' ? '下午' : draft.timePeriod === 'MORNING' ? '上午' : null)].filter(Boolean).join(' ') || null,
    destination: draft.destination ?? null,
    assistanceNeeded: draft.assistanceNeeded ?? null,
    timeline: [
      { id: `${caseId}-timeline-1`, occurredAt: now, label: `老人提出：${title}`, actorRole: 'ELDER', statusAfter: 'WAITING' },
      { id: `${caseId}-timeline-2`, occurredAt: now, label: '安序智护已整理需求', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
      { id: `${caseId}-timeline-3`, occurredAt: now, label: '服务中心已收到', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
    ],
  }
  return careCase
}

const createFamilyContactCase = (
  cases: Record<string, CareCase>,
  input: ContactCheckRequestInput,
  relation: ElderFamilyRelation,
  institutionId: string,
  now: string,
) => {
  const caseId = createServiceCaseId(cases)
  const careCase: CareCase = {
    ...baseCase(caseId, input.requesterId, 'FAMILY', now),
    subjectElderId: input.elderId,
    relationId: relation.relationId,
    institutionId,
    caseType: 'FAMILY_REQUEST',
    familyRequestType: 'CONTACT_CHECK',
    requestType: 'UNREACHABLE_ELDER',
    serviceType: 'CONTACT_CHECK',
    title: '联系不上老人',
    requestSummary: `家属已尝试联系 ${input.contactAttempts} 次，请工作人员协助确认老人当前情况。`,
    agentSummary: `联系确认：${input.additionalNote.trim() || '家属多次联系未果'}`,
    staffActionSummary: '优先联系或现场确认老人情况，并将实际结果反馈家属。',
    priority: 'P0',
    requesterRelation: RELATIONSHIP_LABELS[relation.relationship],
    lastContactTime: input.lastContactTime,
    contactAttempts: input.contactAttempts,
    additionalNote: input.additionalNote || null,
    timeline: [
      { id: `${caseId}-timeline-1`, occurredAt: now, label: '家属提交：联系不上老人', actorRole: 'FAMILY', statusAfter: 'WAITING' },
      { id: `${caseId}-timeline-2`, occurredAt: now, label: 'P0 家属请求已送达服务中心（不代表医学急症诊断）', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
    ],
  }
  return careCase
}

const MEDICATION_ASSISTANCE_PATTERN = /(喂药|服药|吃药|用药管理|管理用药|按时.{0,6}药|提醒.{0,6}药)/

const createFamilyItemCase = (
  cases: Record<string, CareCase>,
  input: ItemHandoverRequestInput,
  relation: ElderFamilyRelation,
  institutionId: string,
  now: string,
) => {
  const caseId = createServiceCaseId(cases)
  const needsEvaluation = input.itemCategory === 'MEDICATION' || MEDICATION_ASSISTANCE_PATTERN.test(input.specialInstruction) || /(易碎|玻璃|大型|大件|不确定)/.test(`${input.itemName} ${input.specialInstruction}`)
  const careCase: CareCase = {
    ...baseCase(caseId, input.requesterId, 'FAMILY', now),
    subjectElderId: input.elderId,
    relationId: relation.relationId,
    institutionId,
    caseType: needsEvaluation ? 'EVALUATION' : 'FAMILY_REQUEST',
    familyRequestType: 'ITEM_HANDOVER',
    requestType: 'ITEM_HANDOVER',
    serviceType: 'FAMILY_ITEM_HANDOVER',
    title: needsEvaluation ? '用药协助待人工评估' : '物品转交',
    requestSummary: needsEvaluation
      ? '家属提出涉及用药协助的请求，需由工作人员评估是否承接。'
      : `转交 ${input.quantity} 件 ${input.itemName}`,
    agentSummary: `物品：${input.itemName}；说明：${input.specialInstruction || '无补充'}`,
    staffActionSummary: needsEvaluation ? '人工判断是否承接及交接条件。' : '确认物品及交接方式，完成后反馈家属。',
    reasoningSummary: needsEvaluation ? '药品、易碎、大件或不明确物品需人工判断。' : null,
    priority: 'P1',
    requesterRelation: RELATIONSHIP_LABELS[relation.relationship],
    itemType: input.itemCategory === 'MEDICATION' ? 'MEDICINE' : 'GENERAL',
    itemName: input.itemName,
    itemCategory: input.itemCategory,
    quantity: input.quantity,
    deliveryMethod: input.deliveryMethod,
    expectedDeliveryTime: input.expectedDeliveryTime,
    specialInstruction: input.specialInstruction || null,
    medicationPackageNote: input.itemCategory === 'MEDICATION'
      ? input.medicationPackageNote?.trim() || null
      : null,
    providedDosageInstructions: null,
    evaluationDecision: needsEvaluation ? 'PENDING' : null,
    timeline: [
      { id: `${caseId}-timeline-1`, occurredAt: now, label: `家属提交：${needsEvaluation ? '用药协助评估' : '物品转交'}`, actorRole: 'FAMILY', statusAfter: 'WAITING' },
      { id: `${caseId}-timeline-2`, occurredAt: now, label: needsEvaluation ? '请求不属于普通物品转交，已进入人工评估' : 'P1 物品转交请求已送达服务中心', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
    ],
  }
  return careCase
}

const createEvaluationCase = (
  cases: Record<string, CareCase>,
  draft: ServiceRequestDraft,
  now: string,
) => {
  const caseId = createServiceCaseId(cases)
  const careCase: CareCase = {
    ...baseCase(caseId, 'E001', 'ELDER', now),
    caseType: 'EVALUATION', serviceType: null, priority: 'P3',
    title: '待评估需求', requestSummary: draft.requestSummary ?? '未定义服务需求',
    evaluationDecision: 'PENDING',
    timeline: [
      { id: `${caseId}-timeline-1`, occurredAt: now, label: `老人提出：${draft.requestSummary}`, actorRole: 'ELDER', statusAfter: 'WAITING' },
      { id: `${caseId}-timeline-2`, occurredAt: now, label: '已进入待评估，等待工作人员决定', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
    ],
  }
  return careCase
}

const supplementSafety = (
  careCase: CareCase,
  text: string,
  riskEventType: RiskEventType | null,
  actorRole: Extract<Role, 'ELDER' | 'FAMILY'>,
  now: string,
) => {
  const duplicate = careCase.additionalInformation.includes(text)
  if (duplicate) return careCase
  return {
    ...careCase,
    detectedRiskEvents: riskEventType && !careCase.detectedRiskEvents.includes(riskEventType)
      ? [...careCase.detectedRiskEvents, riskEventType]
      : careCase.detectedRiskEvents,
    latestRiskEventType: riskEventType ?? careCase.latestRiskEventType,
    riskSignals: riskEventType
      ? [...(careCase.riskSignals ?? []), text]
      : careCase.riskSignals,
    additionalInformation: [...careCase.additionalInformation, text],
    updatedAt: now,
    timeline: [...careCase.timeline, {
      id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
      occurredAt: now, label: `${actorRole === 'ELDER' ? '老人' : '家属'}补充：${text}`,
      actorRole, statusAfter: careCase.status,
    }],
  }
}

const updateSession = (
  state: DemoStateData,
  role: Extract<Role, 'ELDER' | 'FAMILY'>,
  session: ConversationSession,
) => ({
  ...state.conversationState,
  [role.toLowerCase()]: session,
})

export const createDemoStore = (storageKey = DEMO_STORAGE_KEY) =>
  create<DemoStore>()(
    persist(
      (set, get) => ({
        ...createInitialState(),
        setActiveRole: (activeRole) => set({ activeRole }),
        setActiveFamilyUser: (familyUserId) => {
          if (!get().familyProfiles[familyUserId]) return false
          set({ activeFamilyUserId: familyUserId, selectedFamilyElderId: null })
          return true
        },
        selectFamilyElder: (elderId) => {
          const state = get()
          const canAccess = Object.values(state.elderFamilyRelations).some((relation) =>
            relation.elderId === elderId &&
            relation.familyUserId === state.activeFamilyUserId &&
            relation.status === 'VERIFIED')
          if (!canAccess) return false
          set({ selectedFamilyElderId: elderId })
          return true
        },
        saveElderProfile: (profile) => set((state) => ({
          elderProfiles: { ...state.elderProfiles, [profile.elderId]: profile },
        })),
        inviteFamilyRelation: (input) => {
          const state = get()
          const elder = state.elderProfiles[input.elderId]
          const staff = state.staffProfiles.S001
          const familyName = input.familyName.trim()
          const phone = input.phone.trim()
          if (
            state.activeRole !== 'STAFF' || !elder || !staff ||
            staff.institutionId !== elder.institutionId || !familyName || !phone
          ) return null
          const existingFamily = Object.values(state.familyProfiles).find((profile) =>
            profile.phone === phone || profile.name === familyName)
          const familyUserId = existingFamily?.familyUserId ?? nextFamilyUserId(state.familyProfiles)
          const familyProfile: FamilyProfile = { familyUserId, name: familyName, phone }
          const existingRelation = Object.values(state.elderFamilyRelations).find((relation) =>
            relation.elderId === input.elderId && relation.familyUserId === familyUserId && relation.status !== 'REVOKED')
          if (existingRelation?.status === 'VERIFIED') return null
          if (existingRelation?.status === 'PENDING') return existingRelation.relationId
          const now = new Date().toISOString()
          const relationId = nextRelationId(state.elderFamilyRelations)
          const relation: ElderFamilyRelation = {
            relationId,
            elderId: input.elderId,
            familyUserId,
            relationship: input.relationship,
            contactRole: input.contactRole,
            status: 'PENDING',
            createdAt: now,
            verifiedAt: null,
          }
          set((current) => ({
            familyProfiles: { ...current.familyProfiles, [familyUserId]: familyProfile },
            elderFamilyRelations: { ...current.elderFamilyRelations, [relationId]: relation },
          }))
          return relationId
        },
        confirmFamilyRelation: (relationId) => {
          const state = get()
          const relation = state.elderFamilyRelations[relationId]
          if (
            state.activeRole !== 'FAMILY' || !relation || relation.status !== 'PENDING' ||
            relation.familyUserId !== state.activeFamilyUserId
          ) return false
          const verifiedAt = new Date().toISOString()
          set((current) => ({
            elderFamilyRelations: {
              ...current.elderFamilyRelations,
              [relationId]: { ...relation, status: 'VERIFIED', verifiedAt },
            },
          }))
          return true
        },
        saveCase: (careCase) => set((state) => ({ cases: { ...state.cases, [careCase.caseId]: careCase } })),
        submitElderMessage: (rawText) => {
          const text = rawText.trim()
          if (!text) return
          const state = get()
          const session = state.conversationState.elder
          const decision = decideElderInput(text, session, state.cases)
          const now = new Date().toISOString()
          const nextSession = {
            ...decision.nextContext,
            messages: createMessagePair('ELDER', session.messages, text, decision.reply, now),
          }

          if (decision.action === 'ESCALATE' && decision.riskEventType) {
            const careCase = createSafetyCase(state.cases, text, decision.riskEventType, decision.riskEvidence, 'ELDER', now)
            nextSession.activeCaseId = careCase.caseId
            set((current) => ({
              cases: { ...current.cases, [careCase.caseId]: careCase },
              conversationState: updateSession(current, 'ELDER', nextSession),
            }))
            return
          }
          if (decision.action === 'SUPPLEMENT_CASE' && decision.targetCaseId) {
            const careCase = state.cases[decision.targetCaseId]
            if (careCase?.caseType === 'SAFETY' && isActive(careCase)) {
              const updated = supplementSafety(careCase, text, decision.riskEventType, 'ELDER', now)
              nextSession.activeCaseId = careCase.caseId
              set((current) => ({
                cases: { ...current.cases, [careCase.caseId]: updated },
                conversationState: updateSession(current, 'ELDER', nextSession),
              }))
              return
            }
          }
          if (decision.action === 'UPDATE_CASE' && decision.targetCaseId && decision.draft) {
            const careCase = state.cases[decision.targetCaseId]
            if (careCase && ['SERVICE', 'MOBILITY'].includes(careCase.caseType)) {
              const event: TimelineEvent = {
                id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`, occurredAt: now,
                label: `老人更新陪诊信息：${decision.draft.date} ${decision.draft.appointmentTime} · ${decision.draft.hospital}`,
                actorRole: 'ELDER', statusAfter: careCase.status,
              }
              const updated: CareCase = {
                ...careCase, hospital: decision.draft.hospital,
                appointmentTime: `${decision.draft.date} ${decision.draft.appointmentTime}`,
                requestSummary: `${decision.draft.date} ${decision.draft.appointmentTime} · ${decision.draft.hospital}`,
                agentSummary: `老人需要陪诊：${decision.draft.date} ${decision.draft.appointmentTime}，前往${decision.draft.hospital}。`,
                updatedAt: now, timeline: [...careCase.timeline, event],
              }
              set((current) => ({
                cases: { ...current.cases, [careCase.caseId]: updated },
                conversationState: updateSession(current, 'ELDER', nextSession),
              }))
              return
            }
          }
          if (decision.action === 'CREATE_CASE' && decision.draft) {
            const draft = decision.draft
            const appointmentTime = draft.category === 'MEDICAL_ESCORT'
              ? `${draft.date} ${draft.appointmentTime}`
              : [draft.date, draft.appointmentTime ?? (draft.timePeriod === 'AFTERNOON' ? '下午' : draft.timePeriod === 'MORNING' ? '上午' : null)].filter(Boolean).join(' ') || null
            const existing = Object.values(state.cases).find((careCase) =>
              careCase.caseSource === 'ELDER_INPUT' && careCase.subjectElderId === 'E001' &&
              careCase.caseType === 'SERVICE' && isActive(careCase) &&
              careCase.serviceType === draft.serviceType && careCase.hospital === draft.hospital &&
              careCase.appointmentTime === appointmentTime &&
              (draft.category === 'MEDICAL_ESCORT' || careCase.requestSummary === draft.requestSummary))
            if (existing) {
              nextSession.activeCaseId = existing.caseId
              set((current) => ({ conversationState: updateSession(current, 'ELDER', nextSession) }))
              return
            }
            const careCase = createElderServiceCase(state.cases, decision.draft, now)
            nextSession.activeCaseId = careCase.caseId
            set((current) => ({
              cases: { ...current.cases, [careCase.caseId]: careCase },
              conversationState: updateSession(current, 'ELDER', nextSession),
            }))
            return
          }
          if (decision.action === 'CREATE_EVALUATION' && decision.draft) {
            const careCase = createEvaluationCase(state.cases, decision.draft, now)
            nextSession.activeCaseId = null
            set((current) => ({
              cases: { ...current.cases, [careCase.caseId]: careCase },
              conversationState: updateSession(current, 'ELDER', nextSession),
            }))
            return
          }
          set((current) => ({ conversationState: updateSession(current, 'ELDER', nextSession) }))
        },
        createFamilyContactRequest: (input) => {
          if (
            !input.elderId.trim() || !input.requesterId.trim() || !input.relationId.trim() ||
            !input.lastContactTime || !Number.isInteger(input.contactAttempts) || input.contactAttempts < 1
          ) return null
          const state = get()
          const relation = state.elderFamilyRelations[input.relationId]
          const elder = state.elderProfiles[input.elderId]
          if (
            !relation || relation.status !== 'VERIFIED' || !elder ||
            relation.elderId !== input.elderId || relation.familyUserId !== input.requesterId ||
            input.requesterId !== state.activeFamilyUserId
          ) return null
          const careCase = createFamilyContactCase(state.cases, {
            ...input,
            additionalNote: input.additionalNote.trim(),
          }, relation, elder.institutionId, new Date().toISOString())
          set((current) => ({ cases: { ...current.cases, [careCase.caseId]: careCase } }))
          return careCase.caseId
        },
        createFamilyItemRequest: (input) => {
          if (
            !input.elderId.trim() || !input.requesterId.trim() || !input.itemName.trim() ||
            !input.itemCategory || !Number.isInteger(input.quantity) || input.quantity < 1 ||
            !input.deliveryMethod || !input.expectedDeliveryTime
          ) return null
          const state = get()
          const relation = state.elderFamilyRelations[input.relationId]
          const elder = state.elderProfiles[input.elderId]
          if (
            !relation || relation.status !== 'VERIFIED' || !elder ||
            relation.elderId !== input.elderId || relation.familyUserId !== input.requesterId ||
            input.requesterId !== state.activeFamilyUserId
          ) return null
          const careCase = createFamilyItemCase(state.cases, {
            ...input,
            itemName: input.itemName.trim(),
            specialInstruction: input.specialInstruction.trim(),
            medicationPackageNote: input.itemCategory === 'MEDICATION'
              ? input.medicationPackageNote?.trim()
              : undefined,
          }, relation, elder.institutionId, new Date().toISOString())
          set((current) => ({ cases: { ...current.cases, [careCase.caseId]: careCase } }))
          return careCase.caseId
        },
        createFamilyNaturalRequest: (input) => {
          const state = get()
          const relation = state.elderFamilyRelations[input.relationId]
          const elder = state.elderProfiles[input.elderId]
          const family = state.familyProfiles[input.requesterId]
          if (!input.description.trim() || !relation || relation.status !== 'VERIFIED' || !elder || !family ||
            relation.elderId !== input.elderId || relation.familyUserId !== input.requesterId ||
            state.activeFamilyUserId !== input.requesterId) return null
          const interpreted = interpretFamilyRequest(input)
          const existing = Object.values(state.cases).find((careCase) => careCase.caseSource === 'FAMILY_REQUEST' &&
            careCase.requesterId === input.requesterId && careCase.subjectElderId === input.elderId &&
            careCase.requestSummary === interpreted.description &&
            careCase.familyRequestType === (input.kind === 'OTHER' ? null : input.kind) && isActive(careCase))
          if (existing) return existing.caseId
          const now = new Date().toISOString()
          const caseId = createServiceCaseId(state.cases)
          const evaluation = interpreted.needsEvaluation
          const careCase: CareCase = {
            ...baseCase(caseId, input.requesterId, 'FAMILY', now),
            subjectElderId: input.elderId, relationId: relation.relationId,
            institutionId: elder.institutionId, requesterRelation: RELATIONSHIP_LABELS[relation.relationship],
            caseType: evaluation ? 'EVALUATION' : 'FAMILY_REQUEST',
            serviceType: input.kind === 'CONTACT_CHECK' ? 'CONTACT_CHECK' : input.kind === 'ITEM_HANDOVER' ? 'FAMILY_ITEM_HANDOVER' : null,
            familyRequestType: input.kind === 'OTHER' ? null : input.kind,
            requestType: input.kind === 'CONTACT_CHECK' ? 'UNREACHABLE_ELDER' : input.kind === 'ITEM_HANDOVER' ? 'ITEM_HANDOVER' : null,
            title: input.kind === 'CONTACT_CHECK' ? '联系确认' : input.kind === 'ITEM_HANDOVER' ? '物品转交' : '其他需求待评估',
            requestSummary: interpreted.description,
            agentSummary: `请求人：${family.name}（${RELATIONSHIP_LABELS[relation.relationship]}）；服务对象：${elder.name}（${elder.elderId}）；${interpreted.agentSummary}`,
            staffActionSummary: interpreted.staffActionSummary,
            reasoningSummary: evaluation ? interpreted.evaluationReason : null,
            priority: input.kind === 'CONTACT_CHECK' ? 'P0' : input.kind === 'ITEM_HANDOVER' ? 'P1' : 'P3',
            itemName: input.kind === 'ITEM_HANDOVER' ? interpreted.itemName : null,
            itemCategory: input.kind === 'ITEM_HANDOVER' ? interpreted.itemCategory : null,
            itemType: input.kind === 'ITEM_HANDOVER' ? interpreted.itemCategory === 'MEDICATION' ? 'MEDICINE' : 'GENERAL' : null,
            evaluationDecision: evaluation ? 'PENDING' : null,
            timeline: [
              { id: `${caseId}-timeline-1`, occurredAt: now, label: `家属提交：${interpreted.description}`, actorRole: 'FAMILY', statusAfter: 'WAITING' },
              { id: `${caseId}-timeline-2`, occurredAt: now, label: evaluation ? '规则识别到需人工判断的需求，等待工作人员评估' : '本地 Demo 助手已整理需求，送达服务中心', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
            ],
          }
          set((current) => ({ cases: { ...current.cases, [caseId]: careCase } }))
          return caseId
        },
        simulateSensorEvent: (elderId, scenario) => {
          const state = get()
          if (!state.elderProfiles[elderId]) return null
          const { snapshot, alert } = simulateSensorReading(elderId, scenario)
          if (!alert) {
            set((current) => ({ sensorSnapshots: { ...current.sensorSnapshots, [elderId]: snapshot } }))
            return null
          }
          const existing = Object.values(state.cases).find((careCase) => careCase.caseSource === 'WEARABLE_SENSOR' &&
            careCase.subjectElderId === elderId && isActive(careCase) &&
            (careCase.status === 'WAITING_FOR_REVIEW' || careCase.riskSignals?.includes(alert.text)))
          if (existing) {
            if (existing.riskSignals?.includes(alert.text)) {
              set((current) => ({ sensorSnapshots: { ...current.sensorSnapshots, [elderId]: snapshot } }))
              return existing.caseId
            }
            const now = new Date().toISOString()
            const updated: CareCase = {
              ...existing,
              requestSummary: alert.text,
              agentSummary: alert.text,
              sensorEventType: scenario === 'NORMAL' ? undefined : scenario,
              eventType: alert.riskType === 'FALL' ? 'FALL' : existing.eventType,
              suggestedRiskType: alert.riskType === 'FALL' ? 'FALL' : existing.suggestedRiskType,
              detectedRiskEvents: existing.detectedRiskEvents.includes(alert.riskType)
                ? existing.detectedRiskEvents : [...existing.detectedRiskEvents, alert.riskType],
              latestRiskEventType: alert.riskType,
              riskSignals: [...(existing.riskSignals ?? []), alert.text],
              updatedAt: now,
              timeline: [...existing.timeline, {
                id: `${existing.caseId}-timeline-${existing.timeline.length + 1}`, occurredAt: now,
                label: `安序手表补充模拟事件：${alert.text}`, actorRole: 'SYSTEM', statusAfter: existing.status,
              }],
            }
            set((current) => ({
              cases: { ...current.cases, [existing.caseId]: updated },
              sensorSnapshots: { ...current.sensorSnapshots, [elderId]: snapshot },
            }))
            return existing.caseId
          }
          const now = new Date().toISOString()
          const careCase = createSafetyCase(state.cases, alert.text, alert.riskType, alert.text, 'ELDER', now)
          careCase.caseSource = 'WEARABLE_SENSOR'
          careCase.subjectElderId = elderId
          careCase.requesterId = `DEVICE-ANXU-${elderId}`
          careCase.requesterRole = undefined
          careCase.sensorEventType = scenario === 'NORMAL' ? undefined : scenario
          careCase.title = '安序手表设备预警'
          careCase.agentSummary = alert.text
          careCase.staffActionSummary = '立即人工确认设备提示和老人实际情况，再决定介入处理。'
          careCase.reasoningSummary = 'Demo 设备模拟规则触发，读数仅供演示，不作医学诊断。'
          careCase.timeline = [
            { id: `${careCase.caseId}-timeline-1`, occurredAt: now, label: `安序手表模拟事件：${alert.text}`, actorRole: 'SYSTEM', statusAfter: 'WAITING_FOR_REVIEW' },
            { id: `${careCase.caseId}-timeline-2`, occurredAt: now, label: 'P0 Safety Case 已建立，等待工作人员人工确认', actorRole: 'SYSTEM', statusAfter: 'WAITING_FOR_REVIEW' },
          ]
          set((current) => ({ cases: { ...current.cases, [careCase.caseId]: careCase }, sensorSnapshots: { ...current.sensorSnapshots, [elderId]: snapshot } }))
          return careCase.caseId
        },
        resetSensorState: () => set({ sensorSnapshots: { E001: initialSensorSnapshot('E001') } }),
        completeFamilyRequest: (caseId, rawResolutionResult) => {
          const careCase = get().cases[caseId]
          const resolutionResult = rawResolutionResult.trim()
          if (
            !careCase || careCase.caseType !== 'FAMILY_REQUEST' ||
            careCase.status !== 'IN_PROGRESS' || get().activeRole !== 'STAFF' || !resolutionResult
          ) return false
          const now = new Date().toISOString()
          const result = transitionServiceCase(careCase, 'COMPLETED', 'STAFF', now)
          if (!result.ok) return false
          const completed: CareCase = {
            ...result.careCase,
            resolutionResult,
            resolvedAt: now,
            timeline: result.careCase.timeline.map((event, index, timeline) => index === timeline.length - 1
              ? { ...event, label: `处理结果：${resolutionResult}（已同步家属）` }
              : event),
          }
          set((state) => ({ cases: { ...state.cases, [caseId]: completed } }))
          return true
        },
        moveServiceCase: (caseId, targetStatus) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          if (careCase.caseType === 'FAMILY_REQUEST' && targetStatus === 'COMPLETED') return false
          const result = transitionServiceCase(careCase, targetStatus, get().activeRole, new Date().toISOString())
          if (!result.ok) return false
          const staffName = get().staffProfiles.S001?.name ?? '工作人员'
          const updated: CareCase = {
            ...result.careCase,
            assignedStaff: targetStatus === 'ACCEPTED' ? staffName : result.careCase.assignedStaff,
            timeline: result.careCase.timeline.map((event, index, timeline) => index === timeline.length - 1
              ? { ...event, label: event.label.replace('李师傅', staffName) }
              : event),
          }
          set((state) => ({ cases: { ...state.cases, [caseId]: updated } }))
          return true
        },
        moveEscortCase: (caseId, targetStatus) => get().moveServiceCase(caseId, targetStatus),
        recordRiskFollowUp: (answer) => {
          if (get().activeRole !== 'ELDER') return false
          const session = get().conversationState.elder
          const careCase = session.activeCaseId ? get().cases[session.activeCaseId] : undefined
          if (!careCase || careCase.caseType !== 'SAFETY' || !isActive(careCase) || careCase.reportedSymptoms.includes(answer)) return false
          const now = new Date().toISOString()
          const reportedSymptoms = answer === 'NONE_REPORTED'
            ? ['NONE_REPORTED' as const]
            : [...careCase.reportedSymptoms.filter((item) => item !== 'NONE_REPORTED'), answer]
          const event: TimelineEvent = {
            id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`, occurredAt: now,
            label: `老人补充：${RISK_FOLLOW_UP_LABELS[answer]}`, actorRole: 'ELDER', statusAfter: careCase.status,
          }
          const messages = answer === 'NONE_REPORTED'
            ? [...session.messages, { id: `elder-message-${session.messages.length + 1}`, sender: 'ASSISTANT' as const, text: OPEN_DESCRIPTION_PROMPT, sentAt: now }]
            : session.messages
          set((state) => ({
            cases: { ...state.cases, [careCase.caseId]: { ...careCase, reportedSymptoms, updatedAt: now, timeline: [...careCase.timeline, event] } },
            conversationState: {
              ...state.conversationState,
              elder: {
                ...session,
                conversationMode: answer === 'NONE_REPORTED' ? 'OPEN_RISK_DESCRIPTION' : 'ACTIVE_RISK',
                lastAgentQuestion: answer === 'NONE_REPORTED' ? OPEN_DESCRIPTION_PROMPT : session.lastAgentQuestion,
                collectedInformation: {
                  ...session.collectedInformation,
                  riskDetails: answer === 'NONE_REPORTED'
                    ? ['NONE_REPORTED']
                    : [...session.collectedInformation.riskDetails.filter((item) => item !== 'NONE_REPORTED'), answer],
                },
                messages,
              },
            },
          }))
          return true
        },
        reviewSafetyCase: (caseId, review) => {
          const careCase = get().cases[caseId]
          if (!careCase || careCase.caseType !== 'SAFETY' || careCase.status !== 'WAITING_FOR_REVIEW' || get().activeRole !== 'STAFF') return false
          const now = new Date().toISOString()
          if (review.falsePositive) {
            const reviewed: CareCase = {
              ...careCase, finalPriority: review.finalPriority, finalRiskType: review.finalRiskType,
              safetyReviewOutcome: 'FALSE_POSITIVE', immediateIntervention: false,
              status: 'COMPLETED', updatedAt: now, reviewConfirmedAt: now,
              timeline: [...careCase.timeline, {
                id: `${caseId}-timeline-${careCase.timeline.length + 1}`, occurredAt: now,
                label: `人工审核：标记为误报 / 非 Safety Case（${review.finalRiskType} · ${review.finalPriority}）`,
                actorRole: 'STAFF', statusAfter: 'COMPLETED',
              }],
            }
            set((state) => ({ cases: { ...state.cases, [caseId]: reviewed } }))
            return true
          }
          const classified: CareCase = {
            ...careCase,
            finalPriority: review.finalPriority,
            finalRiskType: review.finalRiskType,
            priority: review.finalPriority,
            safetyReviewOutcome: 'CONFIRMED',
            immediateIntervention: review.immediateIntervention,
            timeline: [...careCase.timeline, {
              id: `${caseId}-timeline-${careCase.timeline.length + 1}`, occurredAt: now,
              label: `人工分类：${review.finalRiskType} · ${review.finalPriority}${review.finalPriority !== careCase.suggestedRiskLevel || review.finalRiskType !== careCase.suggestedRiskType ? '（已修改 ' : '（接受 '}${careCase.caseSource === 'WEARABLE_SENSOR' ? '设备规则提示' : 'AI 建议'}）`,
              actorRole: 'STAFF', statusAfter: 'WAITING_FOR_REVIEW',
            }],
          }
          const confirmed = transitionSafetyCase(classified, 'CONFIRMED', 'STAFF', now)
          if (!confirmed.ok) return false
          if (!review.immediateIntervention) {
            set((state) => ({ cases: { ...state.cases, [caseId]: confirmed.careCase } }))
            return true
          }
          const inProgress = transitionSafetyCase(confirmed.careCase, 'IN_PROGRESS', 'STAFF', new Date().toISOString())
          if (!inProgress.ok) return false
          set((state) => ({ cases: { ...state.cases, [caseId]: inProgress.careCase } }))
          return true
        },
        moveSafetyCase: (caseId, targetStatus) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          const result = transitionSafetyCase(careCase, targetStatus, get().activeRole, new Date().toISOString())
          if (!result.ok) return false
          set((state) => ({
            cases: { ...state.cases, [caseId]: result.careCase },
            conversationState: targetStatus === 'COMPLETED'
              ? {
                  elder: state.conversationState.elder.activeCaseId === caseId
                    ? { ...state.conversationState.elder, currentIntent: null, conversationMode: 'IDLE', lastAgentQuestion: null, activeCaseId: null }
                    : state.conversationState.elder,
                  family: state.conversationState.family.activeCaseId === caseId
                    ? { ...state.conversationState.family, currentIntent: null, conversationMode: 'IDLE', lastAgentQuestion: null, activeCaseId: null }
                    : state.conversationState.family,
                }
              : state.conversationState,
          }))
          return true
        },
        confirmAndInterveneSafetyCase: (caseId) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          return get().reviewSafetyCase(caseId, {
            finalPriority: careCase.suggestedRiskLevel ?? 'P0',
            finalRiskType: careCase.suggestedRiskType ?? careCase.eventType ?? 'OTHER_RISK',
            immediateIntervention: true,
          })
        },
        decideEvaluationCase: (caseId, accepted, reason) => {
          const careCase = get().cases[caseId]
          if (!careCase || careCase.caseType !== 'EVALUATION' || careCase.status !== 'WAITING' || get().activeRole !== 'STAFF') return false
          if (!accepted && !reason?.trim()) return false
          const now = new Date().toISOString()
          const status = accepted ? 'WAITING' as const : 'DECLINED' as const
          const updated: CareCase = {
            ...careCase,
            caseType: accepted ? 'SERVICE' : 'EVALUATION',
            status,
            evaluationDecision: accepted ? 'ACCEPTED' : 'DECLINED',
            evaluationReason: accepted ? null : reason!.trim(),
            priority: accepted ? 'P2' : careCase.priority,
            updatedAt: now,
            timeline: [...careCase.timeline, {
              id: `${caseId}-timeline-${careCase.timeline.length + 1}`, occurredAt: now,
              label: accepted ? '工作人员评估：可以承接，已转入普通服务履约' : `工作人员评估：暂不承接。原因：${reason!.trim()}`,
              actorRole: 'STAFF', statusAfter: status,
            }],
          }
          set((state) => ({ cases: { ...state.cases, [caseId]: updated } }))
          return true
        },
        resetDemo: () => set(createInitialState()),
        resetGoldenPathDemo: () => set(createGoldenPathState()),
      }),
      {
        name: storageKey,
        version: DEMO_SCHEMA_VERSION,
        storage: createJSONStorage(() => localStorage),
        partialize: ({
          cases,
          institutions,
          elderProfiles,
          familyProfiles,
          staffProfiles,
          elderFamilyRelations,
          activeRole,
          activeFamilyUserId,
          selectedFamilyElderId,
          conversationState,
          sensorSnapshots,
          schemaVersion,
        }) => ({
          cases,
          institutions,
          elderProfiles,
          familyProfiles,
          staffProfiles,
          elderFamilyRelations,
          activeRole,
          activeFamilyUserId,
          selectedFamilyElderId,
          conversationState,
          sensorSnapshots,
          schemaVersion,
        }),
        migrate: (persistedState) => {
          const legacy = persistedState as Partial<DemoStateData>
          const initial = createInitialState()
          return {
            ...initial,
            cases: Object.fromEntries(Object.entries(legacy.cases ?? {}).map(([id, careCase]) => [id, {
              ...careCase,
              caseSource: careCase.caseSource ?? (careCase.requesterRole === 'FAMILY' ? 'FAMILY_REQUEST' : 'ELDER_INPUT'),
            }])),
            institutions: legacy.institutions ?? initial.institutions,
            elderProfiles: legacy.elderProfiles ?? initial.elderProfiles,
            familyProfiles: legacy.familyProfiles ?? initial.familyProfiles,
            staffProfiles: legacy.staffProfiles ?? initial.staffProfiles,
            elderFamilyRelations: legacy.elderFamilyRelations ?? initial.elderFamilyRelations,
            activeRole: legacy.activeRole ?? 'ELDER',
            activeFamilyUserId: legacy.activeFamilyUserId ?? initial.activeFamilyUserId,
            selectedFamilyElderId: legacy.selectedFamilyElderId ?? null,
            conversationState: legacy.conversationState ?? createInitialConversationState(),
            sensorSnapshots: legacy.sensorSnapshots ?? { E001: initialSensorSnapshot('E001') },
            schemaVersion: DEMO_SCHEMA_VERSION,
          }
        },
      },
    ),
  )

export const useDemoStore = createDemoStore()

const queueRank = (careCase: CareCase) => {
  if (careCase.caseType === 'SAFETY' && careCase.status === 'WAITING_FOR_REVIEW') return 0
  if (careCase.caseType === 'SAFETY') return 1
  if (['SERVICE', 'MOBILITY'].includes(careCase.caseType)) return 2
  if (careCase.caseType === 'FAMILY_REQUEST') return 3
  if (careCase.caseType === 'EVALUATION') return 4
  return 5
}

export const selectActiveCases = (state: DemoStore) =>
  Object.values(state.cases)
    .filter(isActive)
    .sort((a, b) => {
      const queueDifference = queueRank(a) - queueRank(b)
      if (queueDifference) return queueDifference
      const priorities = { P0: 0, P1: 1, P2: 2, P3: 3 }
      const priorityDifference = priorities[a.finalPriority ?? a.priority] - priorities[b.finalPriority ?? b.priority]
      return priorityDifference || a.createdAt.localeCompare(b.createdAt)
    })

export const selectActiveSafetyCase = (state: DemoStore) =>
  Object.values(state.cases)
    .filter((careCase) => careCase.caseType === 'SAFETY' && isActive(careCase))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

export const selectCompletedCases = (state: DemoStore) =>
  Object.values(state.cases)
    .filter((careCase) => ['COMPLETED', 'DECLINED'].includes(careCase.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

export const selectWorkload = (state: DemoStore) => {
  const cases = Object.values(state.cases)
  return {
    pending: cases.filter((careCase) => ['WAITING', 'WAITING_FOR_REVIEW'].includes(careCase.status)).length,
    inProgress: cases.filter((careCase) => ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'].includes(careCase.status)).length,
    highRisk: cases.filter((careCase) => careCase.caseType === 'SAFETY' && careCase.status !== 'COMPLETED').length,
  }
}
