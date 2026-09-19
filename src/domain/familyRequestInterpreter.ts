import type { FamilyNaturalRequestInput, ItemCategory } from './models'

/** Local demo interpreter: preserves the family's wording and applies deterministic routing. */
export function interpretFamilyRequest(input: FamilyNaturalRequestInput) {
  const description = input.description.trim().replace(/\s+/g, ' ')
  const item = description.match(/(?:转交|送|带|交给|寄)(?:给老人|给妈妈|给爸爸|给她|给他)?\s*(?:一[件个份盒包瓶条台]|\d+[件个份盒包瓶条台])?\s*([^，。；,;]{1,24})/)?.[1]?.trim()
    ?? description.match(/(外套|衣服|毛衣|鞋|书|照片|眼镜|文件|证件|纸巾|毛巾|水杯|药品|药|手机|轮椅|家具|玻璃杯)/)?.[1]
    ?? null
  const flags: string[] = []
  if (/(药|处方|医疗器械|保健品|喂药|服药|用药)/.test(description)) flags.push('涉及药品或用药')
  if (/(易碎|玻璃|陶瓷|瓷器|精密|液体)/.test(description)) flags.push('易碎或需特殊包装')
  if (/(大型|大件|家具|轮椅|床垫|冰箱|洗衣机|很重|超重)/.test(description)) flags.push('体积或重量需确认')
  if (/(危险品|刀具|易燃|酒精|电池|活体|现金|贵重)/.test(description)) flags.push('可能不适合自动承诺转交')
  if (!item || /(东西|物品|一些|那个|什么|不确定|还没想好)/.test(item) || /(不确定|不清楚|可能是)/.test(description)) flags.push('物品信息尚不明确')
  const category: ItemCategory = /(衣|鞋|外套|毛衣)/.test(description) ? 'CLOTHING'
    : /(药|处方)/.test(description) ? 'MEDICATION'
      : /(文件|证件)/.test(description) ? 'DOCUMENT'
        : /(食物|水果|食品)/.test(description) ? 'FOOD' : 'OTHER'
  return {
    description,
    itemName: item,
    itemCategory: category,
    needsEvaluation: input.kind === 'OTHER' || (input.kind === 'ITEM_HANDOVER' && flags.length > 0),
    evaluationReason: input.kind === 'OTHER' ? '开放需求需工作人员确认服务范围及执行方式。' : flags.join('；'),
    agentSummary: input.kind === 'CONTACT_CHECK' ? `联系确认：${description}`
      : input.kind === 'ITEM_HANDOVER' ? `物品转交：${item ?? '待确认物品'}；家属描述：${description}`
        : `其他需求：${description}`,
    staffActionSummary: input.kind === 'CONTACT_CHECK' ? '优先联系或现场确认老人情况，并将实际结果反馈家属。'
      : input.kind === 'ITEM_HANDOVER' && flags.length === 0 ? '核对物品、交接方式和时间，处理后反馈家属。'
        : '判断是否承接、需要哪些条件，并向家属说明决定。',
  }
}
