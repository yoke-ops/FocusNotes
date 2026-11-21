import type { Memo, TodoItem, WorkspaceExtras } from './types'
import { normalizeExtras } from './workspace'
import { normalizeMemos } from './memo'
import { mergeSyncedTodos } from './sync'

export const SYNC_PAYLOAD_VERSION = 1

/** 一次同步的完整数据快照：待办 + 工作区附属数据（含备忘录）。 */
export interface SyncPayload {
  version: number
  syncedAt: string
  todos: TodoItem[]
  extras: WorkspaceExtras
}

/** 把本地状态打包成可上传的同步载荷。 */
export function buildSyncPayload(todos: readonly TodoItem[], extras: WorkspaceExtras, syncedAt = new Date()): SyncPayload {
  return {
    version: SYNC_PAYLOAD_VERSION,
    syncedAt: syncedAt.toISOString(),
    todos: [...todos],
    extras,
  }
}

function mergeById<T extends { id: string }>(local: readonly T[], remote: readonly T[]): T[] {
  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of remote) {
    const current = map.get(item.id)
    if (!current) { map.set(item.id, item); continue }
    // 两端都有时才比较版本；无版本字段的实体以远端为准（与既有行为一致）。
    const localRev = (current as { revision?: number }).revision
    const remoteRev = (item as { revision?: number }).revision
    if (typeof localRev === 'number' && typeof remoteRev === 'number') {
      if (remoteRev > localRev) map.set(item.id, item)
      else if (remoteRev === localRev) {
        const localAt = Date.parse((current as { updatedAt?: string }).updatedAt ?? '')
        const remoteAt = Date.parse((item as { updatedAt?: string }).updatedAt ?? '')
        if (Number.isFinite(remoteAt) && (!Number.isFinite(localAt) || remoteAt > localAt)) map.set(item.id, item)
      }
    } else {
      map.set(item.id, item)
    }
  }
  return [...map.values()]
}

function mergeMemos(local: readonly Memo[], remote: readonly Memo[]): Memo[] {
  return normalizeMemos(mergeById(local, remote))
}

/**
 * 合并本地与远端的同步载荷。
 * 待办按 revision/updatedAt 取新；附属数据按 id 取并集，打卡日志取并集，偏好以远端为准。
 */
export function mergeSyncPayload(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const localExtras = normalizeExtras(local.extras)
  const remoteExtras = normalizeExtras(remote.extras)

  const habitLogs: Record<string, string[]> = {}
  const habitIds = new Set([...Object.keys(localExtras.habitLogs), ...Object.keys(remoteExtras.habitLogs)])
  for (const habitId of habitIds) {
    const days = new Set([...(localExtras.habitLogs[habitId] ?? []), ...(remoteExtras.habitLogs[habitId] ?? [])])
    habitLogs[habitId] = [...days].sort()
  }

  const mergedExtras: WorkspaceExtras = {
    version: Math.max(localExtras.version, remoteExtras.version),
    lists: mergeById(localExtras.lists, remoteExtras.lists),
    habits: mergeById(localExtras.habits, remoteExtras.habits),
    habitLogs,
    focusSessions: mergeById(localExtras.focusSessions, remoteExtras.focusSessions),
    memos: mergeMemos(localExtras.memos, remoteExtras.memos),
    preferences: remoteExtras.preferences,
    widgets: [...new Set([...localExtras.widgets, ...remoteExtras.widgets])],
  }

  return {
    version: Math.max(local.version, remote.version),
    // 取两端较晚的时间，保证合并是纯函数（同输入必同输出，便于测试与幂等）。
    syncedAt: local.syncedAt > remote.syncedAt ? local.syncedAt : remote.syncedAt,
    todos: mergeSyncedTodos([...local.todos], [...remote.todos]),
    extras: mergedExtras,
  }
}

/** 把任意来源的 JSON 解析成同步载荷；结构不合法返回 null。 */
export function parseSyncPayload(value: unknown): SyncPayload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.todos)) return null
  return {
    version: typeof record.version === 'number' ? record.version : SYNC_PAYLOAD_VERSION,
    syncedAt: typeof record.syncedAt === 'string' ? record.syncedAt : new Date(0).toISOString(),
    todos: record.todos as TodoItem[],
    extras: normalizeExtras(record.extras),
  }
}
