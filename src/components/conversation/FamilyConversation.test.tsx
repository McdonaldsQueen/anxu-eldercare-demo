import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDemoStore } from '../../store/demoStore'
import { FamilyConversation } from './FamilyConversation'

const renderConversation = () => {
  const state = useDemoStore.getState()
  return render(<FamilyConversation elder={state.elderProfiles.E001} family={state.familyProfiles.F001} relation={state.elderFamilyRelations['REL-001']} />)
}

describe('FamilyConversation natural requests', () => {
  beforeEach(() => { localStorage.clear(); useDemoStore.getState().resetDemo() })
  afterEach(cleanup)

  it('submits a contact check from one natural description', () => {
    renderConversation()
    expect(screen.getByText('选项说明')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /联系确认/ }))
    fireEvent.change(screen.getByLabelText('请描述主要问题'), { target: { value: '上午多次联系未果，希望确认老人安全。' } })
    fireEvent.click(screen.getByRole('button', { name: '提交需求' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      caseSource: 'FAMILY_REQUEST', caseType: 'FAMILY_REQUEST', priority: 'P0',
      requesterId: 'F001', subjectElderId: 'E001',
    })
    expect(screen.getByRole('status')).toHaveTextContent('CASE-001 已提交')
  })

  it('routes ordinary items directly and uncertain items to evaluation', () => {
    renderConversation()
    fireEvent.click(screen.getByRole('button', { name: /物品转交/ }))
    fireEvent.change(screen.getByLabelText('请描述物品及交接需求'), { target: { value: '给妈妈送一件外套' } })
    fireEvent.click(screen.getByRole('button', { name: '提交需求' }))
    expect(useDemoStore.getState().cases['CASE-001'].caseType).toBe('FAMILY_REQUEST')
    fireEvent.click(screen.getByRole('button', { name: /物品转交/ }))
    fireEvent.change(screen.getByLabelText('请描述物品及交接需求'), { target: { value: '转交一盒药品' } })
    fireEvent.click(screen.getByRole('button', { name: '提交需求' }))
    expect(useDemoStore.getState().cases['CASE-002']).toMatchObject({ caseType: 'EVALUATION', evaluationDecision: 'PENDING' })
  })

  it('routes other requests to staff evaluation', () => {
    renderConversation()
    fireEvent.click(screen.getByRole('button', { name: /其他/ }))
    fireEvent.change(screen.getByLabelText('请描述主要问题'), { target: { value: '希望有人帮忙安排探望' } })
    fireEvent.click(screen.getByRole('button', { name: '提交需求' }))
    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({ caseType: 'EVALUATION', caseSource: 'FAMILY_REQUEST' })
  })
})
