import { CaseCard } from '../components/cases/CaseCard'
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppShell } from '../components/layout/AppShell'
import { CheckIcon, SparkIcon } from '../components/ui/Icons'
import { AlertIcon, ArrowIcon } from '../components/ui/Icons'
import { Link, useParams } from 'react-router-dom'
import { DAILY_ACTIVITIES } from '../data/mockData'
import { RISK_CATALOG } from '../domain/riskCatalog'
import { selectActiveCases, selectCompletedCases, useDemoStore } from '../store/demoStore'
import { FamilyConversation } from '../components/conversation/FamilyConversation'

export function FamilyHomePage() {
  const { elderId = '' } = useParams()
  const allActiveCases = useDemoStore(useShallow(selectActiveCases))
  const allCompletedCases = useDemoStore(useShallow(selectCompletedCases))
  const elderProfiles = useDemoStore((state) => state.elderProfiles)
  const familyProfiles = useDemoStore((state) => state.familyProfiles)
  const relations = useDemoStore((state) => state.elderFamilyRelations)
  const institutions = useDemoStore((state) => state.institutions)
  const activeFamilyUserId = useDemoStore((state) => state.activeFamilyUserId)
  const selectFamilyElder = useDemoStore((state) => state.selectFamilyElder)
  const elder = elderProfiles[elderId]
  const family = familyProfiles[activeFamilyUserId]
  const relation = Object.values(relations).find((candidate) =>
    candidate.elderId === elderId && candidate.familyUserId === activeFamilyUserId && candidate.status === 'VERIFIED')
  const institution = elder ? institutions[elder.institutionId] : null
  const activeCases = allActiveCases.filter((careCase) => careCase.subjectElderId === elderId)
  const completedCases = allCompletedCases.filter((careCase) => careCase.subjectElderId === elderId)
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

  useEffect(() => {
    if (relation) selectFamilyElder(elderId)
  }, [elderId, relation, selectFamilyElder])

  if (!elder || !family || !relation || !institution) {
    return (
      <AppShell pageClassName="family-theme">
        <div className="page-content detail-empty"><h1>尚未获得该老人档案权限</h1><p>只有已确认的家属关系可以进入。</p><Link to="/family">返回我的家人</Link></div>
      </AppShell>
    )
  }

  return (
    <AppShell pageClassName="family-theme">
      <div className="family-home page-content">
        <header className="dashboard-heading">
          <div><p className="eyebrow">当前老人 · {elder.elderId}</p><h1>{elder.name}今天</h1><p>{institution.name} · {elder.room}房</p><Link className="back-link" to="/family">← 返回我的家人</Link></div>
          <div className={`status-summary ${activeSafetyCase ? 'status-summary--risk' : ''}`}><span className="status-dot" /><span>整体状态</span><strong>{activeSafetyCase ? '需要关注' : '平稳'}</strong></div>
        </header>

        {activeSafetyCase && (
          <section className="family-risk-banner" role="alert" aria-label={`妈妈的${activeRiskDefinition?.label ?? ''}风险提醒`}>
            <span className="family-risk-banner__icon"><AlertIcon /></span>
            <div>
              <p className="eyebrow">P0 · 需要关注</p>
              <h2>{elder.name}刚刚报告{activeSafetyCase.eventType === 'FALL' ? '发生跌倒' : activeRiskDefinition?.label}</h2>
              <p>{activeSafetyCase.selfHandling === 'UNABLE' ? `${elder.name}表示目前无法自行起身。` : `${activeRiskDefinition?.label}信息已记录。`}服务中心已收到信息。</p>
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
            <p className="eyebrow">家属服务申请</p>
            <h2>需要工作人员协助？</h2>
            <p>选择一项明确服务并填写必要信息，提交后可在本页查看处理进度与结果。</p>
            <FamilyConversation elder={elder} family={family} relation={relation} />
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
