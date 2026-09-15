import { createServer } from 'node:http'
import { OpenhexClient } from '@openhex-ai/agent-sdk'

const host = '127.0.0.1'
const port = 8787
const apiKey = process.env.OPENHEX_API_KEY?.trim()
const agentId = process.env.OPENHEX_AGENT_ID?.trim()
const maxBodyBytes = 16 * 1024

const client = apiKey && agentId
  ? new OpenhexClient({ apiKey, agentId })
  : null

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maxBodyBytes) {
      throw new Error('REQUEST_TOO_LARGE')
    }
  }

  try {
    return JSON.parse(body || '{}')
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function publicError(error) {
  if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') {
    return { status: 413, code: 'REQUEST_TOO_LARGE', message: '消息内容过长。' }
  }
  if (error instanceof Error && error.message === 'INVALID_JSON') {
    return { status: 400, code: 'INVALID_JSON', message: '请求格式不正确。' }
  }

  return {
    status: 502,
    code: 'OPENHEX_REQUEST_FAILED',
    message: 'OpenHex 暂时无法回复，请稍后重试或切回 Mock Demo。',
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)

  if (request.method === 'GET' && url.pathname === '/api/openhex/health') {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(client),
      missing: [
        ...(!apiKey ? ['OPENHEX_API_KEY'] : []),
        ...(!agentId ? ['OPENHEX_AGENT_ID'] : []),
      ],
    })
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/api/openhex/chat') {
    sendJson(response, 404, { code: 'NOT_FOUND', message: 'Not found.' })
    return
  }

  if (!client || !agentId) {
    sendJson(response, 503, {
      code: 'OPENHEX_NOT_CONFIGURED',
      message: '本地 OpenHex 后端尚未配置 OPENHEX_API_KEY 或 OPENHEX_AGENT_ID。',
    })
    return
  }

  try {
    const body = await readJson(request)
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const conversationId = typeof body.conversationId === 'string'
      ? body.conversationId.trim()
      : ''

    if (!message) {
      sendJson(response, 400, { code: 'MESSAGE_REQUIRED', message: '消息不能为空。' })
      return
    }

    // Use the full chat request so a PoC session starts cleanly. Supplying the
    // returned conversationId on later turns is what preserves OpenHex context.
    const turn = await client.chat.sendMessage(
      conversationId
        ? { message, conversationId }
        : { message, targetAgentIds: [agentId], newConversation: true },
    )

    if (conversationId && turn.conversationId !== conversationId) {
      throw new Error(
        `OpenHex conversation mismatch: requested ${conversationId}, received ${turn.conversationId}`,
      )
    }

    console.info(
      `[OpenHex] ${conversationId ? 'reused' : 'created'} conversationId=${turn.conversationId}`,
    )
    sendJson(response, 200, {
      reply: turn.text,
      conversationId: turn.conversationId,
      reusedConversationId: Boolean(conversationId),
    })
  } catch (error) {
    // Log only explicitly selected response fields. Never log configuration,
    // request headers, or the complete SDK error object.
    const errorObject = error && typeof error === 'object' ? error : null
    const errorResponse = errorObject
      && 'response' in errorObject
      && errorObject.response
      && typeof errorObject.response === 'object'
      ? errorObject.response
      : null
    const errorBody = errorObject && 'body' in errorObject ? errorObject.body : undefined
    const bodyObject = errorBody && typeof errorBody === 'object' ? errorBody : null
    const httpStatus = errorObject && 'status' in errorObject
      ? errorObject.status
      : errorObject && 'statusCode' in errorObject
        ? errorObject.statusCode
        : errorResponse && 'status' in errorResponse
          ? errorResponse.status
          : undefined

    console.error('[OpenHex] HTTP status:', httpStatus)
    console.error(
      '[OpenHex] error.message:',
      errorObject && 'message' in errorObject ? errorObject.message : String(error),
    )
    console.error(
      '[OpenHex] JSON.stringify(error.body, null, 2):\n%s',
      JSON.stringify(errorBody, null, 2),
    )
    console.error(
      '[OpenHex] body.detail:',
      bodyObject && 'detail' in bodyObject ? bodyObject.detail : undefined,
    )
    console.error(
      '[OpenHex] body.issues:\n%s',
      JSON.stringify(bodyObject && 'issues' in bodyObject ? bodyObject.issues : undefined, null, 2),
    )
    const result = publicError(error)
    sendJson(response, result.status, result)
  }
})

server.listen(port, host, () => {
  console.log(`[OpenHex] local backend listening on http://${host}:${port}`)
  if (!client) {
    console.warn('[OpenHex] backend is not configured; set OPENHEX_API_KEY and OPENHEX_AGENT_ID in server/.env')
  }
})
