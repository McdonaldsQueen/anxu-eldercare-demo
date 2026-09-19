import type {
  ElderFamilyRelationStatus,
  ElderProfileStatus,
  FamilyContactRole,
  FamilyRelationship,
} from './models'

export const RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  DAUGHTER: '女儿',
  SON: '儿子',
  SPOUSE: '配偶',
  OTHER: '其他',
}

export const ELDER_RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  DAUGHTER: '母亲',
  SON: '母亲',
  SPOUSE: '配偶',
  OTHER: '家人',
}

export const CONTACT_ROLE_LABELS: Record<FamilyContactRole, string> = {
  PRIMARY_CONTACT: '主要联系人',
  EMERGENCY_CONTACT: '紧急联系人',
  FAMILY_MEMBER: '普通家属',
}

export const RELATION_STATUS_LABELS: Record<ElderFamilyRelationStatus, string> = {
  PENDING: '待确认',
  VERIFIED: '已绑定',
  REVOKED: '已撤销',
}

export const ELDER_STATUS_LABELS: Record<ElderProfileStatus, string> = {
  IN_RESIDENCE: '在院',
  DISCHARGED: '已离院',
}
