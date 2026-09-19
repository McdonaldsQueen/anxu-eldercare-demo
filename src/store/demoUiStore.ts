import { create } from 'zustand'

export type ExperienceMode = 'OPENHEX' | 'PHASE4'

interface DemoUiStore {
  experienceMode: ExperienceMode
  openhexConversationId?: string
  setExperienceMode: (mode: ExperienceMode) => void
  setOpenhexConversationId: (conversationId?: string) => void
  resetExperienceMode: () => void
}

export const defaultExperienceMode = (): ExperienceMode => import.meta.env.VITE_OPENHEX_AGENT_ID?.trim()
  ? 'OPENHEX'
  : 'PHASE4'

export const useDemoUiStore = create<DemoUiStore>((set) => ({
  experienceMode: defaultExperienceMode(),
  openhexConversationId: undefined,
  setExperienceMode: (experienceMode) => set({ experienceMode }),
  setOpenhexConversationId: (openhexConversationId) => set({ openhexConversationId }),
  resetExperienceMode: () => set({
    experienceMode: defaultExperienceMode(),
    openhexConversationId: undefined,
  }),
}))
