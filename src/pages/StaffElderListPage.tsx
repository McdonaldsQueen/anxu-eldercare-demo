import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AppShell } from '../components/layout/AppShell'
import { ELDER_STATUS_LABELS } from '../domain/identity'
import { useDemoStore } from '../store/demoStore'

export function StaffElderListPage() {
  const elders = useDemoStore(useShallow((state) => Object.values(state.elderProfiles)))
  const relations = useDemoStore(useShallow((state) => Object.values(state.elderFamilyRelations)))

  return (
    <AppShell pageClassName="staff-theme">
      <div className="page-content staff-elder-list">
        <Link className="back-link" to="/staff">← 返回服务工作台</Link>
        <header className="dashboard-heading dashboard-heading--staff">
          <div><p className="eyebrow">机构档案</p><h1>老人档案</h1><p>由工作人员建立和管理老人、家属及授权关系。</p></div>
        </header>
        <section className="elder-profile-grid" aria-label="老人档案列表">
          {elders.map((elder) => {
            const verifiedCount = relations.filter((relation) => relation.elderId === elder.elderId && relation.status === 'VERIFIED').length
            return (
              <article className="panel elder-admin-card" key={elder.elderId}>
                <div><p className="eyebrow">{elder.elderId}</p><h2>{elder.name}</h2></div>
                <dl>
                  <div><dt>年龄</dt><dd>{elder.age}岁</dd></div>
                  <div><dt>房间</dt><dd>{elder.room}房</dd></div>
                  <div><dt>状态</dt><dd>{ELDER_STATUS_LABELS[elder.status]}</dd></div>
                  <div><dt>已绑定家属</dt><dd>{verifiedCount}</dd></div>
                </dl>
                <div className="elder-admin-actions">
                  <Link to={`/staff/elders/${elder.elderId}`}>查看档案</Link>
                  <Link to={`/staff/elders/${elder.elderId}?manage=1`}>管理家属</Link>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </AppShell>
  )
}
