export type Role = 'ELDER' | 'FAMILY' | 'STAFF'
export type CaseSource = 'ELDER_INPUT' | 'FAMILY_REQUEST' | 'WEARABLE_SENSOR' | 'OPENHEX'
export type SensorScenario = 'NORMAL' | 'HIGH_HEART_RATE' | 'LOW_SPO2' | 'HIGH_TEMPERATURE' | 'FALL'

export interface SensorSnapshot {
  elderId: string
  heartRate: number
  spo2: number
  temperature: number
  location: string
  fallDetected: boolean
  deviceOnline: boolean
  updatedAt: string
}

export interface FamilyNaturalRequestInput {
  elderId: string
  requesterId: string
  relationId: string
  kind: 'CONTACT_CHECK' | 'ITEM_HANDOVER' | 'OTHER'
  description: string
}

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

export type FamilyRequestType = 'CONTACT_CHECK' | 'ITEM_HANDOVER'

export type ItemCategory =
  | 'FOOD'
  | 'CLOTHING'
  | 'DAILY_NECESSITY'
  | 'DOCUMENT'
  | 'MEDICATION'
  | 'OTHER'

export type DeliveryMethod = 'FAMILY_DROP_OFF' | 'COURIER' | 'STAFF_PICKUP' | 'OTHER'

export interface Institution {
  institutionId: string
  name: string
}

export type ElderProfileStatus = 'IN_RESIDENCE' | 'DISCHARGED'

export interface ElderProfile {
  elderId: string
  institutionId: string
  name: string
  age: number
  room: string
  status: ElderProfileStatus
}

export interface FamilyProfile {
  familyUserId: string
  name: string
  phone: string
}

export interface StaffProfile {
  staffId: string
  institutionId: string
  name: string
}

export type FamilyRelationship = 'DAUGHTER' | 'SON' | 'SPOUSE' | 'OTHER'
export type FamilyContactRole = 'PRIMARY_CONTACT' | 'EMERGENCY_CONTACT' | 'FAMILY_MEMBER'
export type ElderFamilyRelationStatus = 'PENDING' | 'VERIFIED' | 'REVOKED'

export interface ElderFamilyRelation {
  relationId: string
  elderId: string
  familyUserId: string
  relationship: FamilyRelationship
  contactRole: FamilyContactRole
  status: ElderFamilyRelationStatus
  createdAt: string
  verifiedAt: string | null
}

export interface FamilyInvitationInput {
  elderId: string
  familyName: string
  phone: string
  relationship: FamilyRelationship
  contactRole: FamilyContactRole
}

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
  caseSource: CaseSource
  agentSummary?: string | null
  staffActionSummary?: string | null
  sensorEventType?: Exclude<SensorScenario, 'NORMAL'>
  subjectElderId: string
  requesterId: string
  requesterRole?: Extract<Role, 'ELDER' | 'FAMILY'>
  relationId?: string | null
  institutionId?: string | null
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
  familyRequestType?: FamilyRequestType | null
  requestType?: 'UNREACHABLE_ELDER' | 'ITEM_HANDOVER' | null
  requesterRelation?: string | null
  lastContactTime?: string | null
  contactAttempts?: number | null
  additionalNote?: string | null
  itemCategory?: ItemCategory | null
  quantity?: number | null
  deliveryMethod?: DeliveryMethod | null
  expectedDeliveryTime?: string | null
  medicationPackageNote?: string | null
  resolutionResult?: string | null
  resolvedAt?: string | null
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

export interface ContactCheckRequestInput {
  elderId: string
  requesterId: string
  relationId: string
  lastContactTime: string
  contactAttempts: number
  additionalNote: string
}

export interface ItemHandoverRequestInput {
  elderId: string
  requesterId: string
  relationId: string
  itemName: string
  itemCategory: ItemCategory
  quantity: number
  deliveryMethod: DeliveryMethod
  expectedDeliveryTime: string
  specialInstruction: string
  medicationPackageNote?: string
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
