import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createInitialConversationState, DEMO_SCHEMA_VERSION } from '../data/mockData'
import { transitionEscortCase, transitionSafetyCase } from '../domain/caseStateMachine'
import { decideElderInput } from '../domain/mockDecisionEngine'
import { OPEN_DESCRIPTION_PROMPT, RISK_CATALOG, RISK_FOLLOW_UP_LABELS } from '../domain/riskCatalog'
import type {
  CareCase,
  CareCaseStatus,
  ConversationMessage,
  ConversationState,
  RiskFollowUpAnswer,
  Role,
  TimelineEvent,
} from '../domain/models'

export const DEMO_STORAGE_KEY = 'anxu-eldercare-demo-state'

export interface DemoStateData {
  cases: Record<string, CareCase>
  activeRole: Role
  conversationState: ConversationState
  schemaVersion: number
}

export interface DemoStore extends DemoStateData {
  setActiveRole: (role: Role) => void
  saveCase: (careCase: CareCase) => void
  submitElderMessage: (text: string) => void
  moveEscortCase: (caseId: string, targetStatus: CareCaseStatus) => boolean
  recordRiskFollowUp: (answer: RiskFollowUpAnswer) => boolean
  moveSafetyCase: (caseId: string, targetStatus: CareCaseStatus) => boolean
  confirmAndInterveneSafetyCase: (caseId: string) => boolean
  resetDemo: () => void
}

export const createInitialState = (): DemoStateData => ({
  cases: {},
  activeRole: 'ELDER',
  conversationState: createInitialConversationState(),
  schemaVersion: DEMO_SCHEMA_VERSION,
})

const isActive = (careCase: CareCase) => careCase.status !== 'COMPLETED'

const latestActiveSafetyCase = (cases: Record<string, CareCase>) =>
  Object.values(cases)
    .filter((careCase) => careCase.caseType === 'SAFETY' && isActive(careCase))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

