import type {
  ConversationState,
  ElderFamilyRelation,
  ElderProfile,
  FamilyProfile,
  Institution,
  Role,
  StaffProfile,
} from '../domain/models'

export const DEMO_SCHEMA_VERSION = 7

export const DEMO_INSTITUTIONS: Record<string, Institution> = {
  I001: { institutionId: 'I001', name: '安序养老服务中心' },
}

export const DEMO_ELDER_PROFILES: Record<string, ElderProfile> = {
  E001: {
    elderId: 'E001',
    institutionId: 'I001',
    name: '王秀兰',
    age: 82,
    room: '302',
    status: 'IN_RESIDENCE',
  },
}

export const DEMO_FAMILY_PROFILES: Record<string, FamilyProfile> = {
  F001: { familyUserId: 'F001', name: '李晓雯', phone: '13800000001' },
  F002: { familyUserId: 'F002', name: '王志远', phone: '13800000002' },
}

export const DEMO_STAFF_PROFILES: Record<string, StaffProfile> = {
  S001: { staffId: 'S001', institutionId: 'I001', name: '陈静' },
}

export const DEMO_ELDER_FAMILY_RELATIONS: Record<string, ElderFamilyRelation> = {
  'REL-001': {
    relationId: 'REL-001', elderId: 'E001', familyUserId: 'F001',
    relationship: 'DAUGHTER', contactRole: 'PRIMARY_CONTACT', status: 'VERIFIED',
    createdAt: '2026-09-01T09:00:00+08:00', verifiedAt: '2026-09-01T09:05:00+08:00',
  },
  'REL-002': {
    relationId: 'REL-002', elderId: 'E001', familyUserId: 'F002',
    relationship: 'SON', contactRole: 'EMERGENCY_CONTACT', status: 'VERIFIED',
    createdAt: '2026-09-01T09:10:00+08:00', verifiedAt: '2026-09-01T09:15:00+08:00',
  },
}

export const PEOPLE = {
  elder: { id: 'E001', name: '王秀兰', role: 'ELDER' as Role },
  family: {
    id: 'F001',
    name: '李晓雯',
    fullName: '李晓雯',
    role: 'FAMILY' as Role,
    boundElderId: 'E001',
    relationship: '女儿',
  },
  staff: { id: 'S001', name: '陈静', role: 'STAFF' as Role },
} as const

export const ROLE_LABELS: Record<Role, string> = {
  ELDER: '王秀兰（老人）',
  FAMILY: '李晓雯（家属）',
  STAFF: '陈静（工作人员）',
}

export const ROLE_HOME: Record<Role, string> = {
  ELDER: '/elder',
  FAMILY: '/family',
  STAFF: '/staff',
}

export const DAILY_ACTIVITIES = [
  { id: 'breakfast', time: '08:35', label: '早餐已送达' },
  { id: 'check-in', time: '10:20', label: '上午健康问候完成' },
] as const

const emptySession = () => ({
  currentIntent: null,
  currentSubject: 'E001',
  conversationMode: 'IDLE' as const,
  lastAgentQuestion: null,
  collectedInformation: {
    serviceRequest: null,
    familyRequest: null,
    riskEventType: null,
    riskDetails: [],
    additionalDetails: [],
  },
  missingInformation: [],
  activeCaseId: null,
  messages: [],
})

export const createInitialConversationState = (): ConversationState => ({
  elder: emptySession(),
  family: emptySession(),
})
