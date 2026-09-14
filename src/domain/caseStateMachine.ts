import type { CareCase, CareCaseStatus, Role, TimelineEvent } from './models'

const ESCORT_TRANSITIONS: Partial<
  Record<CareCaseStatus, CareCaseStatus>
> = {
  WAITING: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const TRANSITION_LABELS: Partial<Record<CareCaseStatus, string>> = {
  ACCEPTED: '李师傅已接单',
  IN_PROGRESS: '李师傅已开始陪诊服务',
  COMPLETED: '陪诊服务已完成',
}

const SAFETY_TRANSITIONS: Partial<Record<CareCaseStatus, CareCaseStatus>> = {
  WAITING_FOR_REVIEW: 'CONFIRMED',
  CONFIRMED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const SAFETY_TRANSITION_LABELS: Partial<Record<CareCaseStatus, string>> = {
  CONFIRMED: '人工确认风险',
  IN_PROGRESS: '工作人员已介入处理',
  COMPLETED: '风险事件处理已完成',
}

export interface CaseTransitionResult {
  ok: boolean
  careCase: CareCase
  reason?: string
}

export function transitionEscortCase(
  careCase: CareCase,
  targetStatus: CareCaseStatus,
  actorRole: Role,
  occurredAt: string,
): CaseTransitionResult {
  if (
    careCase.caseType !== 'MOBILITY' ||
    careCase.serviceType !== 'MEDICAL_ESCORT'
  ) {
    return { ok: false, careCase, reason: '该任务不是陪诊服务。' }
  }

  if (actorRole !== 'STAFF') {
    return { ok: false, careCase, reason: '只有服务人员可以推进任务。' }
  }

  if (ESCORT_TRANSITIONS[careCase.status] !== targetStatus) {
    return { ok: false, careCase, reason: '当前状态不能执行此操作。' }
  }

  const label = TRANSITION_LABELS[targetStatus]
  if (!label) return { ok: false, careCase, reason: '缺少状态记录。' }

  const timelineEvent: TimelineEvent = {
    id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
    occurredAt,
    label,
    actorRole,
    statusAfter: targetStatus,
  }

  return {
    ok: true,
    careCase: {
      ...careCase,
      status: targetStatus,
      assignedStaff:
        targetStatus === 'ACCEPTED' ? '李师傅' : careCase.assignedStaff,
      arrivalTime:
        targetStatus === 'ACCEPTED' ? '明日 13:40' : careCase.arrivalTime,
      updatedAt: occurredAt,
      timeline: [...careCase.timeline, timelineEvent],
    },
  }
}

export function transitionSafetyCase(
  careCase: CareCase,
  targetStatus: CareCaseStatus,
  actorRole: Role,
  occurredAt: string,
): CaseTransitionResult {
  if (careCase.caseType !== 'SAFETY' || !careCase.eventType) {
    return { ok: false, careCase, reason: '该任务不是安全事件。' }
  }

  if (actorRole !== 'STAFF') {
    return { ok: false, careCase, reason: 'P0 风险必须由服务人员处理。' }
  }

  if (SAFETY_TRANSITIONS[careCase.status] !== targetStatus) {
    return { ok: false, careCase, reason: '当前风险状态不能执行此操作。' }
  }

  const label = SAFETY_TRANSITION_LABELS[targetStatus]
  if (!label) return { ok: false, careCase, reason: '缺少风险状态记录。' }

  const timelineEvent: TimelineEvent = {
    id: `${careCase.caseId}-timeline-${careCase.timeline.length + 1}`,
    occurredAt,
    label,
    actorRole,
    statusAfter: targetStatus,
  }

  return {
    ok: true,
    careCase: {
      ...careCase,
      status: targetStatus,
      assignedStaff:
        targetStatus === 'CONFIRMED' ? '李师傅' : careCase.assignedStaff,
      reviewConfirmedAt:
        targetStatus === 'CONFIRMED'
          ? occurredAt
          : careCase.reviewConfirmedAt,
      interventionStartedAt:
        targetStatus === 'IN_PROGRESS'
          ? occurredAt
          : careCase.interventionStartedAt,
      updatedAt: occurredAt,
      timeline: [...careCase.timeline, timelineEvent],
    },
  }
}
