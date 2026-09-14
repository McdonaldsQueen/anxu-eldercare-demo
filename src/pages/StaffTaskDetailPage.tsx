import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AlertIcon, CheckIcon, ClipboardIcon } from '../components/ui/Icons'
import type { CareCaseStatus } from '../domain/models'
import { RISK_CATALOG, RISK_FOLLOW_UP_LABELS } from '../domain/riskCatalog'
import { useDemoStore } from '../store/demoStore'

const taskAction: Partial<Record<CareCaseStatus, { label: string; target: CareCaseStatus }>> = {
  WAITING: { label: '接单', target: 'ACCEPTED' },
  ACCEPTED: { label: '开始服务', target: 'IN_PROGRESS' },
  IN_PROGRESS: { label: '完成服务', target: 'COMPLETED' },
}

const staffStatus: Record<CareCaseStatus, string> = {
  WAITING: '等待接单',
  ACCEPTED: '已接单',
  WAITING_FOR_REVIEW: '等待人工确认',
  CONFIRMED: '风险已确认',
  IN_PROGRESS: '服务进行中',
  COMPLETED: '服务已完成',
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))

export function StaffTaskDetailPage() {
  const { caseId } = useParams()
  const careCase = useDemoStore((state) =>
    caseId ? state.cases[caseId] : undefined,
  )
  const moveEscortCase = useDemoStore((state) => state.moveEscortCase)
  const moveSafetyCase = useDemoStore((state) => state.moveSafetyCase)
  const confirmAndInterveneSafetyCase = useDemoStore(
    (state) => state.confirmAndInterveneSafetyCase,
  )

  if (!careCase) {
    return (
      <AppShell pageClassName="staff-theme">
        <div className="page-content detail-empty"><h1>没有找到该任务</h1><Link to="/staff">返回工作台</Link></div>
      </AppShell>
    )
  }

  const isSafety = careCase.caseType === 'SAFETY'
  const riskDefinition = careCase.eventType ? RISK_CATALOG[careCase.eventType] : null
  const action = isSafety ? undefined : taskAction[careCase.status]

  const runSafetyAction = () => {
    if (careCase.status === 'WAITING_FOR_REVIEW') {
      confirmAndInterveneSafetyCase(careCase.caseId)
    } else if (careCase.status === 'CONFIRMED') {
      moveSafetyCase(careCase.caseId, 'IN_PROGRESS')
    } else if (careCase.status === 'IN_PROGRESS') {
      moveSafetyCase(careCase.caseId, 'COMPLETED')
    }
  }

  const safetyActionLabel = careCase.status === 'WAITING_FOR_REVIEW'
    ? '确认风险并介入'
    : careCase.status === 'CONFIRMED'
      ? '开始介入处理'
      : careCase.status === 'IN_PROGRESS'
        ? '完成处理'
        : null
  const displayedStatus = isSafety && careCase.status === 'COMPLETED'
    ? '事件处理已完成'
    : staffStatus[careCase.status]

  return (
    <AppShell pageClassName="staff-theme">
      <div className="page-content staff-task-detail">
        <Link className="back-link" to="/staff">← 返回服务工作台</Link>
        <div className="staff-task-grid">
          <section className={`panel task-main-card ${isSafety ? 'task-main-card--risk' : ''}`}>
            <header className="task-detail-heading">
              <span className={`detail-hero__icon ${isSafety ? 'detail-hero__icon--risk' : ''}`}>{isSafety ? <AlertIcon /> : <ClipboardIcon />}</span>
              <div>
                <p className="eyebrow">{careCase.caseId} · {isSafety ? 'P0 紧急' : 'P2 普通'}</p>
                <h1>王阿姨 · {isSafety ? riskDefinition?.label : '陪诊'}</h1>
                <p>{isSafety ? (careCase.selfHandling === 'UNABLE' ? '当前无法自行起身' : riskDefinition?.reportSummary) : `${careCase.appointmentTime} · ${careCase.hospital}`}</p>
              </div>
              <span className={`detail-status ${isSafety ? 'detail-status--risk' : ''}`}>{displayedStatus}</span>
            </header>
            <dl className="task-facts">
              <div><dt>服务对象</dt><dd>王阿姨</dd></div>
              <div><dt>{isSafety ? '事件' : '服务需求'}</dt><dd>{isSafety ? riskDefinition?.label : `陪同前往${careCase.hospital}完成就诊`}</dd></div>
              <div><dt>{isSafety ? '当前情况' : '预约时间'}</dt><dd>{isSafety ? (careCase.selfHandling === 'UNABLE' ? '老人表示无法自行起身' : '老人已提交风险情况') : careCase.appointmentTime}</dd></div>
              <div><dt>{isSafety ? '风险等级' : '预计上门'}</dt><dd>{isSafety ? 'P0 · 紧急' : careCase.arrivalTime ?? '接单后确认'}</dd></div>
            </dl>
            {isSafety && (
              <div className="ai-safety-summary">
                <p className="eyebrow">安序智护已完成</p>
                <p><CheckIcon /> 识别{riskDefinition?.label}风险</p>
                <p><CheckIcon /> 建立安全事件</p>
                <p><CheckIcon /> 通知服务中心</p>
                {careCase.reportedSymptoms.length > 0 && (
                  <p className="reported-symptoms">老人选择：{careCase.reportedSymptoms.map((symptom) => RISK_FOLLOW_UP_LABELS[symptom]).join('、')}</p>
                )}
                {careCase.additionalInformation.length > 1 && (
                  <p className="reported-symptoms">开放补充：{careCase.additionalInformation.slice(1).join('；')}</p>
                )}
              </div>
            )}
            {action && (
              <button className="primary-button task-primary-action" type="button" onClick={() => moveEscortCase(careCase.caseId, action.target)}>
                {action.label}
              </button>
            )}
            {isSafety && safetyActionLabel && (
              <button className="risk-primary-action" type="button" onClick={runSafetyAction}>
                {safetyActionLabel}
              </button>
            )}
            {careCase.status === 'COMPLETED' && (
              <div className="resolved-banner"><CheckIcon /><div><strong>{isSafety ? '事件处理已完成' : '服务已完成'}</strong><span>CASE RESOLVED</span></div></div>
            )}
          </section>

          <aside className="panel task-timeline-panel">
            <p className="eyebrow">任务动态</p>
            <div className="case-timeline">
              {careCase.timeline.map((event) => (
                <div className="timeline-event" key={event.id}><time>{formatTime(event.occurredAt)}</time><span><CheckIcon /></span><strong>{event.label}</strong></div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
