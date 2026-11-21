export type ViewId =
  | 'today'
  | 'memos'
  | 'recent'
  | 'inbox'
  | 'completed'
  | 'trash'
  | 'pomodoro'
  | 'habits'
  | 'calendar'
  | 'quadrant'
  | 'assistant'
  | 'widgets'
  | `list:${string}`
  | `tag:${string}`

export function listViewId(id: string): ViewId {
  return `list:${id}`
}

export function tagViewId(tag: string): ViewId {
  return `tag:${tag}`
}

export function activeListId(view: ViewId): string | null {
  return view.startsWith('list:') ? view.slice(5) : null
}

export function activeTag(view: ViewId): string | null {
  return view.startsWith('tag:') ? view.slice(4) : null
}
