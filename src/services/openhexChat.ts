export interface OpenhexChatRequest {
  message: string
  conversationId?: string
}

export interface OpenhexChatResponse {
  reply: string
  conversationId: string
  reusedConversationId: boolean
}

interface OpenhexErrorResponse {
  message?: string
}

export async function sendOpenhexMessage(
  request: OpenhexChatRequest,
  signal?: AbortSignal,
): Promise<OpenhexChatResponse> {
  const response = await fetch('/api/openhex/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  const body = await response.json().catch(() => ({})) as Partial<OpenhexChatResponse> & OpenhexErrorResponse

  if (!response.ok) {
    throw new Error(body.message || `OpenHex 请求失败（HTTP ${response.status}）`)
  }
  if (!body.reply || !body.conversationId) {
    throw new Error('OpenHex 返回的数据不完整。')
  }

  return {
    reply: body.reply,
    conversationId: body.conversationId,
    reusedConversationId: Boolean(body.reusedConversationId),
  }
}
