import { RISK_CATALOG } from '../../domain/riskCatalog'
import { selectActiveSafetyCase, useDemoStore } from '../../store/demoStore'
import { AlertIcon, CheckIcon } from '../ui/Icons'

export function RiskFollowUpPanel() {
  const careCase = useDemoStore(selectActiveSafetyCase)
  const session = useDemoStore((state) => state.conversationState.elder)
  const recordRiskFollowUp = useDemoStore((state) => state.recordRiskFollowUp)

  if (!careCase?.eventType || session.activeCaseId !== careCase.caseId ||
    !['COLLECTING_RISK', 'OPEN_RISK_DESCRIPTION', 'ACTIVE_RISK'].includes(session.conversationMode)) return null

  const followUpType = careCase.latestRiskEventType ?? careCase.eventType
  const definition = RISK_CATALOG[followUpType]

  return (
    <section className="fall-risk-panel" role="alert" aria-label={`${definition.label}安全风险`}>
      <header>
        <span className="fall-risk-panel__icon"><AlertIcon /></span>
        <div><p className="eyebrow">需要优先处理</p><h2>检测到{definition.label}相关安全风险</h2></div>
      </header>
      <p className="fall-risk-panel__guidance">{definition.guidance}</p>
      <fieldset>
        <legend>{definition.followUpQuestion}</legend>
        <div className="symptom-options">
          {definition.options.map((option) => {
            const selected = careCase.reportedSymptoms.includes(option.value)
            return (
              <button
                type="button"
                className={selected ? 'is-selected' : ''}
                aria-pressed={selected}
                key={option.value}
                onClick={() => recordRiskFollowUp(option.value)}
              >
                {selected && <CheckIcon />} {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      <small>以上信息只用于帮助工作人员了解情况，不作医疗判断。AI 建议等级不会替代工作人员最终确认。</small>
    </section>
  )
}
