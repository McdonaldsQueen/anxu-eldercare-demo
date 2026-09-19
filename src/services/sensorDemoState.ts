import { useDemoStore } from '../store/demoStore'

export function resetSensorSimulation() {
  useDemoStore.getState().resetSensorState()
}
