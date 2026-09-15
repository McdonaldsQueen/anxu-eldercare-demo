export type Role = 'ELDER' | 'FAMILY' | 'STAFF'

/** Legacy values remain accepted so Phase 3.5 persisted fixtures migrate safely. */
export type CaseType =
  | 'SERVICE'
  | 'SAFETY'
  | 'FAMILY_REQUEST'
  | 'EVALUATION'
  | 'MOBILITY'
  | 'HEALTH'
  | 'DAILY_LIVING'
  | 'COMPANIONSHIP'
  | 'AFFAIRS'

export type ServiceType =
  | 'MEDICAL_ESCORT'
  | 'ACCOMPANIED_TRAVEL'
  | 'DAILY_LIVING_ASSISTANCE'
  | 'ITEM_HANDOVER'
  | 'CENTER_SERVICE_BOOKING'
  | 'CONTACT_CHECK'
  | 'FAMILY_ITEM_HANDOVER'
  | null

export type ItemType = 'GENERAL' | 'MEDICINE' | null

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
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type SafetyReviewOutcome = 'PENDING' | 'CONFIRMED' | 'FALSE_POSITIVE'
export type EvaluationDecision = 'PENDING' | 'ACCEPTED' | 'DECLINED'

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
  | 'DECLINED'
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
  requesterRole?: Extract<Role, 'ELDER' | 'FAMILY'>
  caseType: CaseType
  serviceType: ServiceType
  title?: string
  requestSummary?: string
  eventType: EventType
  detectedRiskEvents: RiskEventType[]
  latestRiskEventType: RiskEventType | null
  riskLevel: RiskLevel
  /** For unreviewed Safety Cases this backward-compatible value is AI-suggested only. */
  priority: Priority
  suggestedRiskLevel?: Priority | null
  suggestedRiskType?: RiskEventType | null
  riskSignals?: string[]
  reasoningSummary?: string | null
  finalPriority?: Priority | null
  finalRiskType?: RiskEventType | null
  safetyReviewOutcome?: SafetyReviewOutcome | null
  immediateIntervention?: boolean | null
  status: CareCaseStatus
  hospital: string | null
  appointmentTime: string | null
  destination?: string | null
  assistanceNeeded?: string | null
  itemType?: ItemType
  itemName?: string | null
  itemArrivalStatus?: 'ARRIVED' | 'NOT_ARRIVED' | 'UNKNOWN' | null
  providedDosageInstructions?: string | null
  specialInstruction?: string | null
  evaluationDecision?: EvaluationDecision | null
  evaluationReason?: string | null
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

export type ServiceCategory =
  | 'MEDICAL_ESCORT'
  | 'ACCOMPANIED_TRAVEL'
  | 'DAILY_LIVING_ASSISTANCE'
  | 'ITEM_HANDOVER'
  | 'CENTER_SERVICE_BOOKING'
  | 'EVALUATION'

export interface ServiceRequestDraft {
  subjectElderId: string | null
  serviceType: ServiceType
  category?: ServiceCategory | null
  date: string | null
  hospital: string | null
  appointmentTime: string | null
  timePeriod: 'MORNING' | 'AFTERNOON' | null
  destination?: string | null
  assistanceNeeded?: string | null
  requestSummary?: string | null
}

export interface FamilyRequestDraft {
  subjectElderId: string
  serviceType: Extract<ServiceType, 'CONTACT_CHECK' | 'FAMILY_ITEM_HANDOVER'> | null
  itemType: ItemType
  itemName: string | null
  itemArrivalStatus: 'ARRIVED' | 'NOT_ARRIVED' | 'UNKNOWN' | null
  providedDosageInstructions: string | null
  specialInstruction: string | null
  requestSummary: string | null
}

export type ConversationIntent =
  | 'SERVICE_REQUEST'
  | 'FAMILY_REQUEST'
  | 'EVALUATION_REQUEST'
  | 'STATUS_QUERY'
  | 'HELP_REQUEST'
  | 'UNKNOWN'
  | null

export type ConversationMode =
  | 'IDLE'
  | 'COLLECTING_SERVICE'
  | 'COLLECTING_FAMILY_REQUEST'
  | 'COLLECTING_EVALUATION'
  | 'ACTIVE_SERVICE'
  | 'COLLECTING_RISK'
  | 'OPEN_RISK_DESCRIPTION'
  | 'ACTIVE_RISK'

export type MissingInformation =
  | 'DATE'
  | 'HOSPITAL'
  | 'APPOINTMENT_TIME'
  | 'DESTINATION'
  | 'ASSISTANCE'
  | 'ITEM_NAME'
  | 'ITEM_ARRIVAL_STATUS'
  | 'REQUEST_GOAL'

export interface CollectedInformation {
  serviceRequest: ServiceRequestDraft | null
  familyRequest?: FamilyRequestDraft | null
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

export interface SafetyReviewInput {
  finalPriority: Priority
  finalRiskType: RiskEventType
  immediateIntervention: boolean
  falsePositive?: boolean
}
