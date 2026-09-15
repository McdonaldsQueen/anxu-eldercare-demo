import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AlertIcon, CheckIcon, ClipboardIcon } from '../components/ui/Icons'
import type { CareCaseStatus, Role } from '../domain/models'
import { RISK_CATALOG, RISK_FOLLOW_UP_LABELS } from '../domain/riskCatalog'
import { useDemoStore } from '../store/demoStore'

const SERVICE_STATUS_LABELS: Record<CareCaseStatus, string> = {
  WAITING: '正在安排工作人员',
  ACCEPTED: '工作人员已接单',
  DECLINED: '评估后暂不承接',
  WAITING_FOR_REVIEW: '等待工作人员确认',
  CONFIRMED: '风险已人工确认',
  IN_PROGRESS: '陪诊服务进行中',
  COMPLETED: '服务已完成',
}

const SAFETY_STATUS_LABELS: Record<CareCaseStatus, string> = {
  WAITING: '等待工作人员确认',
  ACCEPTED: '工作人员已确认',
  DECLINED: '已标记为非安全事件',
  WAITING_FOR_REVIEW: '等待工作人员确认',
  CONFIRMED: '工作人员已确认风险',
  IN_PROGRESS: '工作人员已介入处理',
  COMPLETED: '事件处理已完成',
}

const progressSteps: Array<{ status: CareCaseStatus; label: string }> = [
  { status: 'WAITING', label: '等待工作人员接单' },
  { status: 'ACCEPTED', label: '工作人员已接单' },
  { status: 'IN_PROGRESS', label: '陪诊服务进行' },
  { status: 'COMPLETED', label: '服务完成' },
]

const safetyProgressSteps: Array<{ status: CareCaseStatus; label: string }> = [
  { status: 'WAITING_FOR_REVIEW', label: '等待工作人员确认' },
  { status: 'CONFIRMED', label: '人工确认风险' },
  { status: 'IN_PROGRESS', label: '工作人员介入处理' },
  { status: 'COMPLETED', label: '事件处理完成' },
]

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))

