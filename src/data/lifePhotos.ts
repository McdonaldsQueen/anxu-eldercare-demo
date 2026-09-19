export interface LifePhoto {
  file: string
  alt: string
  format: 'portrait' | 'landscape' | 'square'
  position?: string
}

// Files live in public/images/life/. Keep paths relative to support Vite base paths.
// Replace these stock photographs with your own everyday-life photography.
export const lifePhotos: LifePhoto[] = [
  { file: 'cooking-together.jpg', alt: '两位老人一起看食谱，准备一顿饭', format: 'landscape', position: '50% 45%' },
  { file: 'reading-at-home.jpg', alt: '早餐桌边，一位老人看报，另一位在写字', format: 'portrait' },
  { file: 'a-walk-outside.jpg', alt: '一位老人走过阳光下的街道', format: 'portrait', position: '50% 65%' },
  { file: 'kitchen-conversation.jpg', alt: '两位女士在厨房一边做饭，一边聊天', format: 'square', position: '50% 65%' },
  { file: 'a-quiet-afternoon.jpg', alt: '一位老人坐在街边读报，一只猫在旁边停留', format: 'portrait', position: '50% 65%' },
]
