import type { ChatMessage } from '@openhex-ai/agent-sdk/react'
import type { ServiceType } from '../domain/models'

export interface ConfirmedOpenhexCase {
  caseId: string
  caseType: 'SERVICE' | 'EVALUATION'
  title: string
  requestSummary: string
  serviceType: ServiceType
  hospital: string | null
  appointmentTime: string | null
}

const CASE_ID = /\bCASE-\d{8}-\d{3,}\b/i
const CREATE_ORDER_TOOL = /create[\s_-]?(?:work[\s_-]?)?order|createorder[\s_-]?worker|创建工单/i
const SUCCESS_REPLY = /(?:已|成功).{0,16}(?:创建|生成|提交).{0,12}(?:工单|订单)|(?:工单|订单).{0,16}(?:已创建|创建成功|已生成|生成成功|已提交|提交成功)/
const FAILED_REPLY = /(?:创建|生成|提交)(?:工单|订单).{0,12}(?:失败|未成功|未完成)|(?:工单|订单).{0,12}(?:创建失败|未创建|创建未成功|尚未创建|无法创建)|(?:无法|不能|未能|没能)(?:创建|生成|提交)(?:工单|订单)/

const firstString = (input: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

const serviceTypeOf = (input: Record<string, unknown>, text: string): ServiceType => {
  const category = firstString(input, 'serviceType', 'service_type', 'category', 'type') ?? ''
  const combined = `${category} ${text}`
  if (/陪诊|就医|医院|MEDICAL_ESCORT/i.test(combined)) return 'MEDICAL_ESCORT'
  if (/出行|陪同|ACCOMPANIED_TRAVEL/i.test(combined)) return 'ACCOMPANIED_TRAVEL'
  if (/物品|转交|ITEM_HANDOVER/i.test(combined)) return 'ITEM_HANDOVER'
  if (/预约|CENTER_SERVICE_BOOKING/i.test(combined)) return 'CENTER_SERVICE_BOOKING'
  if (/日常|生活|照护|洗澡|洗衣|DAILY_LIVING_ASSISTANCE/i.test(combined)) return 'DAILY_LIVING_ASSISTANCE'
  return null
}

/** Import only a completed Agent confirmation with an order number; tool input enriches it when available. */
export function confirmedOpenhexCases(messages: ChatMessage[]): ConfirmedOpenhexCase[] {
  const found = new Map<string, ConfirmedOpenhexCase>()
  for (const message of messages) {
    if (message.role !== 'assistant' || message.pending || message.streaming || message.error) continue
    const tool = message.toolCalls?.find((call) => CREATE_ORDER_TOOL.test(call.name))
    const caseId = (message.text.match(CASE_ID)?.[0] ?? '').toUpperCase()
    if (!caseId || FAILED_REPLY.test(message.text) || (!tool && !SUCCESS_REPLY.test(message.text))) continue

    const input = tool?.input ?? {}
    const serviceType = serviceTypeOf(input, message.text)
    const title = serviceType === 'MEDICAL_ESCORT' ? '陪诊 / 就医协助'
      : serviceType === 'ACCOMPANIED_TRAVEL' ? '出行 / 陪同'
        : serviceType === 'ITEM_HANDOVER' ? '物品代办 / 转交'
          : serviceType === 'CENTER_SERVICE_BOOKING' ? '养老中心服务预约'
            : serviceType === 'DAILY_LIVING_ASSISTANCE' ? '日常生活协助' : '待评估需求'
    const requestSummary = firstString(input, 'requestSummary', 'request_summary', 'description', 'summary', 'requirement')
      ?? message.text.replace(/https?:\/\/\S+/g, '').trim().slice(0, 240)
    found.set(caseId, {
      caseId,
      caseType: serviceType ? 'SERVICE' : 'EVALUATION',
      title,
      requestSummary,
      serviceType,
      hospital: firstString(input, 'hospital', 'hospital_name'),
      appointmentTime: firstString(input, 'appointmentTime', 'appointment_time', 'time', 'date'),
    })
  }
  return [...found.values()]
}

export function elderFacingAgentText(text: string) {
  return text
    .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*(?:feishu\.cn|larksuite\.com)[^)]*\)/gi, '$1')
    .replace(/https?:\/\/\S*(?:feishu\.cn|larksuite\.com)\S*/gi, '')
    .trim()
}
