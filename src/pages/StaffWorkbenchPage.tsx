import { AppShell } from '../components/layout/AppShell'
import { useShallow } from 'zustand/react/shallow'
import { CaseCard } from '../components/cases/CaseCard'
import { AlertIcon, ClipboardIcon } from '../components/ui/Icons'
import { selectActiveCases, selectCompletedCases, selectWorkload, useDemoStore } from '../store/demoStore'

export function StaffWorkbenchPage() {
  const workload = useDemoStore(useShallow(selectWorkload))
  const activeCases = useDemoStore(useShallow(selectActiveCases))
  const completedCases = useDemoStore(useShallow(selectCompletedCases))
  const moveServiceCase = useDemoStore((state) => state.moveServiceCase)
  const riskCases = activeCases.filter((careCase) => careCase.caseType === 'SAFETY')
  const unreviewedRiskCases = riskCases.filter((careCase) => careCase.status === 'WAITING_FOR_REVIEW')
  const confirmedRiskCases = riskCases.filter((careCase) => careCase.status !== 'WAITING_FOR_REVIEW')
  const serviceCases = activeCases.filter((careCase) => ['SERVICE', 'MOBILITY'].includes(careCase.caseType))
  const familyCases = activeCases.filter((careCase) => careCase.caseType === 'FAMILY_REQUEST')
  const evaluationCases = activeCases.filter((careCase) => careCase.caseType === 'EVALUATION')

  const stats = [
    { label: '今日待处理', value: workload.pending, tone: 'neutral' },
    { label: '进行中', value: workload.inProgress, tone: 'active' },
    { label: '高风险', value: workload.highRisk, tone: 'risk' },
  ]

  return (
    <AppShell pageClassName="staff-theme">
      <div className="staff-home page-content">
        <header className="dashboard-heading dashboard-heading--staff">
          <div><p className="eyebrow">李师傅，上午好</p><h1>服务工作台</h1><p>需要您处理的服务与风险事件会集中出现在这里。</p></div>
          <div className="staff-avatar">李</div>
        </header>

        {unreviewedRiskCases.length > 0 && (
          <section className="p0-task-section" aria-label="未审核 Safety Case">
            <div className="p0-task-section__heading"><AlertIcon /><div><p className="eyebrow">第一优先级 · 未审核 Safety Case</p><h2>P0 紧急事件</h2></div></div>
            <div className="case-list">
              {unreviewedRiskCases.map((careCase) => (
                <CaseCard
                  key={careCase.caseId}
                  careCase={careCase}
                  detailHref={`/staff/tasks/${careCase.caseId}`}
                  detailLabel="立即处理 / 审核"
                />
              ))}
            </div>
          </section>
        )}

        {confirmedRiskCases.length > 0 && (
          <section className="p0-task-section" aria-label="已确认 Safety Case">
            <div className="p0-task-section__heading"><AlertIcon /><div><p className="eyebrow">人工已确认</p><h2>高优先级 Safety Case</h2></div></div>
            <div className="case-list">{confirmedRiskCases.map((careCase) => (
              <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/staff/tasks/${careCase.caseId}`} detailLabel="继续处理" />
            ))}</div>
          </section>
        )}

        <section className="workload-grid" aria-label="工作台统计">
          {stats.map((stat) => (
            <article className={`workload-card workload-card--${stat.tone}`} key={stat.label}>
              <span>{stat.label}</span><strong>{stat.value}</strong><small>件</small>
            </article>
          ))}
        </section>

        <section className="panel task-panel">
          <div className="section-title-row"><div><p className="eyebrow">普通服务</p><h2>待处理任务</h2></div>{serviceCases.length > 0 && <span className="count-chip">{serviceCases.length} 件</span>}</div>
          {serviceCases.length ? (
            <div className="case-list">
              {serviceCases.map((careCase) => (
                <CaseCard
                  key={careCase.caseId}
                  careCase={careCase}
                  detailHref={`/staff/tasks/${careCase.caseId}`}
                  actionLabel={careCase.status === 'WAITING' ? '接单' : undefined}
                  onAction={careCase.status === 'WAITING' ? () => moveServiceCase(careCase.caseId, 'ACCEPTED') : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="staff-empty-state"><span><ClipboardIcon /></span><h3>当前没有待处理任务</h3><p>新任务到达后，会按照风险等级优先显示。</p></div>
          )}
        </section>
        {familyCases.length > 0 && (
          <section className="panel task-panel task-panel--secondary">
            <div className="section-title-row"><div><p className="eyebrow">家属需求</p><h2>Family Request</h2></div><span className="count-chip">{familyCases.length} 件</span></div>
            <div className="case-list">{familyCases.map((careCase) => (
              <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/staff/tasks/${careCase.caseId}`}
                actionLabel={careCase.status === 'WAITING' ? '接单' : undefined}
                onAction={careCase.status === 'WAITING' ? () => moveServiceCase(careCase.caseId, 'ACCEPTED') : undefined} />
            ))}</div>
          </section>
        )}
        {evaluationCases.length > 0 && (
          <section className="panel task-panel task-panel--secondary">
            <div className="section-title-row"><div><p className="eyebrow">人工决策</p><h2>待评估需求</h2></div><span className="count-chip">{evaluationCases.length} 件</span></div>
            <div className="case-list">{evaluationCases.map((careCase) => (
              <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/staff/tasks/${careCase.caseId}`} detailLabel="评估需求" />
            ))}</div>
          </section>
        )}
        {completedCases.length > 0 && (
          <section className="panel completed-task-panel">
            <div className="section-title-row"><div><p className="eyebrow">今日记录</p><h2>已完成</h2></div></div>
            <div className="case-list">{completedCases.map((careCase) => <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/staff/tasks/${careCase.caseId}`} />)}</div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
