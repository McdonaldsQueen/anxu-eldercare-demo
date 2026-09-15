import type { CareCase, CareCaseStatus, Role, TimelineEvent } from './models'

const SERVICE_TRANSITIONS: Partial<Record<CareCaseStatus, CareCaseStatus>> = {
  WAITING: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const SAFETY_TRANSITIONS: Partial<Record<CareCaseStatus, CareCaseStatus>> = {
  WAITING_FOR_REVIEW: 'CONFIRMED',
  CONFIRMED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const isServiceCase = (careCase: CareCase) =>
  ['SERVICE', 'FAMILY_REQUEST', 'MOBILITY'].includes(careCase.caseType)

const serviceLabel = (careCase: CareCase, targetStatus: CareCaseStatus) => {
  if (targetStatus === 'ACCEPTED') return '李师傅已接单'
  if (targetStatus === 'IN_PROGRESS') {
    return careCase.caseType === 'FAMILY_REQUEST' ? '工作人员已开始处理家属需求' : '李师傅已开始服务'
  }
  if (targetStatus === 'COMPLETED') {
    return careCase.caseType === 'FAMILY_REQUEST' ? '家属需求已完成并同步结果' : '服务已完成'
  }
  return null
}

const appendTransition = (
  careCase: CareCase,
  targetStatus: CareCaseStatus,
  actorRole: Role,
  occurredAt: string,
  label: string,
): CareCase => ({
  ...careCase,
  status: targetStatus,
  assignedStaff: targetStatus === 'ACCEPTED' || targetStatus === 'CONFIRMED'
    ? '李师傅'
    : careCase.assignedStaff,
  arrivalTime: targetStatus === 'ACCEPTED' && careCase.serviceType === 'MEDICAL_ESCORT'
    ? '明日 13:40'
    : careCase.arrivalTime,
  reviewConfirmedAt: targetStatus === 'CONFIRMED' ? occurredAt : careCase.reviewConfirmedAt,
  interventionStartedAt: targetStatus === 'IN_PROGRESS' ? occurredAt : careCase.interventionStartedAt,
  updatedAt: occurredAt,
  timeline: [...careCase.timeline, {
    id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
    occurredAt,
    label,
    actorRole,
    statusAfter: targetStatus,
  } satisfies TimelineEvent],
})

export interface CaseTransitionResult {
  ok: boolean
  careCase: CareCase
  reason?: string
}

export function transitionServiceCase(
  careCase: CareCase,
  targetStatus: CareCaseStatus,
  actorRole: Role,
  occurredAt: string,
): CaseTransitionResult {
  if (!isServiceCase(careCase)) return { ok: false, careCase, reason: '该任务不是可履约服务。' }
  if (actorRole !== 'STAFF') return { ok: false, careCase, reason: '只有服务人员可以推进任务。' }
  if (SERVICE_TRANSITIONS[careCase.status] !== targetStatus) {
    return { ok: false, careCase, reason: '当前状态不能执行此操作。' }
  }
  const label = serviceLabel(careCase, targetStatus)
  if (!label) return { ok: false, careCase, reason: '缺少状态记录。' }
  return { ok: true, careCase: appendTransition(careCase, targetStatus, actorRole, occurredAt, label) }
}

/** Backward-compatible Phase 3.5 export. */
export const transitionEscortCase = transitionServiceCase

export function transitionSafetyCase(
  careCase: CareCase,
  targetStatus: CareCaseStatus,
  actorRole: Role,
  occurredAt: string,
): CaseTransitionResult {
  if (careCase.caseType !== 'SAFETY' || !careCase.eventType) {
    return { ok: false, careCase, reason: '该任务不是安全事件。' }
  }
  if (actorRole !== 'STAFF') return { ok: false, careCase, reason: '安全事件必须由工作人员处理。' }
  if (SAFETY_TRANSITIONS[careCase.status] !== targetStatus) {
    return { ok: false, careCase, reason: '当前风险状态不能执行此操作。' }
  }
  if (targetStatus === 'CONFIRMED' && (!careCase.finalPriority || !careCase.finalRiskType)) {
    return { ok: false, careCase, reason: '请先完成人工风险分类。' }
  }
  const label = targetStatus === 'CONFIRMED'
    ? '人工确认风险'
    : targetStatus === 'IN_PROGRESS'
      ? '工作人员已介入处理'
      : '风险事件处理已完成'
  return { ok: true, careCase: appendTransition(careCase, targetStatus, actorRole, occurredAt, label) }
}
