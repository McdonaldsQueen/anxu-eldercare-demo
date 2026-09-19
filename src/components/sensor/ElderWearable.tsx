import { useDemoStore } from '../../store/demoStore'
import type { SensorScenario } from '../../domain/models'

const scenarios: { value: SensorScenario; label: string }[] = [
  { value: 'NORMAL', label: '正常' }, { value: 'HIGH_HEART_RATE', label: '心率异常' },
  { value: 'LOW_SPO2', label: '血氧异常' }, { value: 'HIGH_TEMPERATURE', label: '体温异常' },
  { value: 'FALL', label: '跌倒' },
]

export function ElderWearable({ elderId }: { elderId: string }) {
  const snapshot = useDemoStore((state) => state.sensorSnapshots[elderId])
  const simulate = useDemoStore((state) => state.simulateSensorEvent)
  if (!snapshot) return null
  return <section className="panel wearable-panel" aria-label="安序手表">
    <div className="section-title-row"><div><p className="eyebrow">设备模拟 · 安序手表</p><h2>安序手表</h2></div><span className="count-chip">{snapshot.deviceOnline ? '设备在线' : '设备离线'}</span></div>
    <div className="wearable-readings">
      <span>心率 <strong>{snapshot.heartRate}</strong> 次/分</span>
      <span>血氧 <strong>{snapshot.spo2}%</strong></span>
      <span>体温 <strong>{snapshot.temperature}°C</strong></span>
      <span>位置 <strong>{snapshot.location}</strong></span>
      <span>跌倒检测 <strong>{snapshot.fallDetected ? '疑似跌倒' : '未检测到'}</strong></span>
    </div>
    <details className="wearable-demo-controls"><summary>Demo 模拟事件</summary><p>模拟数据仅用于演示风险检测，不作医学诊断。异常会直接生成待人工确认的 P0 工单。</p>
      <div>{scenarios.map(({ value, label }) => <button type="button" key={value} onClick={() => simulate(elderId, value)}>{label}</button>)}</div>
    </details>
  </section>
}
