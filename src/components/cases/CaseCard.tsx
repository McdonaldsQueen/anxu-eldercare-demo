import type { CareCase } from '../../domain/models'
import { Link } from 'react-router-dom'
import { RISK_CATALOG } from '../../domain/riskCatalog'
import { AlertIcon, ArrowIcon, ClipboardIcon } from '../ui/Icons'

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

interface CaseCardProps {
  careCase: CareCase
  detailHref: string
  actionLabel?: string
  onAction?: () => void
  detailLabel?: string
}

export function CaseCard({
  careCase,
  detailHref,
  actionLabel,
  onAction,
  detailLabel = '查看详情',
}: CaseCardProps) {
  const isRisk = careCase.caseType === 'SAFETY'
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
        ? `${careCase.suggestedRiskLevel ?? 'P0'} · AI 建议，待人工审核`
        : `${careCase.finalPriority ?? careCase.priority} · 人工已确认`
    : careCase.status === 'COMPLETED'
      ? '事情已解决'
      : '正在处理'
  return (
    <article className={`case-card ${isRisk ? 'case-card--risk' : ''}`}>
      <span className="case-card__icon">
        {isRisk ? <AlertIcon /> : <ClipboardIcon />}
      </span>
      <div className="case-card__body">
        <p className="eyebrow">{eyebrow}</p>
        <h3>{isRisk ? riskDefinition?.caseTitle : title}</h3>
        {isRisk && <p>{careCase.selfHandling === 'UNABLE' ? '王阿姨当前无法自行起身' : riskDefinition?.reportSummary}</p>}
        {careCase.hospital && (
          <p>{careCase.hospital} · {careCase.appointmentTime?.replace('明日 ', '')}</p>
        )}
        {!isRisk && !careCase.hospital && careCase.requestSummary && <p>{careCase.requestSummary}</p>}
        {careCase.caseType === 'EVALUATION' && <p>等待工作人员评估是否承接</p>}
        <p className="case-card__status">{careCase.caseType === 'EVALUATION' && careCase.status === 'WAITING'
          ? '等待工作人员评估'
          : isRisk ? SAFETY_STATUS_LABELS[careCase.status] : SERVICE_STATUS_LABELS[careCase.status]}</p>
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
