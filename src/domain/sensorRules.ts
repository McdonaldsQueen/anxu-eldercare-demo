import type { SensorScenario, SensorSnapshot, RiskEventType } from './models'

export const initialSensorSnapshot = (elderId: string): SensorSnapshot => ({
  elderId, heartRate: 72, spo2: 98, temperature: 36.6, location: '302房',
  fallDetected: false, deviceOnline: true, updatedAt: new Date().toISOString(),
})

/** Demo detection thresholds only; readings and rules are simulated, not medical advice. */
export function simulateSensorReading(elderId: string, scenario: SensorScenario) {
  const snapshot = initialSensorSnapshot(elderId)
  const alerts: Record<Exclude<SensorScenario, 'NORMAL'>, { text: string; riskType: RiskEventType; values: Partial<SensorSnapshot> }> = {
    HIGH_HEART_RATE: { text: '安序手表检测到心率异常（模拟读数 128 次/分）。', riskType: 'OTHER_RISK', values: { heartRate: 128 } },
    LOW_SPO2: { text: '安序手表检测到血氧异常（模拟读数 88%）。', riskType: 'OTHER_RISK', values: { spo2: 88 } },
    HIGH_TEMPERATURE: { text: '安序手表检测到体温异常（模拟读数 38.5°C）。', riskType: 'OTHER_RISK', values: { temperature: 38.5 } },
    FALL: { text: '安序手表检测到疑似跌倒。', riskType: 'FALL', values: { fallDetected: true } },
  }
  if (scenario === 'NORMAL') return { snapshot, alert: null }
  const alert = alerts[scenario]
  return { snapshot: { ...snapshot, ...alert.values }, alert }
}
