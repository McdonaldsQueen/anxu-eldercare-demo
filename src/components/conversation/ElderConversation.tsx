import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { resolveChatClient, useOpenhexChat } from '@openhex-ai/agent-sdk/react'
import { Link } from 'react-router-dom'
import {
  createBrowserSpeechRecognition,
  requestMicrophonePermission,
  voiceErrorMessage,
  type SpeechRecognitionLike,
} from '../../services/speechRecognition'
import {
  classifyOpenhexFailure,
  conversationSuffix,
  createOpenhexDiagnosticFetch,
  openhexErrorMessage,
  recordOpenhexDiagnostic,
} from '../../services/openhexDiagnostics'
import {
  foldOpenhexHistory,
  historyHasCompletedTurn,
  mergeSyncedOpenhexMessages,
  type SyncedOpenhexHistory,
} from '../../services/openhexHistorySync'
import { getOpenhexToken, resetOpenhexTokenCache } from '../../services/openhexToken'
import { useDemoStore } from '../../store/demoStore'
import { useDemoUiStore } from '../../store/demoUiStore'
import { ArrowIcon, MicIcon, SparkIcon } from '../ui/Icons'
import { RiskFollowUpPanel } from './RiskFollowUpPanel'

type VoiceState = 'IDLE' | 'REQUESTING' | 'LISTENING' | 'ERROR'

const DEFAULT_IDLE_TIMEOUT_MS = 300_000

const configuredIdleTimeout = () => {
  const value = Number(import.meta.env.VITE_OPENHEX_IDLE_TIMEOUT_MS)
  return Number.isFinite(value) && value >= 30_000 ? value : DEFAULT_IDLE_TIMEOUT_MS
}

