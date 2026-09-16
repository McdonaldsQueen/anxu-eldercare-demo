import { isTurnComplete, type HistoryPage } from '@openhex-ai/agent-sdk'
import { foldRecords, type ChatMessage } from '@openhex-ai/agent-sdk/react'

const TURN_CLOCK_SKEW_MS = 10_000

const timestampMs = (value: number) => value > 0 && value < 1_000_000_000_000
  ? value * 1_000
  : value

export const historyHasCompletedTurn = (
  entries: HistoryPage['entries'],
  turnStartedAt: number,
) => {
  let currentUserIndex = -1

  entries.forEach((entry, index) => {
    const record = entry.data
    if (
      record.sender === 'user'
      && timestampMs(record.timestamp) >= turnStartedAt - TURN_CLOCK_SKEW_MS
    ) {
      currentUserIndex = index
    }
  })

  return currentUserIndex >= 0
    && entries.slice(currentUserIndex + 1).some((entry) => isTurnComplete(entry.data))
}

export const foldOpenhexHistory = (entries: HistoryPage['entries']) => foldRecords(
  entries.map((entry) => ({
    ...entry.data,
    id: entry.data.id ?? entry.id,
  })),
  'sync-',
)

export interface SyncedOpenhexHistory {
  conversationId: string
  messages: ChatMessage[]
  syncedAt: number
}

export const mergeSyncedOpenhexMessages = (
  liveMessages: ChatMessage[],
  syncedHistory: SyncedOpenhexHistory | null,
  conversationId?: string,
) => {
  if (!syncedHistory || syncedHistory.conversationId !== conversationId) return liveMessages

  return [
    ...syncedHistory.messages,
    ...liveMessages.filter((message) => message.createdAt > syncedHistory.syncedAt),
  ]
}