const nextCaseId = (cases: Record<string, CareCase>, minimum: number) => {
  const highest = Object.keys(cases).reduce((current, id) => {
    const match = id.match(/^CASE-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  const number = Math.max(minimum, highest + 1)
  return `CASE-${String(number).padStart(3, '0')}`
}

export const createNextSafetyCaseId = (cases: Record<string, CareCase>) =>
  nextCaseId(cases, 2)

const createEscortCaseId = (cases: Record<string, CareCase>) =>
  cases['CASE-001'] ? nextCaseId(cases, 1) : 'CASE-001'

const createMessagePair = (
  existingMessages: ConversationMessage[],
  text: string,
  reply: string,
  now: string,
) => {
  const nextNumber = existingMessages.length + 1
  return [
    ...existingMessages,
    { id: `elder-message-${nextNumber}`, sender: 'USER' as const, text, sentAt: now },
    { id: `elder-message-${nextNumber + 1}`, sender: 'ASSISTANT' as const, text: reply, sentAt: now },
  ]
}

export const createDemoStore = (storageKey = DEMO_STORAGE_KEY) =>
  create<DemoStore>()(
    persist(
      (set, get) => ({
        ...createInitialState(),
        setActiveRole: (activeRole) => set({ activeRole }),
        saveCase: (careCase) => set((state) => ({
          cases: { ...state.cases, [careCase.caseId]: careCase },
        })),
        submitElderMessage: (rawText) => {
          const text = rawText.trim()
          if (!text) return

          const state = get()
          const session = state.conversationState.elder
          const decision = decideElderInput(text, session, state.cases)
          const now = new Date().toISOString()
          const messages = createMessagePair(session.messages, text, decision.reply, now)
          const nextSession = { ...decision.nextContext, messages }

          if (decision.action === 'ESCALATE' && decision.riskEventType) {
            const existingSafetyCase = latestActiveSafetyCase(state.cases)
            if (existingSafetyCase) {
              set((current) => ({
                conversationState: {
                  ...current.conversationState,
                  elder: { ...nextSession, activeCaseId: existingSafetyCase.caseId },
                },
              }))
              return
            }

            const caseId = createNextSafetyCaseId(state.cases)
            const definition = RISK_CATALOG[decision.riskEventType]
            const safetyTimeline: TimelineEvent[] = [
              {
                id: `${caseId}-timeline-1`, occurredAt: now,
                label: definition.reportSummary, actorRole: 'ELDER',
                statusAfter: 'WAITING_FOR_REVIEW',
              },
              {
                id: `${caseId}-timeline-2`, occurredAt: now,
                label: `安序智护识别${definition.label}风险`, actorRole: 'SYSTEM',
                statusAfter: 'WAITING_FOR_REVIEW',
              },
              {
                id: `${caseId}-timeline-3`, occurredAt: now,
                label: '安全事件已建立并通知服务中心', actorRole: 'SYSTEM',
                statusAfter: 'WAITING_FOR_REVIEW',
              },
            ]
            const safetyCase: CareCase = {
              caseId,
              subjectElderId: nextSession.currentSubject,
              requesterId: 'E001',
              caseType: 'SAFETY',
              serviceType: null,
              eventType: decision.riskEventType,
              detectedRiskEvents: [decision.riskEventType],
              latestRiskEventType: decision.riskEventType,
              riskLevel: 'CRITICAL',
              priority: 'P0',
              status: 'WAITING_FOR_REVIEW',
              hospital: null,
              appointmentTime: null,
              assignedStaff: null,
              arrivalTime: null,
              selfHandling:
                decision.riskEventType === 'FALL' && /(起不来|无法.{0,4}起身|不能.{0,4}起来)/.test(text)
                  ? 'UNABLE'
                  : null,
              reportedSymptoms: [],
              additionalInformation: [text],
              reviewConfirmedAt: null,
              interventionStartedAt: null,
              createdAt: now,
              updatedAt: now,
              timeline: safetyTimeline,
            }

            set((current) => ({
              cases: { ...current.cases, [caseId]: safetyCase },
              conversationState: {
                ...current.conversationState,
                elder: { ...nextSession, activeCaseId: caseId },
              },
            }))
            return
          }

          if (decision.action === 'SUPPLEMENT_CASE' && decision.targetCaseId) {
            const careCase = state.cases[decision.targetCaseId]
            if (careCase?.caseType === 'SAFETY' && careCase.status !== 'COMPLETED') {
              const isDuplicate = careCase.additionalInformation.includes(text)
              const detectedRiskEvents = decision.riskEventType && !careCase.detectedRiskEvents.includes(decision.riskEventType)
                ? [...careCase.detectedRiskEvents, decision.riskEventType]
                : careCase.detectedRiskEvents
              const timelineEvent: TimelineEvent = {
                id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
                occurredAt: now,
                label: `老人补充：${text}`,
                actorRole: 'ELDER',
                statusAfter: careCase.status,
              }
              const updatedCase: CareCase = {
                ...careCase,
                detectedRiskEvents,
                latestRiskEventType: decision.riskEventType ?? careCase.latestRiskEventType,
                additionalInformation: isDuplicate
                  ? careCase.additionalInformation
                  : [...careCase.additionalInformation, text],
                updatedAt: isDuplicate ? careCase.updatedAt : now,
                timeline: isDuplicate ? careCase.timeline : [...careCase.timeline, timelineEvent],
              }
              set((current) => ({
                cases: { ...current.cases, [careCase.caseId]: updatedCase },
                conversationState: { ...current.conversationState, elder: nextSession },
              }))
              return
            }
          }

          if (decision.action === 'UPDATE_CASE' && decision.targetCaseId && decision.draft) {
            const careCase = state.cases[decision.targetCaseId]
            if (careCase?.caseType === 'MOBILITY') {
              const event: TimelineEvent = {
                id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
                occurredAt: now,
                label: `老人更新陪诊信息：${decision.draft.date} ${decision.draft.appointmentTime} · ${decision.draft.hospital}`,
                actorRole: 'ELDER',
                statusAfter: careCase.status,
              }
              set((current) => ({
                cases: {
                  ...current.cases,
                  [careCase.caseId]: {
                    ...careCase,
                    hospital: decision.draft?.hospital ?? careCase.hospital,
                    appointmentTime: `${decision.draft?.date} ${decision.draft?.appointmentTime}`,
                    updatedAt: now,
                    timeline: [...careCase.timeline, event],
                  },
                },
                conversationState: { ...current.conversationState, elder: nextSession },
              }))
              return
            }
          }

          if (decision.action === 'CREATE_CASE' && decision.draft) {
            const existing = Object.values(state.cases).find(
              (careCase) => careCase.caseType === 'MOBILITY' && careCase.status !== 'COMPLETED',
            )
            if (!existing) {
              const caseId = createEscortCaseId(state.cases)
              const firstRequestAt = session.messages.find((message) => message.sender === 'USER')?.sentAt ?? now
              const timeline: TimelineEvent[] = [
                { id: `${caseId}-timeline-1`, occurredAt: firstRequestAt, label: '您提出陪诊需求', actorRole: 'ELDER', statusAfter: 'WAITING' },
                { id: `${caseId}-timeline-2`, occurredAt: now, label: '安序智护已整理需求', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
                { id: `${caseId}-timeline-3`, occurredAt: now, label: '服务中心已收到', actorRole: 'SYSTEM', statusAfter: 'WAITING' },
              ]
              const careCase: CareCase = {
                caseId,
                subjectElderId: decision.draft.subjectElderId ?? 'E001',
                requesterId: 'E001',
                caseType: 'MOBILITY',
                serviceType: 'MEDICAL_ESCORT',
                eventType: null,
                detectedRiskEvents: [],
                latestRiskEventType: null,
                riskLevel: 'NORMAL',
                priority: 'P2',
                status: 'WAITING',
                hospital: decision.draft.hospital,
                appointmentTime: `${decision.draft.date} ${decision.draft.appointmentTime}`,
                assignedStaff: null,
                arrivalTime: null,
                selfHandling: null,
                reportedSymptoms: [],
                additionalInformation: [],
                reviewConfirmedAt: null,
                interventionStartedAt: null,
                createdAt: now,
                updatedAt: now,
                timeline,
              }
              set((current) => ({
                cases: { ...current.cases, [caseId]: careCase },
                conversationState: {
                  ...current.conversationState,
                  elder: { ...nextSession, activeCaseId: caseId },
                },
              }))
              return
            }
          }

          set((current) => ({
            conversationState: { ...current.conversationState, elder: nextSession },
          }))
        },
        moveEscortCase: (caseId, targetStatus) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          const result = transitionEscortCase(careCase, targetStatus, get().activeRole, new Date().toISOString())
          if (!result.ok) return false
          set((state) => ({ cases: { ...state.cases, [caseId]: result.careCase } }))
          return true
        },
        recordRiskFollowUp: (answer) => {
          if (get().activeRole !== 'ELDER') return false
          const careCase = latestActiveSafetyCase(get().cases)
          if (!careCase || careCase.reportedSymptoms.includes(answer)) return false

          const reportedSymptoms = answer === 'NONE_REPORTED'
            ? ['NONE_REPORTED' as const]
            : [...careCase.reportedSymptoms.filter((item) => item !== 'NONE_REPORTED'), answer]
          const now = new Date().toISOString()
          const event: TimelineEvent = {
            id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
            occurredAt: now,
            label: `老人补充：${RISK_FOLLOW_UP_LABELS[answer]}`,
            actorRole: 'ELDER',
            statusAfter: careCase.status,
          }
          const session = get().conversationState.elder
          const riskDetails = answer === 'NONE_REPORTED'
            ? ['NONE_REPORTED' as const]
            : [...session.collectedInformation.riskDetails.filter((item) => item !== 'NONE_REPORTED'), answer]
          const messages = answer === 'NONE_REPORTED'
            ? [
                ...session.messages,
                {
                  id: `elder-message-${session.messages.length + 1}`,
                  sender: 'ASSISTANT' as const,
                  text: OPEN_DESCRIPTION_PROMPT,
                  sentAt: now,
                },
              ]
            : session.messages

          set((state) => ({
            cases: {
              ...state.cases,
              [careCase.caseId]: {
                ...careCase,
                reportedSymptoms,
                updatedAt: now,
                timeline: [...careCase.timeline, event],
              },
            },
            conversationState: {
              ...state.conversationState,
              elder: {
                ...session,
                conversationMode: answer === 'NONE_REPORTED' ? 'OPEN_RISK_DESCRIPTION' : 'ACTIVE_RISK',
                lastAgentQuestion: answer === 'NONE_REPORTED' ? OPEN_DESCRIPTION_PROMPT : session.lastAgentQuestion,
                activeCaseId: careCase.caseId,
                collectedInformation: {
                  ...session.collectedInformation,
                  riskDetails,
                },
                messages,
              },
            },
          }))
          return true
        },
        moveSafetyCase: (caseId, targetStatus) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          const result = transitionSafetyCase(careCase, targetStatus, get().activeRole, new Date().toISOString())
          if (!result.ok) return false
          set((state) => {
            const session = state.conversationState.elder
            const shouldCloseContext = targetStatus === 'COMPLETED' && session.activeCaseId === caseId
            return {
              cases: { ...state.cases, [caseId]: result.careCase },
              conversationState: shouldCloseContext
                ? {
                    ...state.conversationState,
                    elder: {
                      ...session,
                      currentIntent: null,
                      conversationMode: 'IDLE',
                      lastAgentQuestion: null,
                      activeCaseId: null,
                    },
                  }
                : state.conversationState,
            }
          })
          return true
        },
        confirmAndInterveneSafetyCase: (caseId) => {
          const careCase = get().cases[caseId]
          if (!careCase) return false
          const actorRole = get().activeRole
          const confirmed = transitionSafetyCase(careCase, 'CONFIRMED', actorRole, new Date().toISOString())
          if (!confirmed.ok) return false
          const inProgress = transitionSafetyCase(confirmed.careCase, 'IN_PROGRESS', actorRole, new Date().toISOString())
          if (!inProgress.ok) return false
          set((state) => ({ cases: { ...state.cases, [caseId]: inProgress.careCase } }))
          return true
        },
        resetDemo: () => set(createInitialState()),
      }),
      {
        name: storageKey,
        version: DEMO_SCHEMA_VERSION,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ cases, activeRole, conversationState, schemaVersion }) => ({ cases, activeRole, conversationState, schemaVersion }),
        migrate: () => createInitialState(),
      },
    ),
  )

export const useDemoStore = createDemoStore()

const unfinishedStatuses = new Set(['WAITING', 'ACCEPTED', 'WAITING_FOR_REVIEW', 'CONFIRMED', 'IN_PROGRESS'])

export const selectActiveCases = (state: DemoStore) =>
  Object.values(state.cases)
    .filter((careCase) => unfinishedStatuses.has(careCase.status))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'P0' ? -1 : 1
      return a.createdAt.localeCompare(b.createdAt)
    })

export const selectActiveSafetyCase = (state: DemoStore) =>
  latestActiveSafetyCase(state.cases)

export const selectCompletedCases = (state: DemoStore) =>
  Object.values(state.cases)
    .filter((careCase) => careCase.status === 'COMPLETED')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

export const selectWorkload = (state: DemoStore) => {
  const cases = Object.values(state.cases)
  return {
    pending: cases.filter((careCase) => ['WAITING', 'WAITING_FOR_REVIEW'].includes(careCase.status)).length,
    inProgress: cases.filter((careCase) => ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'].includes(careCase.status)).length,
    highRisk: cases.filter((careCase) => careCase.priority === 'P0' && careCase.status !== 'COMPLETED').length,
  }
}
