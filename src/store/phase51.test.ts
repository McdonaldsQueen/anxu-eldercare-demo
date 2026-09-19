import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoStore } from './demoStore'

const inviteLiXiaowen = (store: ReturnType<typeof createDemoStore>, elderId = 'E001') => {
  store.getState().setActiveRole('STAFF')
  return store.getState().inviteFamilyRelation({
    elderId,
    familyName: '李晓雯',
    phone: '13800000001',
    relationship: 'DAUGHTER',
    contactRole: 'PRIMARY_CONTACT',
  })
}

describe('Phase 5.1 identity and relationship binding', () => {
  beforeEach(() => localStorage.clear())

  it('initializes the fixed institution, elder, family, staff, and two verified relations', () => {
    const store = createDemoStore('p51-fixed-identities')
    expect(store.getState().institutions.I001.name).toBe('安序养老服务中心')
    expect(store.getState().elderProfiles.E001).toMatchObject({ name: '王秀兰', age: 82, room: '302', status: 'IN_RESIDENCE' })
    expect(store.getState().familyProfiles.F001.name).toBe('李晓雯')
    expect(store.getState().familyProfiles.F002.name).toBe('王志远')
    expect(store.getState().staffProfiles.S001.name).toBe('陈静')
    expect(Object.values(store.getState().elderFamilyRelations).filter((relation) => relation.elderId === 'E001' && relation.status === 'VERIFIED')).toHaveLength(2)
  })

  it('lets staff create a pending invitation and only exposes the elder after family confirmation', () => {
    const store = createDemoStore('p51-pending-verified')
    store.getState().resetGoldenPathDemo()
    const relationId = inviteLiXiaowen(store)
    expect(relationId).toBeTruthy()
    expect(store.getState().elderFamilyRelations[relationId!]).toMatchObject({
      elderId: 'E001', familyUserId: 'F001', status: 'PENDING', verifiedAt: null,
    })

    store.getState().setActiveRole('FAMILY')
    expect(store.getState().selectFamilyElder('E001')).toBe(false)
    expect(store.getState().confirmFamilyRelation(relationId!)).toBe(true)
    expect(store.getState().elderFamilyRelations[relationId!].status).toBe('VERIFIED')
    expect(store.getState().elderFamilyRelations[relationId!].verifiedAt).toBeTruthy()
    expect(store.getState().selectFamilyElder('E001')).toBe(true)
  })

  it('persists one shared relation so staff and family sessions observe the same status', () => {
    const staffSession = createDemoStore('p51-shared-relation')
    staffSession.getState().resetGoldenPathDemo()
    const relationId = inviteLiXiaowen(staffSession)!

    const familySession = createDemoStore('p51-shared-relation')
    expect(familySession.getState().elderFamilyRelations[relationId].status).toBe('PENDING')
    familySession.getState().setActiveRole('FAMILY')
    expect(familySession.getState().confirmFamilyRelation(relationId)).toBe(true)

    const refreshedStaffSession = createDemoStore('p51-shared-relation')
    expect(refreshedStaffSession.getState().elderFamilyRelations[relationId]).toMatchObject({
      status: 'VERIFIED',
      verifiedAt: expect.any(String),
    })
  })

  it('binds new family cases to the verified relation and elder institution', () => {
    const store = createDemoStore('p51-case-relation')
    const contactCaseId = store.getState().createFamilyContactRequest({
      elderId: 'E001', requesterId: 'F001', relationId: 'REL-001',
      lastContactTime: '2026-09-16T09:00', contactAttempts: 3, additionalNote: '',
    })
    expect(store.getState().cases[contactCaseId!]).toMatchObject({
      caseType: 'FAMILY_REQUEST', requestType: 'UNREACHABLE_ELDER',
      subjectElderId: 'E001', requesterId: 'F001', relationId: 'REL-001', institutionId: 'I001', priority: 'P0',
    })

    const itemCaseId = store.getState().createFamilyItemRequest({
      elderId: 'E001', requesterId: 'F001', relationId: 'REL-001',
      itemName: '秋季外套', itemCategory: 'CLOTHING', quantity: 1,
      deliveryMethod: 'FAMILY_DROP_OFF', expectedDeliveryTime: '2026-09-17T14:00', specialInstruction: '',
    })
    expect(store.getState().cases[itemCaseId!]).toMatchObject({
      requestType: 'ITEM_HANDOVER', relationId: 'REL-001', institutionId: 'I001', priority: 'P1',
    })
  })

  it('rejects family case creation through a pending or mismatched relation', () => {
    const store = createDemoStore('p51-relation-guard')
    store.getState().resetGoldenPathDemo()
    const relationId = inviteLiXiaowen(store)!
    store.getState().setActiveRole('FAMILY')
    expect(store.getState().createFamilyContactRequest({
      elderId: 'E001', requesterId: 'F001', relationId,
      lastContactTime: '2026-09-16T09:00', contactAttempts: 2, additionalNote: '',
    })).toBeNull()
    expect(store.getState().createFamilyContactRequest({
      elderId: 'E001', requesterId: 'F001', relationId: 'REL-002',
      lastContactTime: '2026-09-16T09:00', contactAttempts: 2, additionalNote: '',
    })).toBeNull()
  })

  it('supports one elder with multiple family members and one family member with multiple elders', () => {
    const store = createDemoStore('p51-many-to-many')
    const e001Relations = Object.values(store.getState().elderFamilyRelations).filter((relation) => relation.elderId === 'E001')
    expect(e001Relations.map((relation) => relation.familyUserId).sort()).toEqual(['F001', 'F002'])

    store.getState().saveElderProfile({
      elderId: 'E002', institutionId: 'I001', name: '赵春梅', age: 79, room: '208', status: 'IN_RESIDENCE',
    })
    const relationId = inviteLiXiaowen(store, 'E002')!
    store.getState().setActiveRole('FAMILY')
    expect(store.getState().confirmFamilyRelation(relationId)).toBe(true)
    const f001Relations = Object.values(store.getState().elderFamilyRelations)
      .filter((relation) => relation.familyUserId === 'F001' && relation.status === 'VERIFIED')
    expect(f001Relations.map((relation) => relation.elderId).sort()).toEqual(['E001', 'E002'])
  })

  it('standard reset restores all relationship data while golden-path reset prepares a fresh F001 invitation', () => {
    const store = createDemoStore('p51-reset-relations')
    store.getState().resetGoldenPathDemo()
    expect(store.getState().elderFamilyRelations['REL-001']).toBeUndefined()
    expect(store.getState().cases).toEqual({})
    expect(store.getState().conversationState.elder.messages).toEqual([])

    store.getState().resetDemo()
    expect(store.getState().elderFamilyRelations['REL-001']).toMatchObject({ familyUserId: 'F001', status: 'VERIFIED' })
    expect(store.getState().elderFamilyRelations['REL-002']).toMatchObject({ familyUserId: 'F002', status: 'VERIFIED' })
    expect(store.getState().selectedFamilyElderId).toBeNull()
  })
})
