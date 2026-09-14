import type { RiskEventType, RiskFollowUpAnswer } from './models'

export interface RiskFollowUpOption {
  value: RiskFollowUpAnswer
  label: string
}

export interface RiskDefinition {
  label: string
  caseTitle: string
  reportSummary: string
  guidance: string
  followUpQuestion: string
  options: RiskFollowUpOption[]
}

const none: RiskFollowUpOption = {
  value: 'NONE_REPORTED',
  label: '暂时没有这些情况',
}

export const RISK_CATALOG: Record<RiskEventType, RiskDefinition> = {
  FALL: {
    label: '跌倒',
    caseTitle: '跌倒安全事件',
    reportSummary: '王阿姨报告发生跌倒',
    guidance: '您先不要勉强站起来，工作人员正在查看这件事。',
    followUpQuestion: '您现在有没有这些情况？',
    options: [
      { value: 'BLEEDING', label: '明显出血' },
      { value: 'SEVERE_PAIN', label: '剧烈疼痛' },
      { value: 'DIZZINESS', label: '头晕' },
      none,
    ],
  },
  BREATHING_DIFFICULTY: {
    label: '呼吸困难',
    caseTitle: '呼吸困难安全事件',
    reportSummary: '王阿姨报告呼吸困难',
    guidance: '工作人员正在查看这件事。请尽量保持当前舒适的姿势，不要勉强活动。',
    followUpQuestion: '现在是否还伴有这些情况？',
    options: [
      { value: 'CANNOT_SPEAK', label: '说话很困难' },
      { value: 'CHEST_DISCOMFORT', label: '胸口不舒服' },
      { value: 'DIZZINESS', label: '同时头晕' },
      none,
    ],
  },
  BLEEDING: {
    label: '出血',
    caseTitle: '出血安全事件',
    reportSummary: '王阿姨报告出现出血',
    guidance: '工作人员正在查看这件事。请先避免继续活动。',
    followUpQuestion: '请告诉我现在的出血情况。',
    options: [
      { value: 'BLEEDING_CONTINUES', label: '还在持续出血' },
      { value: 'LARGE_AMOUNT', label: '出血量比较多' },
      { value: 'DIZZINESS', label: '同时感到头晕' },
      none,
    ],
  },
  SUDDEN_DIZZINESS: {
    label: '突然头晕',
    caseTitle: '突然头晕安全事件',
    reportSummary: '王阿姨报告突然头晕',
    guidance: '请先坐稳或躺好，不要勉强走动，工作人员正在查看这件事。',
    followUpQuestion: '现在是否还伴有这些情况？',
    options: [
      { value: 'CANNOT_STAND', label: '站立很困难' },
      { value: 'NAUSEA', label: '恶心想吐' },
      { value: 'CHEST_DISCOMFORT', label: '胸口不舒服' },
      none,
    ],
  },
  LOSS_OF_CONSCIOUSNESS: {
    label: '意识丧失',
    caseTitle: '意识异常安全事件',
    reportSummary: '收到意识异常相关报告',
    guidance: '已将这件事作为紧急风险通知工作人员，请不要让当事人独自行动。',
    followUpQuestion: '请补充目前能确认的情况。',
    options: [
      { value: 'NOW_AWAKE', label: '现在已经醒来' },
      { value: 'BREATHING_ABNORMAL', label: '呼吸看起来异常' },
      { value: 'INJURY', label: '可能有外伤' },
      none,
    ],
  },
  ENVIRONMENT_HAZARD: {
    label: '环境危险',
    caseTitle: '环境安全事件',
    reportSummary: '王阿姨报告周围存在环境危险',
    guidance: '请优先远离危险区域，不要自行处理危险源。工作人员正在查看。',
    followUpQuestion: '现场更接近哪一种情况？',
    options: [
      { value: 'FIRE_OR_SMOKE', label: '有火或烟' },
      { value: 'GAS_ODOR', label: '闻到煤气味' },
      { value: 'ELECTRICAL_DANGER', label: '有漏电风险' },
      none,
    ],
  },
  LOST_OR_MISSING: {
    label: '走失或迷路',
    caseTitle: '走失安全事件',
    reportSummary: '收到走失或迷路相关报告',
    guidance: '请先留在安全、容易被看到的位置，工作人员正在查看。',
    followUpQuestion: '请补充目前的位置情况。',
    options: [
      { value: 'SAFE_LOCATION', label: '目前在安全地点' },
      { value: 'UNKNOWN_LOCATION', label: '说不清当前位置' },
      { value: 'PHONE_LOW_BATTERY', label: '手机快没电了' },
      none,
    ],
  },
  OTHER_RISK: {
    label: '其他紧急风险',
    caseTitle: '其他安全事件',
    reportSummary: '王阿姨报告遇到紧急情况',
    guidance: '工作人员正在优先查看这件事。请先尽量待在安全位置。',
    followUpQuestion: '请补充目前能确认的情况。',
    options: [
      { value: 'IMMEDIATE_DANGER', label: '危险仍在发生' },
      { value: 'INJURY', label: '有人受伤' },
      { value: 'NEEDS_HELP', label: '需要工作人员帮助' },
      none,
    ],
  },
}

export const RISK_FOLLOW_UP_LABELS = Object.values(RISK_CATALOG)
  .flatMap((definition) => definition.options)
  .reduce<Record<RiskFollowUpAnswer, string>>((labels, option) => {
    labels[option.value] = option.label
    return labels
  }, {} as Record<RiskFollowUpAnswer, string>)

export const OPEN_DESCRIPTION_PROMPT =
  '好的。还有没有其他不舒服，或者刚才发生了什么？您可以直接跟我说。'
