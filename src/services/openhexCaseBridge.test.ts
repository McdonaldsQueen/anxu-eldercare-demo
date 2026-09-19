import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@openhex-ai/agent-sdk/react'
import { confirmedOpenhexCases, elderFacingAgentText } from './openhexCaseBridge'

const assistant = (text: string, toolCalls?: ChatMessage['toolCalls']): ChatMessage => ({
  id: 'assistant-1', role: 'assistant', text, createdAt: Date.now(), toolCalls,
})

describe('OpenHex Case bridge', () => {
  it('imports an externally created order only when history confirms the create-order tool', () => {
    const reply = assistant('已创建工单 CASE-20260919-002。', [{
      name: 'createorder-worker',
      input: { service_type: 'MEDICAL_ESCORT', hospital: '朝阳医院', appointment_time: '明日 14:30', description: '老人需要陪诊' },
    }])
    expect(confirmedOpenhexCases([reply])).toEqual([{
      caseId: 'CASE-20260919-002', caseType: 'SERVICE', title: '陪诊 / 就医协助', serviceType: 'MEDICAL_ESCORT',
      requestSummary: '老人需要陪诊', hospital: '朝阳医院', appointmentTime: '明日 14:30',
    }])
    expect(confirmedOpenhexCases([reply, reply])).toHaveLength(1)
  })

  it('accepts an explicit success receipt when a Skill has no visible tool call', () => {
    expect(confirmedOpenhexCases([assistant('陪诊工单已创建：CASE-20260919-002。')]))
      .toMatchObject([{ caseId: 'CASE-20260919-002', caseType: 'SERVICE', serviceType: 'MEDICAL_ESCORT' }])
    expect(confirmedOpenhexCases([assistant('已创建工单 CASE-20260919-004。')]))
      .toMatchObject([{ caseId: 'CASE-20260919-004', caseType: 'EVALUATION', serviceType: null }])
  })

  it('rejects a bare number, a failed order, and an unfinished reply', () => {
    const text = '已创建工单 CASE-20260919-002。'
    expect(confirmedOpenhexCases([assistant('请查看 CASE-20260919-002')])).toEqual([])
    expect(confirmedOpenhexCases([assistant('创建工单失败 CASE-20260919-002', [{ name: 'createorder-worker', input: {} }])])).toEqual([])
    expect(confirmedOpenhexCases([assistant('工单创建未成功 CASE-20260919-002', [{ name: 'createorder-worker', input: {} }])])).toEqual([])
    expect(confirmedOpenhexCases([{ ...assistant(text, [{ name: 'createorder-worker', input: {} }]), streaming: true }])).toEqual([])
  })

  it('keeps the case number but removes Feishu links from elder-facing text', () => {
    expect(elderFacingAgentText('工单 CASE-20260919-002 [飞书记录](https://example.feishu.cn/base/abc)'))
      .toBe('工单 CASE-20260919-002 飞书记录')
  })
})
