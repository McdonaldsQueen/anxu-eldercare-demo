import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDemoStore } from '../../store/demoStore'
import { FamilyConversation } from './FamilyConversation'

describe('FamilyConversation', () => {
  beforeEach(() => {
    localStorage.clear()
    useDemoStore.getState().resetDemo()
  })
  afterEach(cleanup)

  it('provides a genuinely editable input and submits with Enter', () => {
    render(<FamilyConversation />)
    const input = screen.getByLabelText('告诉安序智护您的家属需求')
    expect(input).toBeEnabled()
    expect(input).not.toHaveAttribute('readonly')
    fireEvent.change(input, { target: { value: '我今天一直联系不上我妈' } })
    expect(input).toHaveValue('我今天一直联系不上我妈')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('')
    expect(useDemoStore.getState().cases['CASE-001'].caseType).toBe('FAMILY_REQUEST')
  })
})