export function CaseDetailPage({ role }: { role: Extract<Role, 'ELDER' | 'FAMILY'> }) {
  const { caseId } = useParams()
  const careCase = useDemoStore((state) =>
    caseId ? state.cases[caseId] : undefined,
  )
  const backHref = role === 'ELDER' ? '/elder' : '/family'

  if (!careCase) {
    return (
      <AppShell>
        <div className="page-content page-content--narrow detail-empty">
          <h1>没有找到这件事</h1>
          <Link to={backHref}>返回首页</Link>
        </div>
      </AppShell>
    )
  }

  const isSafety = careCase.caseType === 'SAFETY'
  const displayedRiskType = careCase.finalRiskType ?? careCase.eventType
  const riskDefinition = displayedRiskType ? RISK_CATALOG[displayedRiskType] : null
  const [appointmentDate = '', appointmentClock = ''] = careCase.appointmentTime?.split(' ') ?? []
  const escortPeriod = Number(appointmentClock.split(':')[0]) >= 12 ? '下午' : '上午'
  const audience = role === 'ELDER'
    ? isSafety ? '您的安全事件进度' : '您的服务进度'
    : isSafety ? '妈妈的安全事件进度' : '妈妈的服务进度'
  const displayedSteps = isSafety ? safetyProgressSteps : progressSteps
  const statusLabel = isSafety
    ? SAFETY_STATUS_LABELS[careCase.status]
    : SERVICE_STATUS_LABELS[careCase.status]

  const currentIndex = displayedSteps.findIndex(
    (step) => step.status === careCase.status,
  )

  return (
    <AppShell pageClassName={role === 'ELDER' ? 'elder-theme' : 'family-theme'}>
      <div className="page-content page-content--narrow case-detail-page">
        <Link className="back-link" to={backHref}>← 返回{role === 'ELDER' ? '首页' : '妈妈今天'}</Link>
        <header className="detail-hero">
          <span className={`detail-hero__icon ${isSafety ? 'detail-hero__icon--risk' : ''}`}>{isSafety ? <AlertIcon /> : <ClipboardIcon />}</span>
          <div>
            <p className="eyebrow">{audience}</p>
            <h1>{isSafety ? riskDefinition?.caseTitle : careCase.serviceType === 'MEDICAL_ESCORT' ? `${appointmentDate}${escortPeriod}陪诊` : careCase.title ?? '服务需求'}</h1>
            <p>{isSafety ? `王阿姨 · ${careCase.selfHandling === 'UNABLE' ? '当前无法自行起身' : riskDefinition?.reportSummary}` : `王阿姨 · ${careCase.requestSummary ?? [careCase.hospital, careCase.appointmentTime].filter(Boolean).join(' · ')}`}</p>
          </div>
          <span className={`detail-status detail-status--${careCase.status.toLowerCase()} ${isSafety ? 'detail-status--risk' : ''}`}>
            {statusLabel}
          </span>
        </header>

        {careCase.assignedStaff && (
          <section className={`assignment-banner ${isSafety ? 'assignment-banner--risk' : ''}`}>
            <span className="staff-avatar staff-avatar--small">李</span>
            <div>
              <strong>{isSafety ? `${careCase.assignedStaff}已介入处理` : `${careCase.assignedStaff}已接单`}</strong>
              <p>{isSafety ? '服务中心正在推进事件处理' : `预计${careCase.arrivalTime}上门`}</p>
            </div>
          </section>
        )}

        {isSafety && careCase.reportedSymptoms.length > 0 && (
          <section className="safety-supplement">
            <strong>已补充当前情况</strong>
            <p>{careCase.reportedSymptoms.map((symptom) => RISK_FOLLOW_UP_LABELS[symptom]).join('、')}</p>
            <small>这些信息用于协助工作人员了解情况，不作医疗判断。</small>
          </section>
        )}

        {isSafety && careCase.additionalInformation.length > 1 && (
          <section className="safety-supplement">
            <strong>老人后续描述</strong>
            <p>{careCase.additionalInformation.slice(1).join('；')}</p>
            <small>补充内容会进入同一个安全事件，不会自动改变 P0 等级。</small>
          </section>
        )}
        {careCase.itemType && (
          <section className="safety-supplement">
            <strong>物品转交信息</strong>
            <p>{careCase.itemType === 'MEDICINE' ? '药品' : '普通物品'}：{careCase.itemName ?? '未填写'}</p>
            {careCase.providedDosageInstructions && <p>家属提供的用法信息：{careCase.providedDosageInstructions}</p>}
            {careCase.specialInstruction && <p>特殊要求：{careCase.specialInstruction}</p>}
            <small>仅记录家属原话，不构成剂量、用法或医疗建议。</small>
          </section>
        )}
        {careCase.status === 'DECLINED' && (
          <section className="safety-supplement"><strong>评估结果：暂不承接</strong><p>{careCase.evaluationReason}</p></section>
        )}

        <section className="panel detail-panel">
          <p className="eyebrow">处理进度</p>
          <div className="progress-steps">
            {displayedSteps.map((step, index) => {
              const isDone = careCase.status === 'COMPLETED' || index < currentIndex
              const isCurrent = index === currentIndex && careCase.status !== 'COMPLETED'
              return (
                <div className={`progress-step ${isDone ? 'progress-step--done' : ''} ${isCurrent ? 'progress-step--current' : ''}`} key={step.status}>
                  <span>{isDone ? <CheckIcon /> : index + 1}</span>
                  <strong>{step.label}</strong>
                </div>
              )
            })}
          </div>
          {careCase.status === 'COMPLETED' && (
            <div className="resolved-banner"><CheckIcon /><div><strong>{isSafety ? '事件处理已完成' : '服务已完成'}</strong><span>CASE RESOLVED</span></div></div>
          )}
        </section>

        <section className="panel detail-panel">
          <p className="eyebrow">处理时间线</p>
          <div className="case-timeline">
            {careCase.timeline.map((event) => (
              <div className="timeline-event" key={event.id}>
                <time>{formatTime(event.occurredAt)}</time>
                <span><CheckIcon /></span>
                <strong>{event.label}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
