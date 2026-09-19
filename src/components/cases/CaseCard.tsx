import type { CareCase } from '../../domain/models'
import { Link } from 'react-router-dom'
import { RISK_CATALOG } from '../../domain/riskCatalog'
import { AlertIcon, ArrowIcon, ClipboardIcon } from '../ui/Icons'
import { useDemoStore } from '../../store/demoStore'
import { RELATIONSHIP_LABELS } from '../../domain/identity'

const SERVICE_STATUS_LABELS: Record<CareCase['status'], string> = {
  WAITING: '正在安排工作人员',
  ACCEPTED: '工作人员已接单',
  DECLINED: '评估后暂不承接',
  WAITING_FOR_REVIEW: '等待工作人员确认',
  CONFIRMED: '风险已人工确认',
  IN_PROGRESS: '正在处理',
  COMPLETED: '服务已完成',
}

const SAFETY_STATUS_LABELS: Record<CareCase['status'], string> = {
  WAITING: '等待工作人员确认',
  ACCEPTED: '工作人员已确认',
  DECLINED: '已标记为非安全事件',
  WAITING_FOR_REVIEW: '等待工作人员确认',
  CONFIRMED: '工作人员已确认',
  IN_PROGRESS: '工作人员已介入处理',
  COMPLETED: '风险事件处理完成',
}

const FAMILY_STATUS_LABELS: Record<CareCase['status'], string> = {
  ...SERVICE_STATUS_LABELS,
  WAITING: '等待工作人员接单',
  IN_PROGRESS: '工作人员正在处理',
  COMPLETED: '处理结果已反馈',
}

interface CaseCardProps {
  careCase: CareCase
  detailHref: string
  actionLabel?: string
  onAction?: () => void
  detailLabel?: string
  staffContext?: boolean
}

