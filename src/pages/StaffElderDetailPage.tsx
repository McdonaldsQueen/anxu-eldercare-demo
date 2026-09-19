import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { AppShell } from '../components/layout/AppShell'
import { ClipboardIcon } from '../components/ui/Icons'
import {
  CONTACT_ROLE_LABELS,
  ELDER_STATUS_LABELS,
  RELATIONSHIP_LABELS,
  RELATION_STATUS_LABELS,
} from '../domain/identity'
import type { FamilyContactRole, FamilyRelationship } from '../domain/models'
import { useDemoStore } from '../store/demoStore'

export function StaffElderDetailPage() {
  const { elderId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const elder = useDemoStore((state) => state.elderProfiles[elderId])
  const institution = useDemoStore((state) => elder ? state.institutions[elder.institutionId] : undefined)
  const familyProfiles = useDemoStore((state) => state.familyProfiles)
  const relations = useDemoStore(useShallow((state) => Object.values(state.elderFamilyRelations).filter((relation) => relation.elderId === elderId)))
  const inviteFamilyRelation = useDemoStore((state) => state.inviteFamilyRelation)
  const [isAdding, setIsAdding] = useState(searchParams.get('manage') === '1')
  const [familyName, setFamilyName] = useState('李晓雯')
  const [phone, setPhone] = useState('13800000001')
  const [relationship, setRelationship] = useState<FamilyRelationship>('DAUGHTER')
  const [contactRole, setContactRole] = useState<FamilyContactRole>('PRIMARY_CONTACT')
  const [feedback, setFeedback] = useState('')

  if (!elder || !institution) {
    return <AppShell pageClassName="staff-theme"><div className="page-content detail-empty"><h1>没有找到老人档案</h1><Link to="/staff/elders">返回老人档案</Link></div></AppShell>
  }

  const submitInvitation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const relationId = inviteFamilyRelation({ elderId, familyName, phone, relationship, contactRole })
    if (!relationId) {
      setFeedback('该家属已与当前老人建立有效绑定。')
      return
    }
    setFeedback(`${relationId} 绑定邀请已发送，等待家属确认。`)
    setIsAdding(false)
  }

  return (
    <AppShell pageClassName="staff-theme">
      <div className="page-content staff-elder-detail">
        <Link className="back-link" to="/staff/elders">← 返回老人档案</Link>
        <header className="detail-hero">
          <span className="detail-hero__icon"><ClipboardIcon /></span>
          <div><p className="eyebrow">老人档案 · {elder.elderId}</p><h1>{elder.name}</h1><p>{institution.name}</p></div>
          <span className="detail-status">{ELDER_STATUS_LABELS[elder.status]}</span>
        </header>

        <section className="panel elder-basic-panel">
          <div className="section-title-row"><div><p className="eyebrow">基本信息</p><h2>老人信息</h2></div></div>
          <dl className="task-facts">
            <div><dt>姓名</dt><dd>{elder.name}</dd></div>
            <div><dt>年龄</dt><dd>{elder.age}岁</dd></div>
            <div><dt>房间</dt><dd>{elder.room}</dd></div>
            <div><dt>状态</dt><dd>{ELDER_STATUS_LABELS[elder.status]}</dd></div>
          </dl>
        </section>

        <section className="panel elder-relations-panel" aria-label="家属关系">
          <div className="section-title-row"><div><p className="eyebrow">授权与联系人</p><h2>家属关系</h2></div><button type="button" className="primary-button" onClick={() => { setIsAdding(true); setFeedback('') }}>添加家属</button></div>
          <div className="relation-list">
            {relations.map((relation) => {
              const family = familyProfiles[relation.familyUserId]
              if (!family) return null
              return (
                <article className="relation-card" key={relation.relationId}>
                  <div><strong>{family.name}</strong><span>{family.familyUserId} · {family.phone}</span></div>
                  <span>{RELATIONSHIP_LABELS[relation.relationship]}</span>
                  <span>{CONTACT_ROLE_LABELS[relation.contactRole]}</span>
                  <span className={`relation-status relation-status--${relation.status.toLowerCase()}`}>{RELATION_STATUS_LABELS[relation.status]}</span>
                </article>
              )
            })}
          </div>

          {isAdding && (
            <form className="family-request-form binding-form" aria-label="添加家属" onSubmit={submitInvitation}>
              <div className="family-form-heading"><strong>发送绑定邀请</strong><span>关系由机构工作人员创建，家属确认后才获得老人入口。</span></div>
              <label>当前老人 <input value={`${elder.name}（${elder.elderId}）`} readOnly /></label>
              <label>家属姓名 <input required value={familyName} onChange={(event) => setFamilyName(event.target.value)} /></label>
              <label>手机号 <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <label>与老人关系
                <select aria-label="与老人关系" value={relationship} onChange={(event) => setRelationship(event.target.value as FamilyRelationship)}>
                  {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>联系人角色
                <select aria-label="联系人角色" value={contactRole} onChange={(event) => setContactRole(event.target.value as FamilyContactRole)}>
                  {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="family-form-actions"><button type="button" onClick={() => setIsAdding(false)}>取消</button><button type="submit">发送绑定邀请</button></div>
            </form>
          )}
          {feedback && <p className="family-request-success" role="status">{feedback}</p>}
        </section>
      </div>
    </AppShell>
  )
}
