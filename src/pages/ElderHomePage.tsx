import { AppShell } from '../components/layout/AppShell'
import { useShallow } from 'zustand/react/shallow'
import { CaseCard } from '../components/cases/CaseCard'
import { ElderConversation } from '../components/conversation/ElderConversation'
import { ElderWearable } from '../components/sensor/ElderWearable'
import { CheckIcon } from '../components/ui/Icons'
import { DAILY_ACTIVITIES } from '../data/mockData'
import { selectActiveCases, selectCompletedCases, useDemoStore } from '../store/demoStore'

export function ElderHomePage() {
  const activeCases = useDemoStore(useShallow(selectActiveCases))
  const completedCases = useDemoStore(useShallow(selectCompletedCases))
  return (
    <AppShell pageClassName="elder-theme">
      <div className="elder-home page-content page-content--narrow">
        <section className="welcome-block">
          <p className="time-greeting">上午好，王阿姨</p>
          <h1>今天有什么需要<br />我帮忙的吗？</h1>
          <p>您慢慢说，我会认真听。</p>
        </section>

        <section className="request-box" aria-label="需求输入入口">
          <ElderConversation />
        </section>
        <ElderWearable elderId="E001" />

        <section className="content-section">
          <div className="section-title-row">
            <div><p className="eyebrow">持续为您留意</p><h2>正在为您处理</h2></div>
            {activeCases.length > 0 && <span className="count-chip">{activeCases.length} 件</span>}
          </div>
          {activeCases.length ? (
            <div className="case-list">{activeCases.map((careCase) => <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/elder/cases/${careCase.caseId}`} />)}</div>
          ) : (
            <div className="empty-state empty-state--warm">
              <span><CheckIcon /></span>
              <div><strong>现在没有待处理的事情</strong><p>有需要时，随时告诉我。</p></div>
            </div>
          )}
        </section>

        <section className="content-section today-section">
          <div className="section-title-row"><div><p className="eyebrow">安心日常</p><h2>今天</h2></div></div>
          <div className="activity-list">
            {DAILY_ACTIVITIES.map((activity) => (
              <div className="activity-row" key={activity.id}>
                <span className="activity-row__check"><CheckIcon /></span>
                <strong>{activity.label}</strong>
                <time>{activity.time}</time>
              </div>
            ))}
          </div>
          {completedCases.length > 0 && (
            <div className="completed-case-list">
              {completedCases.map((careCase) => (
                <CaseCard key={careCase.caseId} careCase={careCase} detailHref={`/elder/cases/${careCase.caseId}`} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
