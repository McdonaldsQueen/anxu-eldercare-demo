import { CaseCard } from '../components/cases/CaseCard'
import { useShallow } from 'zustand/react/shallow'
import { AppShell } from '../components/layout/AppShell'
import { CheckIcon, SparkIcon } from '../components/ui/Icons'
import { AlertIcon, ArrowIcon } from '../components/ui/Icons'
import { Link } from 'react-router-dom'
import { DAILY_ACTIVITIES } from '../data/mockData'
import { RISK_CATALOG } from '../domain/riskCatalog'
import { selectActiveCases, selectCompletedCases, useDemoStore } from '../store/demoStore'
import { FamilyConversation } from '../components/conversation/FamilyConversation'

export function FamilyHomePage() {
  const activeCases = useDemoStore(useShallow(selectActiveCases))
  const completedCases = useDemoStore(useShallow(selectCompletedCases))
  const safetyCases = activeCases.filter((careCase) => careCase.caseType === 'SAFETY')
  const serviceCases = activeCases.filter((careCase) => careCase.caseType !== 'SAFETY')
  const activeSafetyCase = safetyCases[0]
  const activeRiskType = activeSafetyCase?.finalRiskType ?? activeSafetyCase?.eventType
  const activeRiskDefinition = activeRiskType
    ? RISK_CATALOG[activeRiskType]
    : null

  const riskMessage = activeSafetyCase?.status === 'IN_PROGRESS'
    ? '工作人员已介入处理'
    : activeSafetyCase?.status === 'CONFIRMED'
      ? '工作人员已确认风险，正在介入'
      : '等待工作人员确认'

  return (
    <AppShell pageClassName="family-theme">
      <div className="family-home page-content">
        <header className="dashboard-heading">
          <div><p className="eyebrow">家属关怀中心</p><h1>妈妈今天</h1></div>
          <div className={`status-summary ${activeSafetyCase ? 'status-summary--risk' : ''}`}><span className="status-dot" /><span>整体状态</span><strong>{activeSafetyCase ? '需要关注' : '平稳'}</strong></div>
        </header>

        {activeSafetyCase && (
          <section className="family-risk-banner" role="alert" aria-label={`妈妈的${activeRiskDefinition?.label ?? ''}风险提醒`}>
            <span className="family-risk-banner__icon"><AlertIcon /></span>
            <div>
              <p className="eyebrow">P0 · 需要关注</p>
              <h2>妈妈刚刚报告{activeSafetyCase.eventType === 'FALL' ? '发生跌倒' : activeRiskDefinition?.label}</h2>
              <p>{activeSafetyCase.selfHandling === 'UNABLE' ? '妈妈表示目前无法自行起身。' : `${activeRiskDefinition?.label}信息已记录。`}服务中心已收到信息。</p>
              <strong>{riskMessage}</strong>
            </div>
            <Link to={`/family/cases/${activeSafetyCase.caseId}`}>查看详情 <ArrowIcon /></Link>
          </section>
        )}

        <div className="family-grid">
          <section className="panel family-cases-panel">
            <div className="section-title-row"><div><p className="eyebrow">服务进展</p><h2>正在处理</h2></div>{serviceCases.length > 0 && <span className="count-chip">{serviceCases.length} 件</span>}</div>
            {serviceCases.length ? (
              <div className="case-list">{serviceCases.map((careCase) => <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/family/cases/${careCase.caseId}`} />)}</div>
            ) : (
              <div className="empty-state"><span><CheckIcon /></span><div><strong>暂时没有待处理事项</strong><p>新的服务进展会第一时间出现在这里。</p></div></div>
            )}
          </section>

          <aside className="panel family-assistant-panel">
            <span className="assistant-icon"><SparkIcon /></span>
            <p className="eyebrow">安序智护</p>
            <h2>有什么想了解的？</h2>
            <p>可以提交联系确认或物品转交需求，处理结果会同步在本页。</p>
            <FamilyConversation />
          </aside>
        </div>

        <section className="panel family-today-panel">
          <div className="section-title-row"><div><p className="eyebrow">今日记录</p><h2>安心动态</h2></div></div>
          <div className="family-timeline">
            {DAILY_ACTIVITIES.map((activity) => (
              <div className="family-timeline__item" key={activity.id}><time>{activity.time}</time><span><CheckIcon /></span><strong>{activity.label}</strong></div>
            ))}
          </div>
          {completedCases.map((careCase) => (
            <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/family/cases/${careCase.caseId}`} />
          ))}
        </section>
      </div>
    </AppShell>
  )
}
