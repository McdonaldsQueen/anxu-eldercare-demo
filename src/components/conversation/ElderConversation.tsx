import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createBrowserSpeechRecognition,
  requestMicrophonePermission,
  voiceErrorMessage,
  type SpeechRecognitionLike,
} from '../../services/speechRecognition'
import { sendOpenhexMessage } from '../../services/openhexChat'
import type { ConversationMessage } from '../../domain/models'
import { selectActiveSafetyCase, useDemoStore } from '../../store/demoStore'
import { ArrowIcon, MicIcon, SparkIcon } from '../ui/Icons'
import { RiskFollowUpPanel } from './RiskFollowUpPanel'

type VoiceState = 'IDLE' | 'REQUESTING' | 'LISTENING' | 'ERROR'
type ExperienceMode = 'MOCK' | 'OPENHEX'

const OPENHEX_FAILURE_MESSAGE = 'OpenHex 暂时无法回复。您可以重试，或切回 Mock Demo；原有 Demo 未受影响。'

export function ElderConversation() {
  const [input, setInput] = useState('')
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('MOCK')
  const [openhexMessages, setOpenhexMessages] = useState<ConversationMessage[]>([])
  const [openhexConversationId, setOpenhexConversationId] = useState<string | null>(null)
  const [openhexError, setOpenhexError] = useState('')
  const [isOpenhexSending, setIsOpenhexSending] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [voiceMessage, setVoiceMessage] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceFailedRef = useRef(false)
  const session = useDemoStore((state) => state.conversationState.elder)
  const submitElderMessage = useDemoStore((state) => state.submitElderMessage)
  const activeSafetyCase = useDemoStore(selectActiveSafetyCase)
  const activeServiceCase = useDemoStore((state) =>
    Object.values(state.cases).find(
      (careCase) => careCase.caseType === 'MOBILITY' && careCase.status !== 'COMPLETED',
    ),
  )

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const send = async () => {
    const text = input.trim()
    if (!text || (experienceMode === 'OPENHEX' && isOpenhexSending)) return

    if (experienceMode === 'MOCK') {
      submitElderMessage(text)
      setInput('')
      return
    }

    const sentAt = new Date().toISOString()
    const userMessage: ConversationMessage = {
      id: `openhex-user-${crypto.randomUUID()}`,
      sender: 'USER',
      text,
      sentAt,
    }
    setOpenhexMessages((messages) => [...messages, userMessage])
    setInput('')
    setOpenhexError('')
    setIsOpenhexSending(true)

    try {
      const result = await sendOpenhexMessage({
        message: text,
        ...(openhexConversationId ? { conversationId: openhexConversationId } : {}),
      })
      setOpenhexConversationId(result.conversationId)
      setOpenhexMessages((messages) => [
        ...messages,
        {
          id: `openhex-assistant-${crypto.randomUUID()}`,
          sender: 'ASSISTANT',
          text: result.reply,
          sentAt: new Date().toISOString(),
        },
      ])
    } catch {
      setOpenhexError(OPENHEX_FAILURE_MESSAGE)
      setInput((current) => current || text)
    } finally {
      setIsOpenhexSending(false)
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

  const visibleMessages = experienceMode === 'OPENHEX' ? openhexMessages : session.messages

  const startNewOpenhexConversation = () => {
    setOpenhexMessages([])
    setOpenhexConversationId(null)
    setOpenhexError('')
    setInput('')
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

      <div className={`elder-conversation elder-conversation--${experienceMode.toLowerCase()}`}>
        <div className="experience-mode" aria-label="对话体验模式" role="group">
          <span>体验模式</span>
          <button
            className={experienceMode === 'MOCK' ? 'is-active' : ''}
            type="button"
            aria-pressed={experienceMode === 'MOCK'}
            onClick={() => setExperienceMode('MOCK')}
          >
            Mock Demo
          </button>
          <button
            className={experienceMode === 'OPENHEX' ? 'is-active' : ''}
            type="button"
            aria-pressed={experienceMode === 'OPENHEX'}
            onClick={() => setExperienceMode('OPENHEX')}
          >
            OpenHex 体验
          </button>
        </div>

        {voiceMessage && (
          <p className={`voice-feedback ${voiceState === 'ERROR' ? 'voice-feedback--error' : ''}`} role="status">
            {voiceMessage}
          </p>
        )}

        {experienceMode === 'OPENHEX' && (
          <div className="openhex-session-status" role="status">
            <span>仅验证 Agent 对话，不会创建或更新业务 Case</span>
            {openhexConversationId && (
              <>
                <code>conversationId: {openhexConversationId}</code>
                <button type="button" disabled={isOpenhexSending} onClick={startNewOpenhexConversation}>新建体验会话</button>
              </>
            )}
          </div>
        )}

        {visibleMessages.length > 0 && (
          <div className="conversation-thread" aria-live="polite" aria-label="与安序智护的对话">
            {visibleMessages.map((message) => (
              <div className={`message-row message-row--${message.sender.toLowerCase()}`} key={message.id}>
                {message.sender === 'ASSISTANT' && <span className="message-avatar"><SparkIcon /></span>}
                <div className="message-content">
                  <span>{message.sender === 'USER' ? '王阿姨' : experienceMode === 'OPENHEX' ? 'OpenHex Agent' : '安序智护'}</span>
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            {experienceMode === 'MOCK' && activeServiceCase && !activeSafetyCase && (
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

        {experienceMode === 'MOCK' && <RiskFollowUpPanel />}

        {experienceMode === 'OPENHEX' && isOpenhexSending && (
          <p className="openhex-feedback" role="status">OpenHex Agent 正在回复，首轮冷启动可能需要十几秒…</p>
        )}
        {experienceMode === 'OPENHEX' && openhexError && (
          <p className="openhex-feedback openhex-feedback--error" role="alert">{openhexError}</p>
        )}

        <form className="text-entry" aria-label="文字需求输入" onSubmit={handleSubmit}>
          <SparkIcon />
          <input
            aria-label="告诉安序智护您的需要"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={experienceMode === 'OPENHEX' ? '和 OpenHex Agent 聊聊，试试多轮上下文' : '例如：我明天下午要去医院，但是没人陪我'}
            autoComplete="off"
          />
          <button type="submit" disabled={!input.trim() || (experienceMode === 'OPENHEX' && isOpenhexSending)}>
            {experienceMode === 'OPENHEX' && isOpenhexSending ? '等待中…' : '发送'}
          </button>
        </form>
      </div>
    </>
  )
}
