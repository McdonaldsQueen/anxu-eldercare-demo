import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearOpenhexDiagnostics,
  getOpenhexDiagnostics,
  subscribeOpenhexDiagnostics,
} from '../../services/openhexDiagnostics'
import { useDemoStore } from '../../store/demoStore'
import { useDemoUiStore } from '../../store/demoUiStore'
import { AlertIcon, CheckIcon, ClipboardIcon, SparkIcon } from '../ui/Icons'
import { ResetDemo } from './ResetDemo'

const phaseLabel = {
  token: '访客令牌',
  send: '发送请求',
  stream: '流式连接',
  history: '同步历史',
  interrupt: '停止回复',
  first_event: '首个事件',
  first_text: '首段文字',
  complete: '本轮完成',
  conversation: '会话恢复',
} as const

const outcomeLabel = {
  started: '开始',
  success: '正常',
  timeout: '超时',
  auth: '凭证失效',
  rate_limit: '请求过多',
  upstream: '上游异常',
  network: '网络异常',
  cancelled: '已停止',
} as const

export function DemoToolbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [copyState, setCopyState] = useState('')
  const navigate = useNavigate()
  const activeRole = useDemoStore((state) => state.activeRole)
  const submitElderMessage = useDemoStore((state) => state.submitElderMessage)
  const experienceMode = useDemoUiStore((state) => state.experienceMode)
  const setExperienceMode = useDemoUiStore((state) => state.setExperienceMode)
  const diagnostics = useSyncExternalStore(
    subscribeOpenhexDiagnostics,
    getOpenhexDiagnostics,
    () => [],
  )
  const latestConversation = [...diagnostics].reverse().find((event) => event.conversationSuffix)

  const createEscortDemo = () => {
    setExperienceMode('PHASE4')
    submitElderMessage('我明天下午要去医院，但是没人陪我。')
    submitElderMessage('朝阳医院，下午两点半。')
    navigate('/elder')
  }

  const createEmergencyDemo = () => {
    setExperienceMode('PHASE4')
    submitElderMessage('我刚刚摔了一跤，现在起不来了。')
    navigate('/elder')
  }

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
      setCopyState('诊断信息已复制')
    } catch {
      setCopyState('浏览器未允许复制，请在开发者工具中查看 sessionStorage。')
    }
  }

  return (
    <aside className={`demo-toolbar ${isOpen ? 'demo-toolbar--open' : ''}`} aria-label="产品演示工具">
      <button
        className="demo-toolbar__toggle"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span><SparkIcon /></span>
        <span><strong>演示工具</strong><small>{experienceMode === 'OPENHEX' ? '真实 Agent 对话' : '本地 Mock 业务'}</small></span>
        <span aria-hidden="true">{isOpen ? '收起' : '展开'}</span>
      </button>

      {isOpen && (
        <div className="demo-toolbar__panel">
          <section>
            <p className="eyebrow">对话来源</p>
            <div className="segmented-control" role="group" aria-label="对话体验模式">
              <button
                className={experienceMode === 'OPENHEX' ? 'is-active' : ''}
                type="button"
                aria-pressed={experienceMode === 'OPENHEX'}
                onClick={() => {
                  setExperienceMode('OPENHEX')
                  if (activeRole !== 'ELDER') navigate('/elder')
                }}
              >OpenHex Agent</button>
              <button
                className={experienceMode === 'PHASE4' ? 'is-active' : ''}
                type="button"
                aria-pressed={experienceMode === 'PHASE4'}
                onClick={() => {
                  setExperienceMode('PHASE4')
                  if (activeRole !== 'ELDER') navigate('/elder')
                }}
              >Phase 4 Mock</button>
            </div>
            <p className="demo-toolbar__note">真实对话不会创建 Case；以下入口只操作浏览器内 Mock Data。</p>
          </section>

          <section>
            <p className="eyebrow">场景快捷入口</p>
            <div className="demo-toolbar__actions">
              <button type="button" onClick={createEscortDemo}><ClipboardIcon />体验陪诊 Case</button>
              <button className="is-risk" type="button" onClick={createEmergencyDemo}><AlertIcon />体验紧急 Case</button>
            </div>
          </section>

          <section className="diagnostic-summary">
            <div className="diagnostic-summary__heading">
              <div>
                <p className="eyebrow">OpenHex 诊断</p>
                <strong>{diagnostics.length ? `已记录 ${diagnostics.length} 个安全事件` : '尚无诊断事件'}</strong>
                {latestConversation?.conversationSuffix && <small>会话 …{latestConversation.conversationSuffix}</small>}
              </div>
              <span className={diagnostics.some((event) => !['started', 'success'].includes(event.outcome)) ? 'is-warning' : ''}>
                <CheckIcon />不记录正文与令牌
              </span>
            </div>
            {diagnostics.length > 0 && (
              <div className="diagnostic-list" aria-label="最近的 OpenHex 诊断事件">
                {diagnostics.slice(-8).reverse().map((event) => (
                  <div key={event.id}>
                    <span>{phaseLabel[event.phase]}</span>
                    <strong>{outcomeLabel[event.outcome]}</strong>
                    <small>{event.durationMs === undefined ? '—' : `${event.durationMs} ms`}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="diagnostic-summary__actions">
              <button type="button" disabled={!diagnostics.length} onClick={copyDiagnostics}>复制诊断信息</button>
              <button type="button" disabled={!diagnostics.length} onClick={clearOpenhexDiagnostics}>清空</button>
              <ResetDemo />
            </div>
            {copyState && <p className="demo-toolbar__note" role="status">{copyState}</p>}
          </section>
        </div>
      )}
    </aside>
  )
}
