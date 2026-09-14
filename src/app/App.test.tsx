import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { useDemoStore } from '../store/demoStore'
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionResultEventLike,
} from '../services/speechRecognition'

describe('Phase 1 and Phase 2 routes and interactions', () => {
  afterEach(cleanup)

  beforeEach(() => {
    localStorage.clear()
    useDemoStore.getState().resetDemo()
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
    expect(await screen.findByRole('heading', { name: '妈妈今天' })).toBeInTheDocument()
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

    fireEvent.click(await screen.findByRole('button', { name: '重置 Demo' }))
    expect(screen.getByText('恢复初始状态？')).toBeInTheDocument()
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

  it('accepts real keyboard input, clears each send, and creates one case after two turns', async () => {
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
    expect(input).toHaveValue('')
    expect(await screen.findByText('可以，我帮您安排。您去哪家医院？大概几点的号？')).toBeInTheDocument()
    expect(useDemoStore.getState().cases).toEqual({})
    expect(input).toBeEnabled()

    fireEvent.change(input, { target: { value: '朝阳医院，下午两点半。' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(input).toHaveValue('')
    expect(await screen.findByText('好的，我记下了。我现在帮您联系服务中心安排陪诊，有结果马上告诉您。')).toBeInTheDocument()
    expect(Object.keys(useDemoStore.getState().cases)).toEqual(['CASE-001'])
    expect(input).toBeEnabled()

    fireEvent.change(input, { target: { value: '朝阳医院，下午两点半。' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(Object.keys(useDemoStore.getState().cases)).toEqual(['CASE-001'])
  })

  it('completes the shared staff workflow and exposes the resolved state', async () => {
    useDemoStore.getState().submitElderMessage('我明天下午要去医院，但是没人陪我。')
    useDemoStore.getState().submitElderMessage('朝阳医院，下午两点半。')
    window.location.hash = '#/staff'
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '接单' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('ACCEPTED')
    expect(screen.getByText(/李师傅已接单/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /查看详情/ }))
    fireEvent.click(await screen.findByRole('button', { name: '开始服务' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('IN_PROGRESS')
    fireEvent.click(screen.getByRole('button', { name: '完成服务' }))
    expect(useDemoStore.getState().cases['CASE-001'].status).toBe('COMPLETED')
    expect(await screen.findByText('CASE RESOLVED')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('切换体验身份'), {
      target: { value: 'FAMILY' },
    })
    expect(await screen.findByText('服务已完成')).toBeInTheDocument()
    expect(screen.getByText(/明日下午陪诊/)).toBeInTheDocument()
  })

  it('runs the P0 fall flow through elder, family, and staff views', async () => {
    window.location.hash = '#/elder'
    render(<App />)

    const input = await screen.findByLabelText('告诉安序智护您的需要')
    fireEvent.change(input, { target: { value: '我刚刚摔了一跤，现在起不来了' } })
    fireEvent.keyDown(input, { key: 'Enter' })

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
    expect(await screen.findByRole('heading', { name: '妈妈刚刚报告发生跌倒' })).toBeInTheDocument()
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
    expect(useDemoStore.getState().cases['CASE-002'].eventType).toBe('BREATHING_DIFFICULTY')
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
    expect(input).toHaveValue('')
    expect(await screen.findByText(/我还没完全听明白/)).toBeInTheDocument()
  })

  it('renders event-specific risk follow-up options', async () => {
    window.location.hash = '#/elder'
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
