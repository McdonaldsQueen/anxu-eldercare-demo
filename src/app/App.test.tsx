import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { useDemoStore } from '../store/demoStore'
import { useDemoUiStore } from '../store/demoUiStore'
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionResultEventLike,
} from '../services/speechRecognition'

const openhexMock = vi.hoisted(() => ({
  send: vi.fn<(text: string) => Promise<string>>(),
  history: vi.fn(),
  retry: vi.fn(),
  interrupt: vi.fn(),
  lastOptions: null as Record<string, unknown> | null,
}))

vi.mock('@openhex-ai/agent-sdk/react', async () => {
  const React = await import('react')
  const actual = await vi.importActual<typeof import('@openhex-ai/agent-sdk/react')>('@openhex-ai/agent-sdk/react')

  interface MockChatMessage {
    id: string
    role: 'user' | 'assistant'
    text: string
    createdAt: number
    pending?: boolean
  }

  return {
    ...actual,
    resolveChatClient: () => ({ messages: openhexMock.history }),
    useOpenhexChat: (options: Record<string, unknown>) => {
      openhexMock.lastOptions = options
      const [messages, setMessages] = React.useState<MockChatMessage[]>([])
      const [isResponding, setIsResponding] = React.useState(false)
      const [error, setError] = React.useState<Error | null>(null)

      const send = React.useCallback(async (text: string) => {
        setError(null)
        setIsResponding(true)
        setMessages((current) => [
          ...current,
          { id: `user-${current.length + 1}`, role: 'user', text, createdAt: Date.now() },
        ])
        try {
          const reply = await openhexMock.send(text)
          setMessages((current) => [
            ...current,
            { id: `assistant-${current.length + 1}`, role: 'assistant', text: reply, createdAt: Date.now() },
          ])
          ;(options.onTurnComplete as ((message: MockChatMessage) => void) | undefined)?.({
            id: 'complete', role: 'assistant', text: reply, createdAt: Date.now(),
          })
        } catch (reason) {
          const nextError = reason instanceof Error ? reason : new Error('发送失败')
          setError(nextError)
          ;(options.onError as ((error: Error) => void) | undefined)?.(nextError)
          throw nextError
        } finally {
          setIsResponding(false)
        }
      }, [])

      const interrupt = React.useCallback(() => {
        openhexMock.interrupt()
        setIsResponding(false)
        setMessages((current) => current.filter((message) => !(message.role === 'assistant' && message.pending)))
      }, [])

      return {
        messages,
        status: error ? 'error' : isResponding ? 'streaming' : 'idle',
        error,
        conversationId: messages.length ? 'test-conversation' : undefined,
        isResponding,
        audioPlayback: {},
        playAudio: vi.fn(),
        stopAudio: vi.fn(),
        send,
        submitConnectorSetup: vi.fn(),
        submitInfoCollect: vi.fn(),
        skipInfoCollect: vi.fn(),
        downloadAttachment: vi.fn(),
        interrupt,
        retry: openhexMock.retry,
        clear: vi.fn(),
      }
    },
  }
})

