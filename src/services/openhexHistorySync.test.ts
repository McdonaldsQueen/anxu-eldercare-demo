import { describe, expect, it } from 'vitest'
import type { HistoryPage } from '@openhex-ai/agent-sdk'
import {
  foldOpenhexHistory,
  historyHasCompletedTurn,
  isInternalCarelinkMessage,
  mergeSyncedOpenhexMessages,
} from './openhexHistorySync'

const record = (
  id: string,
  sender: 'user' | 'assistant',
  timestamp: number,
  raw: Record<string, unknown>,
): HistoryPage['entries'][number] => ({
  id,
  data: {
    id,
    seq: Number(id.replace(/\D/g, '')),
    sender,
    event: 'message',
    timestamp,
    sessionId: null,
    raw,
  },
})

describe('OpenHex history reconciliation', () => {
  it('recognizes only the internal Carelink trigger prefix', () => {
    expect(isInternalCarelinkMessage('[CARELINK_POLICY_PUSH:abc_123]\n系统提示')).toBe(true)
    expect(isInternalCarelinkMessage('政策提醒：[天津高龄津贴](https://example.gov.cn/policy)')).toBe(false)
  })
  it('only accepts a terminal result belonging to the current turn', () => {
    const startedAt = Date.now()
    const oldTurn = [
      record('1', 'user', startedAt - 60_000, { type: 'user', message: '旧问题' }),
      record('2', 'assistant', startedAt - 59_000, { type: 'result' }),
    ]
    expect(historyHasCompletedTurn(oldTurn, startedAt)).toBe(false)

    const currentTurn = [
      ...oldTurn,
      record('3', 'user', startedAt, { type: 'user', message: '新问题' }),
      record('4', 'assistant', startedAt + 1_000, {
        type: 'assistant',
        message: { content: [{ type: 'text', text: '即时结果' }] },
      }),
      record('5', 'assistant', startedAt + 1_100, { type: 'result' }),
    ]
    expect(historyHasCompletedTurn(currentTurn, startedAt)).toBe(true)
  })

  it('folds completed history and keeps only newer live messages', () => {
    const startedAt = Date.now()
    const entries = [
      record('1', 'user', startedAt, { type: 'user', message: '新问题' }),
      record('2', 'assistant', startedAt + 1, {
        type: 'assistant',
        message: { content: [{ type: 'text', text: '即时结果' }] },
      }),
      record('3', 'assistant', startedAt + 2, { type: 'result' }),
    ]
    const history = foldOpenhexHistory(entries)
    expect(history.map((message) => message.text)).toEqual(['新问题', '即时结果'])

    const merged = mergeSyncedOpenhexMessages([
      { id: 'old-pending', role: 'assistant', text: '', createdAt: startedAt, pending: true },
      { id: 'next-user', role: 'user', text: '下一题', createdAt: startedAt + 5_000 },
    ], {
      conversationId: 'conversation-1',
      messages: history,
      syncedAt: startedAt + 2_000,
    }, 'conversation-1')

    expect(merged.map((message) => message.text)).toEqual(['新问题', '即时结果', '下一题'])
  })
})
