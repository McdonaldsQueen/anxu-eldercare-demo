import { AppShell } from '../components/layout/AppShell'
import { useShallow } from 'zustand/react/shallow'
import { CaseCard } from '../components/cases/CaseCard'
import { AlertIcon, ClipboardIcon } from '../components/ui/Icons'
import { selectActiveCases, selectCompletedCases, selectWorkload, useDemoStore } from '../store/demoStore'

export function StaffWorkbenchPage() {
  const workload = useDemoStore(useShallow(selectWorkload))
  const activeCases = useDemoStore(useShallow(selectActiveCases))
  const completedCases = useDemoStore(useShallow(selectCompletedCases))
  const moveEscortCase = useDemoStore((state) => state.moveEscortCase)
  const riskCases = activeCases.filter((careCase) => careCase.caseType === 'SAFETY')
  const serviceCases = activeCases.filter((careCase) => careCase.caseType !== 'SAFETY')

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

        {riskCases.length > 0 && (
          <section className="p0-task-section" aria-label="P0 紧急事件">
            <div className="p0-task-section__heading"><AlertIcon /><div><p className="eyebrow">优先处理</p><h2>P0 紧急事件</h2></div></div>
            <div className="case-list">
              {riskCases.map((careCase) => (
                <CaseCard
                  key={careCase.caseId}
                  careCase={careCase}
                  detailHref={`/staff/tasks/${careCase.caseId}`}
                  detailLabel={careCase.status === 'WAITING_FOR_REVIEW' ? '立即处理' : '继续处理'}
                />
              ))}
            </div>
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
                  onAction={careCase.status === 'WAITING' ? () => moveEscortCase(careCase.caseId, 'ACCEPTED') : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="staff-empty-state"><span><ClipboardIcon /></span><h3>当前没有待处理任务</h3><p>新任务到达后，会按照风险等级优先显示。</p></div>
          )}
        </section>
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
