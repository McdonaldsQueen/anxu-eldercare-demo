import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useOpenhexChat } from '@openhex-ai/agent-sdk/react'
import { Link } from 'react-router-dom'
import {
  createBrowserSpeechRecognition,
  requestMicrophonePermission,
  voiceErrorMessage,
  type SpeechRecognitionLike,
} from '../../services/speechRecognition'
import { getOpenhexToken } from '../../services/openhexToken'
import { selectActiveSafetyCase, useDemoStore } from '../../store/demoStore'
import { ArrowIcon, MicIcon, SparkIcon } from '../ui/Icons'
import { RiskFollowUpPanel } from './RiskFollowUpPanel'

type VoiceState = 'IDLE' | 'REQUESTING' | 'LISTENING' | 'ERROR'

export function ElderConversation() {
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [voiceMessage, setVoiceMessage] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceFailedRef = useRef(false)
  const activeSafetyCase = useDemoStore(selectActiveSafetyCase)
  const activeServiceCase = useDemoStore((state) =>
    Object.values(state.cases).find(
      (careCase) => careCase.caseType === 'MOBILITY' && careCase.status !== 'COMPLETED',
    ),
  )
  const agentId = import.meta.env.VITE_OPENHEX_AGENT_ID?.trim()
  const baseUrl = import.meta.env.VITE_OPENHEX_API_BASE_URL?.trim() || 'https://api.openhex.tech'
  const chat = useOpenhexChat({
    agentId: agentId || undefined,
    baseUrl,
    getToken: getOpenhexToken,
    persist: 'anxu-eldercare-agent-chat',
    senderName: '王阿姨',
  })

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const send = async () => {
    const text = input.trim()
    if (!text || chat.isResponding || !agentId) return

    setSendError('')
    try {
      await chat.send(text)
      setInput('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '发送失败，请稍后重试。')
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

  return (
    <>
      <button
        className={`voice-button ${voiceState === 'LISTENING' ? 'voice-button--listening' : ''}`}
        type="button"
        aria-label={voiceState === 'LISTENING' ? '停止语音输入' : '开始语音输入'}
        aria-pressed={voiceState === 'LISTENING'}
        onClick={startVoiceInput}
      >
        <MicIcon />
        <span>{voiceState === 'LISTENING' ? '正在听…' : voiceState === 'REQUESTING' ? '正在准备…' : '点击说话'}</span>
      </button>

      <div className="elder-conversation">
        {voiceMessage && (
          <p className={`voice-feedback ${voiceState === 'ERROR' ? 'voice-feedback--error' : ''}`} role="status">
            {voiceMessage}
          </p>
        )}

        {chat.messages.length > 0 && (
          <div className="conversation-thread" aria-live="polite" aria-label="与安序智护的对话">
            {chat.messages
              .filter((message) => message.role !== 'system')
              .map((message) => (
              <div className={`message-row message-row--${message.role}`} key={message.id}>
                {message.role === 'assistant' && <span className="message-avatar"><SparkIcon /></span>}
                <div className="message-content">
                  <span>{message.role === 'user' ? '王阿姨' : message.agent?.name || '安序智护'}</span>
                  <p>{message.text || (message.pending ? '正在思考…' : '')}</p>
                </div>
              </div>
            ))}
            {activeServiceCase && !activeSafetyCase && (
              <div className="conversation-created-case" role="status">
                <div>
                  <span>已生成一件正在处理的事情</span>
                  <strong>{activeServiceCase.appointmentTime}陪诊 · {activeServiceCase.hospital}</strong>
                </div>
                <Link to={`/elder/cases/${activeServiceCase.caseId}`}>
                  查看处理进度 <ArrowIcon />
                </Link>
              </div>
            )}
          </div>
        )}

        {chat.isResponding && (
          <div className="agent-status" role="status">
            <span>安序智护正在回复…</span>
            <button type="button" onClick={chat.interrupt}>停止回复</button>
          </div>
        )}

        {!agentId && (
          <p className="agent-error" role="alert">
            尚未配置 OpenHex Agent，请设置 VITE_OPENHEX_AGENT_ID。
          </p>
        )}

        {(sendError || chat.error) && (
          <div className="agent-error" role="alert">
            <span>{sendError || chat.error?.message || '发送失败，请稍后重试。'}</span>
            <button
              type="button"
              onClick={() => {
                setSendError('')
                chat.retry()
              }}
            >
              重试
            </button>
          </div>
        )}

        <RiskFollowUpPanel />

        <form className="text-entry" aria-label="文字需求输入" onSubmit={handleSubmit}>
          <SparkIcon />
          <input
            aria-label="告诉安序智护您的需要"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例如：我明天下午要去医院，但是没人陪我"
            autoComplete="off"
            disabled={chat.isResponding || !agentId}
          />
          <button type="submit" disabled={!input.trim() || chat.isResponding || !agentId}>
            {chat.isResponding ? '回复中' : '发送'}
          </button>
        </form>
      </div>
    </>
  )
}
