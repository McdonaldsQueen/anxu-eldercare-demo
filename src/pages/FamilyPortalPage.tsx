import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AppShell } from '../components/layout/AppShell'
import { CONTACT_ROLE_LABELS, ELDER_RELATIONSHIP_LABELS } from '../domain/identity'
import { useDemoStore } from '../store/demoStore'

export function FamilyPortalPage() {
  const navigate = useNavigate()
  const familyUserId = useDemoStore((state) => state.activeFamilyUserId)
  const family = useDemoStore((state) => state.familyProfiles[state.activeFamilyUserId])
  const elders = useDemoStore((state) => state.elderProfiles)
  const institutions = useDemoStore((state) => state.institutions)
  const relations = useDemoStore(useShallow((state) => Object.values(state.elderFamilyRelations)
    .filter((relation) => relation.familyUserId === state.activeFamilyUserId)))
  const confirmFamilyRelation = useDemoStore((state) => state.confirmFamilyRelation)
  const selectFamilyElder = useDemoStore((state) => state.selectFamilyElder)
  const pendingRelations = relations.filter((relation) => relation.status === 'PENDING')
  const verifiedRelations = relations.filter((relation) => relation.status === 'VERIFIED')

  const enterElder = (elderId: string) => {
    if (selectFamilyElder(elderId)) navigate(`/family/elders/${elderId}`)
  }

  return (
    <AppShell pageClassName="family-theme">
      <div className="page-content family-portal">
        <header className="dashboard-heading">
          <div><p className="eyebrow">家属身份 · {familyUserId}</p><h1>{family?.name ?? '家属'}，您好</h1><p>老人档案仅通过养老机构工作人员建立并经您确认后开放。</p></div>
        </header>

        {pendingRelations.length > 0 && (
          <section className="panel binding-invites" aria-label="待确认绑定">
            <div className="section-title-row"><div><p className="eyebrow">机构邀请</p><h2>待确认绑定</h2></div><span className="count-chip">{pendingRelations.length} 个</span></div>
            {pendingRelations.map((relation) => {
              const elder = elders[relation.elderId]
              const institution = elder ? institutions[elder.institutionId] : null
              if (!elder || !institution) return null
              return (
                <article className="binding-invite-card" key={relation.relationId}>
                  <p>{institution.name}邀请您绑定老人档案</p>
                  <h3>{elder.name}</h3>
                  <span>{elder.age}岁 · {elder.room}房</span>
                  <dl>
                    <div><dt>与您的关系</dt><dd>{ELDER_RELATIONSHIP_LABELS[relation.relationship]}</dd></div>
                    <div><dt>您的联系人角色</dt><dd>{CONTACT_ROLE_LABELS[relation.contactRole]}</dd></div>
                  </dl>
                  <button className="primary-button" type="button" onClick={() => confirmFamilyRelation(relation.relationId)}>确认绑定</button>
                </article>
              )
            })}
          </section>
        )}

        <section className="panel family-members-section" aria-label="我的家人">
          <div className="section-title-row"><div><p className="eyebrow">已验证关系</p><h2>我的家人</h2></div>{verifiedRelations.length > 0 && <span className="count-chip">{verifiedRelations.length} 位</span>}</div>
          {verifiedRelations.length > 0 ? (
            <div className="elder-profile-grid">
              {verifiedRelations.map((relation) => {
                const elder = elders[relation.elderId]
                const institution = elder ? institutions[elder.institutionId] : null
                if (!elder || !institution) return null
                return (
                  <article className="elder-profile-card" key={relation.relationId}>
                    <div><p className="eyebrow">{ELDER_RELATIONSHIP_LABELS[relation.relationship]}</p><h3>{elder.name}</h3></div>
                    <p>{institution.name}</p>
                    <span>{elder.room}房</span>
                    <button type="button" onClick={() => enterElder(elder.elderId)}>进入</button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="staff-empty-state"><h3>暂时没有已绑定的家人</h3><p>请等待养老机构工作人员发送邀请，并先完成确认。</p></div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
