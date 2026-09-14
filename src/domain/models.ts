export type Role = 'ELDER' | 'FAMILY' | 'STAFF'

export type CaseType =
  | 'SAFETY'
  | 'HEALTH'
  | 'DAILY_LIVING'
  | 'MOBILITY'
  | 'COMPANIONSHIP'
  | 'AFFAIRS'

export type ServiceType = 'MEDICAL_ESCORT' | null

export type RiskEventType =
  | 'FALL'
  | 'BREATHING_DIFFICULTY'
  | 'BLEEDING'
  | 'SUDDEN_DIZZINESS'
  | 'LOSS_OF_CONSCIOUSNESS'
  | 'ENVIRONMENT_HAZARD'
  | 'LOST_OR_MISSING'
  | 'OTHER_RISK'

export type EventType = RiskEventType | null
export type RiskLevel = 'NORMAL' | 'CRITICAL'
export type Priority = 'P0' | 'P2'

export type RiskFollowUpAnswer =
  | 'BLEEDING'
  | 'SEVERE_PAIN'
  | 'DIZZINESS'
  | 'CANNOT_STAND'
  | 'CHEST_DISCOMFORT'
  | 'CANNOT_SPEAK'
  | 'BLEEDING_CONTINUES'
  | 'LARGE_AMOUNT'
  | 'NAUSEA'
  | 'NOW_AWAKE'
  | 'BREATHING_ABNORMAL'
  | 'INJURY'
  | 'FIRE_OR_SMOKE'
  | 'GAS_ODOR'
  | 'ELECTRICAL_DANGER'
  | 'SAFE_LOCATION'
  | 'UNKNOWN_LOCATION'
  | 'PHONE_LOW_BATTERY'
  | 'IMMEDIATE_DANGER'
  | 'NEEDS_HELP'
  | 'NONE_REPORTED'

export type CareCaseStatus =
  | 'WAITING'
  | 'ACCEPTED'
  | 'WAITING_FOR_REVIEW'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export interface TimelineEvent {
  id: string
  occurredAt: string
  label: string
  actorRole: Role | 'SYSTEM'
  statusAfter: CareCaseStatus
}

export interface CareCase {
  caseId: string
  subjectElderId: string
  requesterId: string
  caseType: CaseType
  serviceType: ServiceType
  eventType: EventType
  detectedRiskEvents: RiskEventType[]
  latestRiskEventType: RiskEventType | null
  riskLevel: RiskLevel
  priority: Priority
  status: CareCaseStatus
  hospital: string | null
  appointmentTime: string | null
  assignedStaff: string | null
  arrivalTime: string | null
  selfHandling: 'UNABLE' | null
  reportedSymptoms: RiskFollowUpAnswer[]
  additionalInformation: string[]
  reviewConfirmedAt: string | null
  interventionStartedAt: string | null
  createdAt: string
  updatedAt: string
  timeline: TimelineEvent[]
}

export interface ConversationMessage {
  id: string
  sender: 'USER' | 'ASSISTANT'
  text: string
  sentAt: string
}

export interface ServiceRequestDraft {
  subjectElderId: string | null
  serviceType: ServiceType
  date: string | null
  hospital: string | null
  appointmentTime: string | null
  timePeriod: 'MORNING' | 'AFTERNOON' | null
}

export type ConversationIntent =
  | 'SERVICE_REQUEST'
  | 'STATUS_QUERY'
  | 'HELP_REQUEST'
  | 'UNKNOWN'
  | null

export type ConversationMode =
  | 'IDLE'
  | 'COLLECTING_SERVICE'
  | 'ACTIVE_SERVICE'
  | 'COLLECTING_RISK'
  | 'OPEN_RISK_DESCRIPTION'
  | 'ACTIVE_RISK'

export type MissingInformation = 'DATE' | 'HOSPITAL' | 'APPOINTMENT_TIME'

export interface CollectedInformation {
  serviceRequest: ServiceRequestDraft | null
  riskEventType: RiskEventType | null
  riskDetails: RiskFollowUpAnswer[]
  additionalDetails: string[]
}

export interface ConversationSession {
  currentIntent: ConversationIntent
  currentSubject: string
  conversationMode: ConversationMode
  lastAgentQuestion: string | null
  collectedInformation: CollectedInformation
  missingInformation: MissingInformation[]
  activeCaseId: string | null
  messages: ConversationMessage[]
}

export interface ConversationState {
  elder: ConversationSession
  family: ConversationSession
}
