import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import { useDemoStore } from '../../store/demoStore'

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response

describe('OpenHex experience mode', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useDemoStore.getState().resetDemo()
    window.location.hash = '#/elder'
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('reuses the returned conversationId without writing to the Demo Store', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        reply: '收到，我会记住。',
        conversationId: 'conversation-123',
        reusedConversationId: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        reply: '暗号是 ORBIT-7。',
        conversationId: 'conversation-123',
        reusedConversationId: true,
      }))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'OpenHex 体验' }))
    const input = screen.getByLabelText('告诉安序智护您的需要')

    fireEvent.change(input, { target: { value: '记住暗号 ORBIT-7' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('收到，我会记住。')).toBeInTheDocument()
    expect(screen.getByText('conversationId: conversation-123')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '暗号是什么？' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('暗号是 ORBIT-7。')).toBeInTheDocument()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/openhex/chat', expect.objectContaining({
      body: JSON.stringify({ message: '记住暗号 ORBIT-7' }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/openhex/chat', expect.objectContaining({
      body: JSON.stringify({ message: '暗号是什么？', conversationId: 'conversation-123' }),
    }))
    expect(useDemoStore.getState().conversationState.elder.messages).toEqual([])
    expect(useDemoStore.getState().cases).toEqual({})
  })

  it('keeps Mock Demo available after an OpenHex request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      message: 'OpenHex unavailable',
    }, false, 502)))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'OpenHex 体验' }))
    const input = screen.getByLabelText('告诉安序智护您的需要')
    fireEvent.change(input, { target: { value: '测试 OpenHex' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('原有 Demo 未受影响')

    fireEvent.click(screen.getByRole('button', { name: 'Mock Demo' }))
    fireEvent.change(input, { target: { value: '我明天下午要去医院，但是没人陪我。' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(useDemoStore.getState().conversationState.elder.messages).toHaveLength(2))
  })
})
