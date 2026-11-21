import {
  Archive,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  Dumbbell,
  Heart,
  Inbox,
  ListTodo,
  NotebookPen,
  Rocket,
  ShoppingBag,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { Quadrant } from '@focusnotes/core'

export const QUADRANT_GRID_ORDER: readonly Quadrant[] = [
  'not-important-urgent', 'important-urgent',
  'not-important-not-urgent', 'important-not-urgent',
]

export const QUADRANT_ICONS: Record<Quadrant, LucideIcon> = {
  'not-important-not-urgent': Archive,
  'important-not-urgent': Calendar,
  'not-important-urgent': Timer,
  'important-urgent': Rocket,
}

const LIST_ICONS = new Map<string, LucideIcon>([
  ['inbox', Inbox],
  ['work', BriefcaseBusiness],
  ['personal', NotebookPen],
  ['study', BookOpen],
  ['shopping', ShoppingBag],
  ['fitness', Dumbbell],
  ['wish', Heart],
])

export function listIcon(listId: string): LucideIcon {
  return LIST_ICONS.get(listId) ?? ListTodo
}