export function CaseCard({
  careCase,
  detailHref,
  actionLabel,
  onAction,
  detailLabel = '查看详情',
  staffContext = false,
}: CaseCardProps) {
  const elder = useDemoStore((state) => state.elderProfiles[careCase.subjectElderId])
  const family = useDemoStore((state) => state.familyProfiles[careCase.requesterId])
  const relation = useDemoStore((state) => careCase.relationId ? state.elderFamilyRelations[careCase.relationId] : undefined)
  const isRisk = careCase.caseType === 'SAFETY'
  const isFamilyRequest = careCase.caseType === 'FAMILY_REQUEST'
  const displayedRiskType = careCase.finalRiskType ?? careCase.eventType
  const riskDefinition = displayedRiskType ? RISK_CATALOG[displayedRiskType] : null
  const [appointmentDate = '', appointmentClock = ''] = careCase.appointmentTime?.split(' ') ?? []
  const escortPeriod = Number(appointmentClock.split(':')[0]) >= 12 ? '下午' : '上午'
  const escortTitle = `${appointmentDate}${escortPeriod}陪诊`
  const title = careCase.serviceType === 'MEDICAL_ESCORT'
    ? escortTitle
    : careCase.title ?? '服务需求'
  const eyebrow = isRisk
    ? careCase.status === 'COMPLETED'
      ? careCase.safetyReviewOutcome === 'FALSE_POSITIVE' ? '人工审核 · 非 Safety Case' : '风险事件已处理'
      : careCase.status === 'WAITING_FOR_REVIEW'
        ? `${careCase.suggestedRiskLevel ?? 'P0'} · ${careCase.caseSource === 'WEARABLE_SENSOR' ? '设备规则提示' : 'AI 建议'}，待人工审核`
        : `${careCase.finalPriority ?? careCase.priority} · 人工已确认`
    : careCase.status === 'COMPLETED'
      ? '事情已解决'
      : isFamilyRequest ? `${careCase.priority} · 家属工单` : '正在处理'
  return (
    <article className={`case-card ${isRisk ? 'case-card--risk' : ''}`}>
      <span className="case-card__icon">
        {isRisk ? <AlertIcon /> : <ClipboardIcon />}
      </span>
      <div className="case-card__body">
        {staffContext && <div className="staff-case-context">
          <strong>{careCase.caseSource === 'WEARABLE_SENSOR' ? '设备预警' : careCase.caseSource === 'FAMILY_REQUEST' ? '家属需求' : '老人需求'}</strong>
          <span>{careCase.caseSource === 'FAMILY_REQUEST' ? `${family?.name ?? careCase.requesterId}${relation ? ` · ${RELATIONSHIP_LABELS[relation.relationship]}` : ''} · 为${elder?.name ?? careCase.subjectElderId}提出` : `${elder?.name ?? careCase.subjectElderId} · ${careCase.subjectElderId}${elder ? ` · ${elder.room}房` : ''}`}</span>
          <span>请求人：{careCase.caseSource === 'WEARABLE_SENSOR' ? '安序手表' : careCase.caseSource === 'FAMILY_REQUEST' ? family?.name ?? careCase.requesterId : elder?.name ?? careCase.requesterId}</span>
          <span>服务对象：{elder?.name ?? careCase.subjectElderId} · {careCase.subjectElderId}</span>
        </div>}
        <p className="eyebrow">{eyebrow}</p>
        <h3>{isRisk ? riskDefinition?.caseTitle : title}</h3>
        {isRisk && <p>{careCase.caseSource === 'WEARABLE_SENSOR' ? careCase.requestSummary : careCase.selfHandling === 'UNABLE' ? `${elder?.name ?? careCase.subjectElderId}当前无法自行起身` : `${elder?.name ?? careCase.subjectElderId}报告${riskDefinition?.label ?? '安全风险'}`}</p>}
        {careCase.hospital && (
          <p>{careCase.hospital} · {careCase.appointmentTime?.replace('明日 ', '')}</p>
        )}
        {!isRisk && !careCase.hospital && careCase.requestSummary && <p>{careCase.requestSummary}</p>}
        {staffContext && careCase.caseSource === 'ELDER_INPUT' && careCase.agentSummary && <p>需求整理：{careCase.agentSummary}</p>}
        {staffContext && <p className="staff-case-action"><strong>现在需要：</strong>{careCase.staffActionSummary ?? (isRisk ? '人工确认风险，再决定介入。' : careCase.caseType === 'EVALUATION' ? '判断是否承接需求。' : '核对需求并安排处理。')}</p>}
        {staffContext && careCase.caseType === 'EVALUATION' && <p>整理：{careCase.agentSummary ?? careCase.requestSummary} · 人工判断：{careCase.reasoningSummary ?? '需工作人员确认服务范围'}</p>}
        {staffContext && <p className="staff-case-meta">{careCase.title ?? '服务需求'} · {careCase.finalPriority ?? careCase.priority} · {careCase.status}</p>}
        {careCase.caseType === 'EVALUATION' && careCase.status === 'WAITING' && <p>等待工作人员评估是否承接</p>}
        {careCase.status === 'DECLINED' && careCase.evaluationReason && <p>暂不承接原因：{careCase.evaluationReason}</p>}
        <p className="case-card__status">{careCase.caseType === 'EVALUATION' && careCase.status === 'WAITING'
          ? '等待工作人员评估'
          : isRisk ? SAFETY_STATUS_LABELS[careCase.status] : isFamilyRequest ? FAMILY_STATUS_LABELS[careCase.status] : SERVICE_STATUS_LABELS[careCase.status]}</p>
        {careCase.assignedStaff && (
          <p className="case-card__assignment">
            {isRisk ? `${careCase.assignedStaff}已介入处理` : `${careCase.assignedStaff}已接单`}
            {!isRisk && careCase.arrivalTime && ` · 预计${careCase.arrivalTime}上门`}
          </p>
        )}
        <div className="case-card__actions">
          <Link to={detailHref}>{detailLabel} <ArrowIcon /></Link>
          {actionLabel && onAction && (
            <button type="button" onClick={onAction}>{actionLabel}</button>
          )}
        </div>
      </div>
    </article>
  )
}
