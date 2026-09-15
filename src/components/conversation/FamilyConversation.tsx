import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { SparkIcon } from '../ui/Icons'
import { useDemoStore } from '../../store/demoStore'

export function FamilyConversation() {
  const [input, setInput] = useState('')
  const messages = useDemoStore((state) => state.conversationState.family.messages)
  const submitFamilyMessage = useDemoStore((state) => state.submitFamilyMessage)

  const send = () => {
    const text = input.trim()
    if (!text) return
    submitFamilyMessage(text)
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

  return (
    <div className="family-conversation">
      {messages.length > 0 && (
        <div className="conversation-thread" aria-live="polite" aria-label="家属与安序智护的对话">
          {messages.map((message) => (
            <div className={`message-row message-row--${message.sender.toLowerCase()}`} key={message.id}>
              {message.sender === 'ASSISTANT' && <span className="message-avatar"><SparkIcon /></span>}
              <div className="message-content">
                <span>{message.sender === 'USER' ? '王阿姨女儿' : '安序智护'}</span>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <form className="family-text-entry" aria-label="家属服务需求输入" onSubmit={handleSubmit}>
        <input
          aria-label="告诉安序智护您的家属需求"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：我今天一直联系不上我妈"
          autoComplete="off"
        />
        <button type="submit" disabled={!input.trim()}>发送</button>
      </form>
      <small>目前支持：联系不上老人、物品转交。涉及明确风险时将优先建立 Safety Case。</small>
    </div>
  )
}
