import type { ConversationState, Role } from '../domain/models'

export const DEMO_SCHEMA_VERSION = 4

export const PEOPLE = {
  elder: { id: 'E001', name: '王阿姨', role: 'ELDER' as Role },
  family: {
    id: 'F001',
    name: '女儿',
    fullName: '王阿姨女儿',
    role: 'FAMILY' as Role,
    boundElderId: 'E001',
    relationship: '女儿',
  },
  staff: { id: 'S001', name: '李师傅', role: 'STAFF' as Role },
} as const

export const ROLE_LABELS: Record<Role, string> = {
  ELDER: '王阿姨（老人）',
  FAMILY: '女儿（家属）',
  STAFF: '李师傅（服务人员）',
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
