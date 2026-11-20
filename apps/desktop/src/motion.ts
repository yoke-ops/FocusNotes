export const MOTION_OPTIONS = [
  { id: 'full', label: '完整' },
  { id: 'light', label: '轻量' },
  { id: 'off', label: '关闭' },
] as const

export type MotionMode = typeof MOTION_OPTIONS[number]['id']

export function resolveMotion(value: unknown): MotionMode {
  return MOTION_OPTIONS.find((option) => option.id === value)?.id ?? 'full'
}

export function taskMotionDuration(): number {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  const mode = resolveMotion(document.documentElement.dataset.motion)
  if (mode === 'off') return 0
  return mode === 'light' ? 100 : 260
}