export function ElderConversation() {
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<Error | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [voiceMessage, setVoiceMessage] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [transportConversationId, setTransportConversationId] = useState<string>()
  const [syncedHistory, setSyncedHistory] = useState<SyncedOpenhexHistory | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const voiceFailedRef = useRef(false)
  const turnStartedAtRef = useRef<number | null>(null)
  const firstEventRecordedRef = useRef(false)
  const firstTextRecordedRef = useRef(false)
  const existingAssistantIdsRef = useRef<Set<string>>(new Set())
  const reconciledTurnStartedAtRef = useRef<number | null>(null)
  const isRespondingRef = useRef(false)
  const experienceMode = useDemoUiStore((state) => state.experienceMode)
  const session = useDemoStore((state) => state.conversationState.elder)
  const submitElderMessage = useDemoStore((state) => state.submitElderMessage)
  const activeServiceCase = useDemoStore((state) =>
    Object.values(state.cases).find(
      (careCase) => ['SERVICE', 'MOBILITY'].includes(careCase.caseType) && careCase.status !== 'COMPLETED',
    ),
  )
  const agentId = import.meta.env.VITE_OPENHEX_AGENT_ID?.trim()
  const baseUrl = import.meta.env.VITE_OPENHEX_API_BASE_URL?.trim() || 'https://api.openhex.tech'
  const diagnosticFetch = useMemo(() => createOpenhexDiagnosticFetch(
    globalThis.fetch,
    Date.now,
    setTransportConversationId,
  ), [])
  const chatClient = useMemo(() => resolveChatClient({
    baseUrl,
    getToken: getOpenhexToken,
    fetch: diagnosticFetch,
  }), [baseUrl, diagnosticFetch])
  const idleTimeoutMs = configuredIdleTimeout()
  const chat = useOpenhexChat({
    client: chatClient,
    agentId: agentId || undefined,
    idleTimeoutMs,
    persist: 'anxu-eldercare-agent-chat',
    senderName: '王阿姨',
    onTurnComplete: () => {
      const startedAt = turnStartedAtRef.current
      recordOpenhexDiagnostic({
        phase: 'complete',
        outcome: 'success',
        durationMs: startedAt ? Date.now() - startedAt : undefined,
      })
    },
    onError: (error) => {
      const startedAt = turnStartedAtRef.current
      recordOpenhexDiagnostic({
        phase: 'complete',
        outcome: classifyOpenhexFailure(error, (error as { status?: number }).status),
        durationMs: startedAt ? Date.now() - startedAt : undefined,
      })
    },
  })
  const activeConversationId = chat.conversationId ?? transportConversationId
  const openhexMessages = useMemo(() => mergeSyncedOpenhexMessages(
    chat.messages,
    syncedHistory,
    activeConversationId,
  ), [activeConversationId, chat.messages, syncedHistory])
  isRespondingRef.current = chat.isResponding

  useEffect(() => () => recognitionRef.current?.stop(), [])

  useEffect(() => {
    if (!chat.isResponding) {
      setElapsedSeconds(0)
      return
    }
    const startedAt = turnStartedAtRef.current ?? Date.now()
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [chat.isResponding])

  useEffect(() => {
    if (!chat.conversationId) return
    recordOpenhexDiagnostic({
      phase: 'conversation',
      outcome: 'success',
      conversationSuffix: conversationSuffix(chat.conversationId),
    })
  }, [chat.conversationId])

  useEffect(() => {
    const turnStartedAt = turnStartedAtRef.current
    if (
      experienceMode !== 'OPENHEX'
      || !chat.isResponding
      || !activeConversationId
      || !turnStartedAt
      || reconciledTurnStartedAtRef.current === turnStartedAt
    ) return

    let stopped = false
    let timer: number | undefined

    const pollHistory = async () => {
      try {
        const history = await chatClient.messages(activeConversationId)
        if (stopped) return

        if (historyHasCompletedTurn(history.entries, turnStartedAt)) {
          reconciledTurnStartedAtRef.current = turnStartedAt
          setSyncedHistory({
            conversationId: activeConversationId,
            messages: foldOpenhexHistory(history.entries),
            syncedAt: Date.now(),
          })
          recordOpenhexDiagnostic({
            phase: 'complete',
            outcome: 'success',
            durationMs: Date.now() - turnStartedAt,
            conversationSuffix: conversationSuffix(activeConversationId),
          })
          if (isRespondingRef.current) chat.interrupt()
          return
        }
      } catch {
        // The diagnostic fetch records the failure; the active SSE remains primary.
      }

      if (!stopped) timer = window.setTimeout(() => void pollHistory(), 2_000)
    }

    void pollHistory()
    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [activeConversationId, chat.interrupt, chat.isResponding, chatClient, experienceMode])

  useEffect(() => {
    if (chat.status !== 'streaming' || firstEventRecordedRef.current) return
    firstEventRecordedRef.current = true
    recordOpenhexDiagnostic({
      phase: 'first_event',
      outcome: 'success',
      durationMs: turnStartedAtRef.current ? Date.now() - turnStartedAtRef.current : undefined,
      conversationSuffix: conversationSuffix(chat.conversationId),
    })
  }, [chat.conversationId, chat.status])

  useEffect(() => {
    if (firstTextRecordedRef.current) return
    const hasAssistantText = openhexMessages.some((message) =>
      message.role === 'assistant'
      && !existingAssistantIdsRef.current.has(message.id)
      && message.text.trim(),
    )
    if (!hasAssistantText) return
    firstTextRecordedRef.current = true
    recordOpenhexDiagnostic({
      phase: 'first_text',
      outcome: 'success',
      durationMs: turnStartedAtRef.current ? Date.now() - turnStartedAtRef.current : undefined,
      conversationSuffix: conversationSuffix(chat.conversationId),
    })
  }, [chat.conversationId, openhexMessages])

  useEffect(() => {
    if (!threadRef.current || experienceMode !== 'OPENHEX') return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [experienceMode, openhexMessages])

  const send = async () => {
    const text = input.trim()
    if (!text) return

    if (experienceMode === 'PHASE4') {
      submitElderMessage(text)
      setInput('')
      return
    }

    if (chat.isResponding || !agentId) return

    setSendError(null)
    turnStartedAtRef.current = Date.now()
    firstEventRecordedRef.current = false
    firstTextRecordedRef.current = false
    reconciledTurnStartedAtRef.current = null
    existingAssistantIdsRef.current = new Set(
      chat.messages
        .filter((message) => message.role === 'assistant')
        .map((message) => message.id),
    )
    try {
      await chat.send(text)
      setInput('')
    } catch (error) {
      setSendError(error instanceof Error ? error : new Error('发送失败'))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  const startVoiceInput = async () => {
    if (voiceState === 'LISTENING') {
      recognitionRef.current?.stop()
      return
    }

    const recognition = createBrowserSpeechRecognition()
    if (!recognition) {
      setVoiceState('ERROR')
      setVoiceMessage('当前浏览器不支持语音识别，请继续使用文字输入。')
      return
    }

    setVoiceState('REQUESTING')
    setVoiceMessage('正在请求麦克风权限…')
    voiceFailedRef.current = false

    try {
      await requestMicrophonePermission()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim()
        if (transcript) {
          setInput(transcript)
          setVoiceMessage('已识别，请确认或修改后发送。')
        }
      }
      recognition.onerror = (event) => {
        voiceFailedRef.current = true
        setVoiceState('ERROR')
        setVoiceMessage(
          event.error === 'not-allowed'
            ? '麦克风权限未开启，请允许访问或继续使用文字输入。'
            : '语音识别未能完成，请继续使用文字输入。',
        )
      }
      recognition.onend = () => {
        recognitionRef.current = null
        if (!voiceFailedRef.current) setVoiceState('IDLE')
      }
      recognitionRef.current = recognition
      recognition.start()
      setVoiceState('LISTENING')
      setVoiceMessage('正在听，请说出您的需要。')
    } catch (error) {
      recognitionRef.current = null
      setVoiceState('ERROR')
      setVoiceMessage(voiceErrorMessage(error))
    }
  }

  const visibleError = sendError ?? chat.error
  const errorOutcome = visibleError
    ? classifyOpenhexFailure(visibleError, (visibleError as { status?: number }).status)
    : null
  const hasStreamingText = openhexMessages.some((message) => message.role === 'assistant' && message.streaming && message.text.trim())
  const responseStatus = hasStreamingText
    ? '正在生成回复…'
    : elapsedSeconds < 15
      ? '正在连接安序智护…'
      : elapsedSeconds < 60
        ? '正在唤醒服务，请稍候…'
        : '任务较复杂，仍在处理中…'

  const retry = () => {
    if (errorOutcome === 'timeout') {
      window.location.reload()
      return
    }
    if (errorOutcome === 'auth') resetOpenhexTokenCache()
    setSendError(null)
    chat.retry()
  }

  return (
    <div className={`elder-conversation elder-conversation--${experienceMode.toLowerCase()}`}>
      <div className="assistant-presence">
        <span><SparkIcon /></span>
        <div>
          <strong>{experienceMode === 'OPENHEX' ? '安序智护在线' : 'Phase 4 本地业务演示'}</strong>
          <small>{experienceMode === 'OPENHEX' ? '由 OpenHex Agent 提供实时回复' : '仅使用浏览器内 Mock Data'}</small>
        </div>
      </div>

      {voiceMessage && (
        <p className={`voice-feedback ${voiceState === 'ERROR' ? 'voice-feedback--error' : ''}`} role="status">
          {voiceMessage}
        </p>
      )}

      {experienceMode === 'OPENHEX' && openhexMessages.length > 0 && (
        <div ref={threadRef} className="conversation-thread" aria-live="polite" aria-label="与安序智护的对话">
          {openhexMessages
            .filter((message) => message.role !== 'system')
            .map((message) => (
              <div className={`message-row message-row--${message.role}`} key={message.id}>
                {message.role === 'assistant' && <span className="message-avatar"><SparkIcon /></span>}
                <div className="message-content">
                  <span>{message.role === 'user' ? '王阿姨' : message.agent?.name || '安序智护'}</span>
                  <p>{message.text || (message.pending || message.streaming ? '正在思考…' : '')}</p>
                </div>
              </div>
            ))}
        </div>
      )}

      {experienceMode === 'OPENHEX' && openhexMessages.length === 0 && (
        <div className="conversation-empty">
          <span><SparkIcon /></span>
          <div><strong>我在这里，您慢慢说</strong><p>可以问日常生活，也可以说说今天需要什么帮助。</p></div>
        </div>
      )}

      {experienceMode === 'PHASE4' && session.messages.length > 0 && (
        <div className="conversation-thread" aria-live="polite" aria-label="与安序智护的对话">
          {session.messages.map((message) => (
            <div className={`message-row message-row--${message.sender.toLowerCase()}`} key={message.id}>
              {message.sender === 'ASSISTANT' && <span className="message-avatar"><SparkIcon /></span>}
              <div className="message-content">
                <span>{message.sender === 'USER' ? '王阿姨' : '安序智护'}</span>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          {activeServiceCase && session.activeCaseId === activeServiceCase.caseId && (
            <div className="conversation-created-case" role="status">
              <div>
                <span>已生成一件正在处理的事情</span>
                <strong>{activeServiceCase.appointmentTime}陪诊 · {activeServiceCase.hospital}</strong>
              </div>
              <Link to={`/elder/cases/${activeServiceCase.caseId}`}>查看处理进度 <ArrowIcon /></Link>
            </div>
          )}
        </div>
      )}

      {experienceMode === 'OPENHEX' && chat.isResponding && (
        <div className="agent-status" role="status">
          <span><i aria-hidden="true" />{responseStatus}<small>{elapsedSeconds > 0 ? `${elapsedSeconds} 秒` : ''}</small></span>
          <button type="button" onClick={chat.interrupt}>停止回复</button>
        </div>
      )}

      {experienceMode === 'OPENHEX' && !agentId && (
        <p className="agent-error" role="alert">尚未配置 OpenHex Agent，请设置 VITE_OPENHEX_AGENT_ID。</p>
      )}

      {experienceMode === 'OPENHEX' && visibleError && (
        <div className="agent-error" role="alert">
          <span>{openhexErrorMessage(visibleError)}</span>
          <button type="button" onClick={retry}>{errorOutcome === 'timeout' ? '重新连接并同步会话' : '重试'}</button>
        </div>
      )}

      {experienceMode === 'PHASE4' && <RiskFollowUpPanel />}

      <form className="text-entry" aria-label="文字需求输入" onSubmit={handleSubmit}>
        <button
          className={`voice-inline-button ${voiceState === 'LISTENING' ? 'is-listening' : ''}`}
          type="button"
          aria-label={voiceState === 'LISTENING' ? '停止语音输入' : '开始语音输入'}
          aria-pressed={voiceState === 'LISTENING'}
          onClick={startVoiceInput}
        ><MicIcon /></button>
        <input
          aria-label="告诉安序智护您的需要"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={experienceMode === 'OPENHEX' ? '例如：我今天睡得不太好，想和你聊聊' : '例如：我明天下午要去医院，但是没人陪我'}
          autoComplete="off"
          disabled={experienceMode === 'OPENHEX' && (chat.isResponding || !agentId)}
        />
        <button
          className="send-button"
          type="submit"
          disabled={!input.trim() || (experienceMode === 'OPENHEX' && (chat.isResponding || !agentId))}
        >{experienceMode === 'OPENHEX' && chat.isResponding ? '回复中' : '发送'}</button>
      </form>
    </div>
  )
}
