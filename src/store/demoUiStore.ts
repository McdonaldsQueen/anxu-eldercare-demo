import { create } from 'zustand'

export type ExperienceMode = 'OPENHEX' | 'PHASE4'

interface DemoUiStore {
  experienceMode: ExperienceMode
  setExperienceMode: (mode: ExperienceMode) => void
}

const defaultMode: ExperienceMode = import.meta.env.VITE_OPENHEX_AGENT_ID?.trim()
  ? 'OPENHEX'
  : 'PHASE4'

export const useDemoUiStore = create<DemoUiStore>((set) => ({
  experienceMode: defaultMode,
  setExperienceMode: (experienceMode) => set({ experienceMode }),
}))
