import { useState, type FormEvent } from 'react'
import type { DeliveryMethod, ElderFamilyRelation, ElderProfile, FamilyProfile, ItemCategory } from '../../domain/models'
import { RELATIONSHIP_LABELS } from '../../domain/identity'
import { useDemoStore } from '../../store/demoStore'

type RequestMode = 'CONTACT_CHECK' | 'ITEM_HANDOVER' | null

const ITEM_CATEGORIES: Array<{ value: ItemCategory; label: string }> = [
  { value: 'FOOD', label: '食品' },
  { value: 'CLOTHING', label: '衣物' },
  { value: 'DAILY_NECESSITY', label: '日用品' },
  { value: 'DOCUMENT', label: '文件' },
  { value: 'MEDICATION', label: '药品' },
  { value: 'OTHER', label: '其他' },
]

const DELIVERY_METHODS: Array<{ value: DeliveryMethod; label: string }> = [
  { value: 'FAMILY_DROP_OFF', label: '家属送至机构' },
  { value: 'COURIER', label: '快递送达' },
  { value: 'STAFF_PICKUP', label: '请工作人员取件' },
  { value: 'OTHER', label: '其他方式' },
]

interface FamilyConversationProps {
  elder: ElderProfile
  family: FamilyProfile
  relation: ElderFamilyRelation
}

export function FamilyConversation({ elder, family, relation }: FamilyConversationProps) {
  const createContactRequest = useDemoStore((state) => state.createFamilyContactRequest)
  const createItemRequest = useDemoStore((state) => state.createFamilyItemRequest)
  const [mode, setMode] = useState<RequestMode>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [lastContactTime, setLastContactTime] = useState('')
  const [contactAttempts, setContactAttempts] = useState(1)
  const [additionalNote, setAdditionalNote] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemCategory, setItemCategory] = useState<ItemCategory | ''>('')
  const [quantity, setQuantity] = useState(1)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('FAMILY_DROP_OFF')
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState('')
  const [specialInstruction, setSpecialInstruction] = useState('')
  const [medicationPackageNote, setMedicationPackageNote] = useState('')

  const chooseMode = (nextMode: Exclude<RequestMode, null>) => {
    setMode(nextMode)
    setSuccessMessage('')
  }

  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const caseId = createContactRequest({
      elderId: elder.elderId,
      requesterId: family.familyUserId,
      relationId: relation.relationId,
      lastContactTime,
      contactAttempts,
      additionalNote,
    })
    if (!caseId) return
    setSuccessMessage(`${caseId} 已创建，工作人员会优先确认老人情况。`)
    setMode(null)
  }

  const submitItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!itemCategory) return
    const caseId = createItemRequest({
      elderId: elder.elderId,
      requesterId: family.familyUserId,
      relationId: relation.relationId,
      itemName,
      itemCategory,
      quantity,
      deliveryMethod,
      expectedDeliveryTime,
      specialInstruction,
      medicationPackageNote: itemCategory === 'MEDICATION' ? medicationPackageNote : undefined,
    })
    if (!caseId) return
    const createdCase = useDemoStore.getState().cases[caseId]
    setSuccessMessage(createdCase.caseType === 'EVALUATION'
      ? `${caseId} 已进入人工评估，工作人员确认前不会承诺执行用药协助。`
      : `${caseId} 已创建，工作人员会按 P1 物品转交处理。`)
    setMode(null)
  }

  return (
    <div className="family-conversation">
      <div className="family-request-actions" aria-label="家属服务入口">
        <button type="button" className={mode === 'CONTACT_CHECK' ? 'is-active' : ''} onClick={() => chooseMode('CONTACT_CHECK')}>
          <strong>联系不上老人</strong>
          <span>P0 · 请求工作人员确认情况</span>
        </button>
        <button type="button" className={mode === 'ITEM_HANDOVER' ? 'is-active' : ''} onClick={() => chooseMode('ITEM_HANDOVER')}>
          <strong>转交物品</strong>
          <span>P1 · 提交明确交接信息</span>
        </button>
      </div>

      {successMessage && <p className="family-request-success" role="status">{successMessage}</p>}

      {mode === 'CONTACT_CHECK' && (
        <form className="family-request-form" aria-label="联系不上老人表单" onSubmit={submitContact}>
          <div className="family-form-heading"><strong>联系不上老人</strong><span>P0 是业务处理优先级，不代表医学急症诊断。</span></div>
          <label>老人 <input value={`${elder.name}（${elder.elderId}）`} readOnly /></label>
          <label>申请人 <input value={`${family.name}（${family.familyUserId}）`} readOnly /></label>
          <label>与老人关系 <input value={RELATIONSHIP_LABELS[relation.relationship]} readOnly /></label>
          <label>最后一次联系时间 <input required type="datetime-local" value={lastContactTime} onChange={(event) => setLastContactTime(event.target.value)} /></label>
          <label>已尝试联系次数 <input required type="number" min="1" step="1" value={contactAttempts} onChange={(event) => setContactAttempts(Number(event.target.value))} /></label>
          <label>补充说明（可选） <textarea value={additionalNote} onChange={(event) => setAdditionalNote(event.target.value)} placeholder="例如：通常每天上午会接电话" /></label>
          <div className="family-form-actions"><button type="button" onClick={() => setMode(null)}>取消</button><button type="submit">提交联系确认</button></div>
        </form>
      )}

      {mode === 'ITEM_HANDOVER' && (
        <form className="family-request-form" aria-label="物品转交表单" onSubmit={submitItem}>
          <div className="family-form-heading"><strong>转交物品</strong><span>仅按您选择的类别记录，不会自动识别为药品。</span></div>
          <label>物品名称 <input required value={itemName} onChange={(event) => setItemName(event.target.value)} /></label>
          <label>物品类别
            <select required aria-label="物品类别" value={itemCategory} onChange={(event) => {
              const nextCategory = event.target.value as ItemCategory
              setItemCategory(nextCategory)
              if (nextCategory !== 'MEDICATION') setMedicationPackageNote('')
            }}>
              <option value="" disabled>请选择物品类别</option>
              {ITEM_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </label>
          <label>数量 <input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label>交付方式
            <select aria-label="交付方式" value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod)}>
              {DELIVERY_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <label>预计送达时间 <input required type="datetime-local" value={expectedDeliveryTime} onChange={(event) => setExpectedDeliveryTime(event.target.value)} /></label>
          {itemCategory === 'MEDICATION' && (
            <div className="medication-fields">
              <label>药品包装备注（可选） <input value={medicationPackageNote} onChange={(event) => setMedicationPackageNote(event.target.value)} placeholder="仅记录名称、包装或交接信息" /></label>
              <small>系统不会生成剂量、用法、服药频率或医疗建议。</small>
            </div>
          )}
          <label>特殊说明（可选） <textarea value={specialInstruction} onChange={(event) => setSpecialInstruction(event.target.value)} placeholder="例如：易碎，请当面交接" /></label>
          <p className="medication-boundary">如需工作人员喂药、提醒服药或管理用药，将转入人工评估，不会自动承诺执行。</p>
          <div className="family-form-actions"><button type="button" onClick={() => setMode(null)}>取消</button><button type="submit">提交物品转交</button></div>
        </form>
      )}
    </div>
  )
}
