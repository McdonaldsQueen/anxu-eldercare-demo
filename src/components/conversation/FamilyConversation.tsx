import { useState, type FormEvent } from 'react'
import type { ElderFamilyRelation, ElderProfile, FamilyProfile, FamilyNaturalRequestInput } from '../../domain/models'
import { RELATIONSHIP_LABELS } from '../../domain/identity'
import { useDemoStore } from '../../store/demoStore'

type RequestMode = FamilyNaturalRequestInput['kind'] | null

interface FamilyConversationProps {
  elder: ElderProfile
  family: FamilyProfile
  relation: ElderFamilyRelation
}

export function FamilyConversation({ elder, family, relation }: FamilyConversationProps) {
  const createRequest = useDemoStore((state) => state.createFamilyNaturalRequest)
  const [mode, setMode] = useState<RequestMode>(null)
  const [description, setDescription] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const chooseMode = (next: Exclude<RequestMode, null>) => {
    setMode(next)
    setDescription('')
    setSuccessMessage('')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return
    const caseId = createRequest({
      elderId: elder.elderId, requesterId: family.familyUserId,
      relationId: relation.relationId, kind: mode, description,
    })
    if (!caseId) return
    const careCase = useDemoStore.getState().cases[caseId]
    setSuccessMessage(`${caseId} 已提交。${careCase.caseType === 'EVALUATION' ? '工作人员将判断是否承接。' : '工作人员将处理并反馈。'}`)
    setMode(null)
    setDescription('')
  }
  const labels = { CONTACT_CHECK: '联系确认', ITEM_HANDOVER: '物品转交', OTHER: '其他' }
  return <div className="family-conversation">
    <div className="family-request-actions" aria-label="家属服务入口">
      {(Object.keys(labels) as Exclude<RequestMode, null>[]).map((kind) =>
        <button key={kind} type="button" className={mode === kind ? 'is-active' : ''} onClick={() => chooseMode(kind)}>
          <strong>{labels[kind]}</strong><span>{kind === 'OTHER' ? '工作人员人工评估' : kind === 'CONTACT_CHECK' ? '优先确认老人情况' : '描述要转交的物品'}</span>
        </button>) }
    </div>
    <details className="family-option-help"><summary>选项说明</summary><p>联系确认：请工作人员确认老人当前情况；物品转交：普通物品由工作人员核对交接，药品、易碎、大型或不明确物品先人工评估；其他：自由描述，由工作人员判断是否承接。</p></details>
    {successMessage && <p className="family-request-success" role="status">{successMessage}</p>}
    {mode && <form className="family-request-form" aria-label={`${labels[mode]}表单`} onSubmit={submit}>
      <div className="family-form-heading"><strong>{labels[mode]}</strong><span>本地 Demo 助手整理描述，最终由工作人员确认。</span></div>
      <p>服务对象：{elder.name} · {elder.elderId} · {elder.room}房</p>
      <p>请求人：{family.name} · {RELATIONSHIP_LABELS[relation.relationship]}</p>
      <label>{mode === 'ITEM_HANDOVER' ? '请描述物品及交接需求' : '请描述主要问题'}
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={mode === 'CONTACT_CHECK' ? '例如：上午多次联系妈妈未果，希望确认她是否安全' : mode === 'ITEM_HANDOVER' ? '例如：想给妈妈转交一件外套' : '请说说您的需求'} />
      </label>
      <div className="family-form-actions"><button type="button" onClick={() => setMode(null)}>取消</button><button type="submit">提交需求</button></div>
    </form>}
  </div>
}