describe('Phase 1 and Phase 2 routes and interactions', () => {
  afterEach(cleanup)

  beforeEach(() => {
    openhexMock.send.mockReset()
    openhexMock.send.mockResolvedValue('这是来自 OpenHex Agent 的回复。')
    openhexMock.history.mockReset()
    openhexMock.history.mockResolvedValue({ entries: [], hasMore: false })
    openhexMock.retry.mockReset()
    openhexMock.interrupt.mockReset()
    openhexMock.lastOptions = null
    vi.unstubAllEnvs()
    localStorage.clear()
    sessionStorage.clear()
    useDemoStore.getState().resetDemo()
    useDemoUiStore.getState().setExperienceMode('OPENHEX')
    window.location.hash = '#/'
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true, writable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true, writable: true })
  })

  it('enters the elder home and switches between all three role homes', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /开始完整体验/ }))
    expect(await screen.findByRole('heading', { name: /今天有什么需要/ })).toBeInTheDocument()
    expect(useDemoStore.getState().activeRole).toBe('ELDER')

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'FAMILY' },
    })
    expect(await screen.findByRole('heading', { name: '我的家人' })).toBeInTheDocument()
    expect(useDemoStore.getState().activeRole).toBe('FAMILY')

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'STAFF' },
    })
    expect(await screen.findByRole('heading', { name: '服务工作台' })).toBeInTheDocument()
    expect(useDemoStore.getState().activeRole).toBe('STAFF')
  })

  it('renders all workload numbers from the empty shared store', async () => {
    window.location.hash = '#/staff'
    render(<App />)

    const stats = await screen.findByLabelText('工作台统计')
    expect(stats).toHaveTextContent('今日待处理0件')
    expect(stats).toHaveTextContent('进行中0件')
    expect(stats).toHaveTextContent('高风险0件')
  })

  it('requires confirmation, resets the store, and returns to the landing page', async () => {
    window.location.hash = '#/family'
    useDemoStore.getState().setActiveRole('FAMILY')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /演示工具/ }))
    fireEvent.click(screen.getByRole('button', { name: '重置 Case 演示' }))
    expect(screen.getByText('重置 Mock Case？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认重置' }))

    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(screen.getByRole('heading', { name: /能听懂需求/ })).toBeInTheDocument()
    expect(useDemoStore.getState().activeRole).toBe('ELDER')
    expect(useDemoStore.getState().cases).toEqual({})
  })

  it('provides a working recovery link for unknown routes', async () => {
    window.location.hash = '#/missing-page'
    render(<App />)

    expect(await screen.findByText('页面没有找到')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '返回开场页' }))
    expect(await screen.findByRole('heading', { name: /能听懂需求/ })).toBeInTheDocument()
  })

  it('sends keyboard input to OpenHex without mutating the Mock Case store', async () => {
    window.location.hash = '#/elder'
    render(<App />)

    const input = await screen.findByLabelText('告诉安序智护您的需要')
    const sendButton = screen.getByRole('button', { name: '发送' })
    expect(input).toBeEnabled()
    expect(input).not.toHaveAttribute('readonly')
    expect(sendButton).toBeDisabled()

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useDemoStore.getState().conversationState.elder.messages).toHaveLength(0)

    fireEvent.change(input, {
      target: { value: '我明天下午要去医院，但是没人陪我。' },
    })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('这是来自 OpenHex Agent 的回复。')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(useDemoStore.getState().cases).toEqual({})
    expect(input).toBeEnabled()

    fireEvent.change(input, { target: { value: '朝阳医院，下午两点半。' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(input).toHaveValue(''))
    expect(useDemoStore.getState().cases).toEqual({})
    expect(input).toBeEnabled()
    expect(openhexMock.send).toHaveBeenNthCalledWith(1, '我明天下午要去医院，但是没人陪我。')
    expect(openhexMock.send).toHaveBeenNthCalledWith(2, '朝阳医院，下午两点半。')
    expect(openhexMock.lastOptions).toMatchObject({ idleTimeoutMs: 300_000 })
  })

  it('accepts a valid OpenHex idle timeout override', async () => {
    vi.stubEnv('VITE_OPENHEX_IDLE_TIMEOUT_MS', '420000')
    window.location.hash = '#/elder'

    render(<App />)

    await screen.findByLabelText('告诉安序智护您的需要')
    expect(openhexMock.lastOptions).toMatchObject({ idleTimeoutMs: 420_000 })
  })

  it('creates both Mock Case paths only through their explicit demo buttons', async () => {
    window.location.hash = '#/elder'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /演示工具/ }))
    fireEvent.click(await screen.findByRole('button', { name: '体验陪诊 Case' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      caseType: 'SERVICE',
      hospital: '朝阳医院',
      appointmentTime: '明日 14:30',
    })
    expect(openhexMock.send).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '体验紧急 Case' }))
    expect(useDemoStore.getState().cases['CASE-002']).toMatchObject({
      eventType: 'FALL',
      priority: 'P0',
    })
    expect(openhexMock.send).not.toHaveBeenCalled()
  })

  it('prevents duplicate sends while responding and preserves the draft on failure', async () => {
    let rejectTurn: ((reason: Error) => void) | undefined
    openhexMock.send.mockImplementationOnce(() => new Promise<string>((_resolve, reject) => {
      rejectTurn = reject
    }))
    window.location.hash = '#/elder'
    render(<App />)

    const input = await screen.findByLabelText('告诉安序智护您的需要')
    fireEvent.change(input, { target: { value: '请帮我查询一下' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('正在连接安序智护…')).toBeInTheDocument()
    expect(input).toBeDisabled()
    fireEvent.submit(input.closest('form')!)
    expect(openhexMock.send).toHaveBeenCalledTimes(1)

    await act(async () => rejectTurn?.(new Error('网络暂时不可用')))
    expect(await screen.findByText('网络连接中断，请检查网络后重新连接。')).toBeInTheDocument()
    expect(input).toHaveValue('请帮我查询一下')
    expect(input).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(openhexMock.retry).toHaveBeenCalledTimes(1)
  })

  it('does not blindly resend after an idle timeout', async () => {
    const timeoutError = new Error('idle timeout')
    timeoutError.name = 'AbortError'
    openhexMock.send.mockRejectedValueOnce(timeoutError)
    window.location.hash = '#/elder'
    render(<App />)

    const input = await screen.findByLabelText('告诉安序智护您的需要')
    fireEvent.change(input, { target: { value: '请完成一个耗时任务' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText(/等待回复超过 5 分钟/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新连接并同步会话' })).toBeInTheDocument()
    expect(openhexMock.retry).not.toHaveBeenCalled()
    expect(input).toHaveValue('请完成一个耗时任务')
  })

  it('shows a completed history reply immediately when the live stream misses its final text', async () => {
    const timestamp = Date.now()
    openhexMock.send.mockImplementationOnce(() => new Promise<string>(() => undefined))
    openhexMock.history.mockResolvedValue({
      hasMore: false,
      entries: [
        {
          id: 'event-1',
          data: {
            id: 'event-1', seq: 1, sender: 'user', event: 'message', timestamp, sessionId: null,
            raw: { type: 'user', message: '我家住在翻斗花园' },
          },
        },
        {
          id: 'event-2',
          data: {
            id: 'event-2', seq: 2, sender: 'assistant', event: 'message', timestamp: timestamp + 1, sessionId: null,
            raw: { type: 'assistant', message: { content: [{ type: 'text', text: '已经收到，会即时显示在这里。' }] } },
          },
        },
        {
          id: 'event-3',
          data: {
            id: 'event-3', seq: 3, sender: 'assistant', event: 'message', timestamp: timestamp + 2, sessionId: null,
            raw: { type: 'result' },
          },
        },
      ],
    })
    window.location.hash = '#/elder'
    render(<App />)

    const input = await screen.findByLabelText('告诉安序智护您的需要')
    fireEvent.change(input, { target: { value: '我家住在翻斗花园' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('已经收到，会即时显示在这里。')).toBeInTheDocument()
    expect(screen.queryByText('正在思考…')).not.toBeInTheDocument()
    expect(openhexMock.interrupt).toHaveBeenCalledTimes(1)
    expect(input).toBeEnabled()
  })

  it('completes the shared staff workflow and exposes the resolved state', async () => {
    useDemoStore.getState().submitElderMessage('我明天下午要去医院，但是没人陪我。')
    useDemoStore.getState().submitElderMessage('朝阳医院，下午两点半。')
    window.location.hash = '#/staff'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '接单' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('ACCEPTED')
    expect(screen.getByText(/陈静已接单/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /查看详情/ }))
    fireEvent.click(await screen.findByRole('button', { name: '开始服务' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('IN_PROGRESS')
    fireEvent.click(screen.getByRole('button', { name: '完成服务' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('COMPLETED')
    expect(await screen.findByText('CASE RESOLVED')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'FAMILY' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    expect(await screen.findByText('服务已完成')).toBeInTheDocument()
    expect(screen.getByText(/明日下午陪诊/)).toBeInTheDocument()
  })

  it('shows the staff elder archive with both verified family relationships', async () => {
    window.location.hash = '#/staff/elders'
    render(<App />)

    expect(await screen.findByRole('heading', { name: '老人档案' })).toBeInTheDocument()
    const archive = screen.getByLabelText('老人档案列表')
    expect(archive).toHaveTextContent('王秀兰')
    expect(archive).toHaveTextContent('82岁')
    expect(archive).toHaveTextContent('302房')
    expect(archive).toHaveTextContent('在院')
    expect(archive).toHaveTextContent('已绑定家属2')
  })

  it('runs the complete staff invitation to family request golden path', async () => {
    useDemoStore.getState().resetGoldenPathDemo()
    window.location.hash = '#/staff/elders'
    render(<App />)

    fireEvent.click(await screen.findByRole('link', { name: '管理家属' }))
    expect(await screen.findByRole('heading', { name: '王秀兰' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '发送绑定邀请' }))
    const pendingRelation = Object.values(useDemoStore.getState().elderFamilyRelations)
      .find((relation) => relation.familyUserId === 'F001')
    expect(pendingRelation).toMatchObject({ elderId: 'E001', status: 'PENDING' })

    fireEvent.change(screen.getByLabelText('切换体验身份'), { target: { value: 'FAMILY' } })
    expect(await screen.findByRole('heading', { name: '待确认绑定' })).toBeInTheDocument()
    expect(screen.getByText('安序养老服务中心邀请您绑定老人档案')).toBeInTheDocument()
    expect(screen.getByText('母亲')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认绑定' }))
    expect(useDemoStore.getState().elderFamilyRelations[pendingRelation!.relationId]).toMatchObject({ status: 'VERIFIED' })

    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    expect(await screen.findByRole('heading', { name: '王秀兰今天' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /联系不上老人/ }))
    fireEvent.change(screen.getByLabelText('最后一次联系时间'), { target: { value: '2026-09-16T09:00' } })
    fireEvent.change(screen.getByLabelText('已尝试联系次数'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '提交联系确认' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      requestType: 'UNREACHABLE_ELDER', subjectElderId: 'E001', requesterId: 'F001',
      relationId: pendingRelation!.relationId, institutionId: 'I001', priority: 'P0',
    })

    fireEvent.change(screen.getByLabelText('切换体验身份'), { target: { value: 'STAFF' } })
    const familyRequestSection = await screen.findByRole('heading', { name: 'Family Request' })
    expect(familyRequestSection.closest('section')).toHaveTextContent('王秀兰')
    expect(familyRequestSection.closest('section')).toHaveTextContent('李晓雯')
    expect(familyRequestSection.closest('section')).toHaveTextContent('女儿')
    expect(familyRequestSection.closest('section')).toHaveTextContent('主要联系人')
    fireEvent.click(screen.getByRole('button', { name: '接单' }))
    fireEvent.click(screen.getByRole('link', { name: /查看详情/ }))
    fireEvent.click(await screen.findByRole('button', { name: '开始服务' }))
    const result = '已到房间确认王秀兰目前情况正常，并已协助老人联系家属。'
    fireEvent.change(screen.getByLabelText('处理结果'), { target: { value: result } })
    fireEvent.click(screen.getByRole('button', { name: '完成并反馈家属' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({ status: 'COMPLETED', resolutionResult: result })

    fireEvent.change(screen.getByLabelText('切换体验身份'), { target: { value: 'FAMILY' } })
    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    fireEvent.click(await screen.findByRole('link', { name: /查看详情/ }))
    expect(await screen.findByText(result)).toBeInTheDocument()
    expect(screen.getByText('CASE RESOLVED')).toBeInTheDocument()
  })

  it('runs a family contact request through staff result feedback', async () => {
    window.location.hash = '#/family'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    fireEvent.click(await screen.findByRole('button', { name: /联系不上老人/ }))
    fireEvent.change(screen.getByLabelText('最后一次联系时间'), { target: { value: '2026-09-16T09:00' } })
    fireEvent.change(screen.getByLabelText('已尝试联系次数'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '提交联系确认' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      priority: 'P0',
      status: 'WAITING',
    })

    fireEvent.change(screen.getByLabelText('切换体验身份'), { target: { value: 'STAFF' } })
    expect(await screen.findByRole('heading', { name: 'Family Request' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '接单' }))
    fireEvent.click(screen.getByRole('link', { name: /查看详情/ }))
    fireEvent.click(await screen.findByRole('button', { name: '开始服务' }))
    fireEvent.change(screen.getByLabelText('处理结果'), { target: { value: '已上门确认，老人状态平稳，并已协助回电。' } })
    fireEvent.click(screen.getByRole('button', { name: '完成并反馈家属' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      status: 'COMPLETED',
      resolutionResult: '已上门确认，老人状态平稳，并已协助回电。',
    })

    fireEvent.change(screen.getByLabelText('切换体验身份'), { target: { value: 'FAMILY' } })
    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    expect(await screen.findByText('处理结果已反馈')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /查看详情/ }))
    expect(await screen.findByText('已上门确认，老人状态平稳，并已协助回电。')).toBeInTheDocument()
    expect(screen.getByText('CASE RESOLVED')).toBeInTheDocument()
  })

  it('runs the P0 fall flow through elder, family, and staff views', async () => {
    window.location.hash = '#/elder'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /演示工具/ }))
    fireEvent.click(await screen.findByRole('button', { name: '体验紧急 Case' }))

    expect(await screen.findByRole('heading', { name: '检测到跌倒相关安全风险' })).toBeInTheDocument()
    expect(useDemoStore.getState().cases['CASE-002']).toMatchObject({
      priority: 'P0',
      status: 'WAITING_FOR_REVIEW',
    })
    fireEvent.click(screen.getByRole('button', { name: '头晕' }))
    expect(useDemoStore.getState().cases['CASE-002']).toMatchObject({
      status: 'WAITING_FOR_REVIEW',
      priority: 'P0',
      reportedSymptoms: ['DIZZINESS'],
    })

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'FAMILY' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    expect(await screen.findByRole('heading', { name: '王秀兰刚刚报告发生跌倒' })).toBeInTheDocument()
    expect(screen.getByText('等待工作人员确认')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'STAFF' },
    })
    expect(await screen.findByRole('heading', { name: 'P0 紧急事件' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /立即处理/ }))
    fireEvent.click(await screen.findByRole('button', { name: '确认风险并介入' }))
    expect(useDemoStore.getState().cases['CASE-002'].status).toBe('IN_PROGRESS')
    expect(screen.getByText('人工确认风险')).toBeInTheDocument()
    expect(screen.getByText('工作人员已介入处理')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'FAMILY' },
    })
    fireEvent.click(await screen.findByRole('button', { name: '进入' }))
    expect(await screen.findByText('工作人员已介入处理')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'STAFF' },
    })
    fireEvent.click(await screen.findByRole('link', { name: /继续处理/ }))
    fireEvent.click(await screen.findByRole('button', { name: '完成处理' }))
    expect(useDemoStore.getState().cases['CASE-002'].status).toBe('COMPLETED')
    expect(await screen.findByText('CASE RESOLVED')).toBeInTheDocument()
  })

  it('puts a voice transcript into the same editable input and waits for explicit send', async () => {
    let recognition: MockSpeechRecognition | null = null
    class MockSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: SpeechRecognitionResultEventLike) => void) | null = null
      onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null
      onend: (() => void) | null = null
      start = vi.fn()
      stop = vi.fn()
      constructor() { recognition = this }
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: MockSpeechRecognition, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      configurable: true,
    })
    window.location.hash = '#/elder'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '开始语音输入' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '停止语音输入' })).toBeInTheDocument())
    await act(async () => {
      recognition?.onresult?.({ results: [[{ transcript: '我现在喘不上气' }]] })
      recognition?.onend?.()
    })

    const input = screen.getByLabelText('告诉安序智护您的需要')
    expect(input).toHaveValue('我现在喘不上气')
    expect(useDemoStore.getState().conversationState.elder.messages).toHaveLength(0)
    fireEvent.change(input, { target: { value: '我现在喘不上气，请帮帮我' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(openhexMock.send).toHaveBeenCalledWith('我现在喘不上气，请帮帮我'))
    expect(useDemoStore.getState().cases).toEqual({})
  })

  it('keeps text input usable after microphone permission is rejected', async () => {
    class MockSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult = null
      onerror = null
      onend = null
      start = vi.fn()
      stop = vi.fn()
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: MockSpeechRecognition, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
      configurable: true,
    })
    window.location.hash = '#/elder'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '开始语音输入' }))
    expect(await screen.findByText('麦克风权限未开启，请允许访问或继续使用文字输入。')).toBeInTheDocument()

    const input = screen.getByLabelText('告诉安序智护您的需要')
    expect(input).toBeEnabled()
    fireEvent.change(input, { target: { value: '我想说件事情' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('这是来自 OpenHex Agent 的回复。')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('renders event-specific risk follow-up options', async () => {
    window.location.hash = '#/elder'
    useDemoUiStore.getState().setExperienceMode('PHASE4')
    useDemoStore.getState().submitElderMessage('我现在喘不上气')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '检测到呼吸困难相关安全风险' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '说话很困难' })).toBeInTheDocument()

    cleanup()
    useDemoStore.getState().resetDemo()
    useDemoStore.getState().submitElderMessage('屋里闻到煤气味')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '检测到环境危险相关安全风险' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '闻到煤气味' })).toBeInTheDocument()
  })
})
