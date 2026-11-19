const COLOR_ROLES = ['page', 'rail', 'surface', 'text', 'muted', 'accent', 'on-accent', 'danger'] as const

export const PALETTES = [
  { id: 'classic', label: '经典蓝', light: ['#F4F5F7', '#E5E8ED', '#FFFFFF', '#171A20', '#6B7280', '#2F6FED', '#FFFFFF', '#DC2626'], dark: ['#15171B', '#101216', '#1E2127', '#F1F4F9', '#9098A5', '#5B9DFF', '#08111F', '#F87171'] },
  { id: 'mist', label: '雾蓝', light: ['#F4F7FB', '#E9EFF6', '#FFFFFF', '#172437', '#526174', '#275DBC', '#FFFFFF', '#A82A40'], dark: ['#121A27', '#182232', '#1C293A', '#EAF1FA', '#AEC0D4', '#8BB8FF', '#12233F', '#FFA6AD'] },
  { id: 'pine', label: '松绿', light: ['#F5F6F0', '#E9EDE3', '#FFFEFA', '#213129', '#4C6154', '#246954', '#FFFFFF', '#9B3434'], dark: ['#151E19', '#1C2821', '#243229', '#EDF5EC', '#B3C5B8', '#84C6A7', '#14291F', '#F2A5A0'] },
  { id: 'amber', label: '石墨琥珀', light: ['#F4F1EA', '#E9E4DA', '#FFFCF6', '#292724', '#62594E', '#8A530C', '#FFFFFF', '#A03336'], dark: ['#171715', '#22211E', '#2C2A25', '#F2EEE6', '#C5BCAF', '#FFC471', '#2D1B03', '#FFA39F'] },
  { id: 'teal', label: '海盐青', light: ['#F0F6F6', '#E0EEEE', '#FCFFFF', '#133033', '#486467', '#116971', '#FFFFFF', '#A12F44'], dark: ['#101E21', '#172B2E', '#1D363A', '#E7F6F5', '#A6C3C4', '#73D2CA', '#10292A', '#FFA7B1'] },
  { id: 'clay', label: '暖陶', light: ['#FBF4EE', '#F3E5DA', '#FFFBF7', '#392A24', '#6A5146', '#924827', '#FFFFFF', '#A02D46'], dark: ['#211815', '#2B201B', '#362820', '#F9EEE5', '#CEB6A7', '#F0AC85', '#311B11', '#FFA7AE'] },
] as const

export type PaletteId = typeof PALETTES[number]['id']

export function resolvePalette(value: unknown) {
  return PALETTES.find((palette) => palette.id === value) ?? PALETTES[0]
}

export function applyPalette(value: unknown) {
  const root = document.documentElement
  const palette = resolvePalette(value)
  if (palette.id === 'classic') {
    delete root.dataset.palette
    for (const role of COLOR_ROLES) root.style.removeProperty(`--palette-${role}`)
    return
  }
  root.dataset.palette = palette.id
  for (const [index, role] of COLOR_ROLES.entries()) {
    root.style.setProperty(`--palette-${role}`, `light-dark(${palette.light[index]}, ${palette.dark[index]})`)
  }
}
