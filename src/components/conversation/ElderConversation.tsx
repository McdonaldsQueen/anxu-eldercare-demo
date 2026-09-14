import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createBrowserSpeechRecognition,
  requestMicrophonePermission,
  voiceErrorMessage,
  type SpeechRecognitionLike,
} from '../../services/speechRecognition'
import { selectActiveSafetyCase, useDemoStore } from '../../store/demoStore'
import { ArrowIcon, MicIcon, SparkIcon } from '../ui/Icons'
import { RiskFollowUpPanel } from './RiskFollowUpPanel'

type VoiceState = 'IDLE' | 'REQUESTING' | 'LISTENING' | 'ERROR'

export function ElderConversation() {
  const [input, setInput] = useState('')
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

  const send = () => {
    const text = input.trim()
    if (!text) return
    submitElderMessage(text)
    setInput('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
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

        {session.messages.length > 0 && (
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
          />
          <button type="submit" disabled={!input.trim()}>发送</button>
        </form>
      </div>
    </>
  )
}
