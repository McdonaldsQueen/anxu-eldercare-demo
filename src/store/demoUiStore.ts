import { create } from 'zustand'

export type ExperienceMode = 'OPENHEX' | 'PHASE4'

interface DemoUiStore {
  experienceMode: ExperienceMode
  setExperienceMode: (mode: ExperienceMode) => void
  resetExperienceMode: () => void
}

export const defaultExperienceMode = (): ExperienceMode => import.meta.env.VITE_OPENHEX_AGENT_ID?.trim()
  ? 'OPENHEX'
  : 'PHASE4'

export const useDemoUiStore = create<DemoUiStore>((set) => ({
  experienceMode: defaultExperienceMode(),
  setExperienceMode: (experienceMode) => set({ experienceMode }),
  resetExperienceMode: () => set({ experienceMode: defaultExperienceMode() }),
}))
