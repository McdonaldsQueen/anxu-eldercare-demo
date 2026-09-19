import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDemoStore } from '../../store/demoStore'
import { FamilyConversation } from './FamilyConversation'

const renderConversation = () => {
  const state = useDemoStore.getState()
  return render(
    <FamilyConversation
      elder={state.elderProfiles.E001}
      family={state.familyProfiles.F001}
      relation={state.elderFamilyRelations['REL-001']}
    />,
  )
}

describe('FamilyConversation structured requests', () => {
  beforeEach(() => {
    localStorage.clear()
    useDemoStore.getState().resetDemo()
  })
  afterEach(cleanup)

  it('creates a P0 contact-check FAMILY_REQUEST from the explicit form', () => {
    renderConversation()
    expect(screen.queryByLabelText('告诉安序智护您的家属需求')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /联系不上老人/ }))
    fireEvent.change(screen.getByLabelText('最后一次联系时间'), { target: { value: '2026-09-16T09:00' } })
    fireEvent.change(screen.getByLabelText('已尝试联系次数'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('补充说明（可选）'), { target: { value: '平时上午会接电话' } })
    fireEvent.click(screen.getByRole('button', { name: '提交联系确认' }))

    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      familyRequestType: 'CONTACT_CHECK',
      priority: 'P0',
      contactAttempts: 3,
    })
    expect(screen.getByRole('status')).toHaveTextContent('CASE-001 已创建')
  })

  it('creates an ordinary P1 handover without inferring medication', () => {
    renderConversation()
    fireEvent.click(screen.getByRole('button', { name: /转交物品/ }))
    expect(screen.queryByLabelText('药品包装备注（可选）')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('物品名称'), { target: { value: '药盒造型收纳箱' } })
    fireEvent.change(screen.getByLabelText('物品类别'), { target: { value: 'FOOD' } })
    fireEvent.change(screen.getByLabelText('预计送达时间'), { target: { value: '2026-09-17T14:00' } })
    fireEvent.click(screen.getByRole('button', { name: '提交物品转交' }))

    expect(useDemoStore.getState().cases['CASE-001']).toMatchObject({
      caseType: 'FAMILY_REQUEST',
      priority: 'P1',
      itemCategory: 'FOOD',
      itemType: 'GENERAL',
    })
    expect(useDemoStore.getState().cases['CASE-001'].providedDosageInstructions).toBeNull()
  })

  it('shows medication-only fields only after MEDICATION is selected', () => {
    renderConversation()
    fireEvent.click(screen.getByRole('button', { name: /转交物品/ }))
    expect(screen.queryByLabelText('药品包装备注（可选）')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('物品类别'), { target: { value: 'MEDICATION' } })
    expect(screen.getByLabelText('药品包装备注（可选）')).toBeInTheDocument()
    expect(screen.getByText('系统不会生成剂量、用法、服药频率或医疗建议。')).toBeInTheDocument()
  })
})
