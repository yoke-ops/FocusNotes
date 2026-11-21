/** 小组件布局尺寸。命名按「列 x 行」理解，但判定以 span 面积/形状为准。 */
export type WidgetLayout = '1x1' | '1x2' | '2x2' | '2x4'

/**
 * 根据桌面上小组件占用的格数（spanX 列、spanY 行）选择最合适的布局。
 * 规则：单格 → 1x1；单行（矮）→ 1x2；不超过 2x2 → 2x2；其余 → 2x4。
 */
export function pickWidgetLayout(spanX: number, spanY: number): WidgetLayout {
  const x = Number.isFinite(spanX) ? Math.max(1, Math.round(spanX)) : 1
  const y = Number.isFinite(spanY) ? Math.max(1, Math.round(spanY)) : 1
  if (x <= 1 && y <= 1) return '1x1'
  if (y <= 1) return '1x2'
  if (x <= 2 && y <= 2) return '2x2'
  return '2x4'
}
