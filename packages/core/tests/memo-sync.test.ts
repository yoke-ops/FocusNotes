import { describe, expect, it } from 'vitest'
import {
  buildSyncPayload,
  createDefaultExtras,
  createGiteeSync,
  mergeSyncPayload,
  normalizeMemos,
  pickWidgetLayout,
  type Memo,
  type TodoItem,
} from '../src/index'

function memo(patch: Partial<Memo> = {}): Memo {
  return {
    id: 'm1', title: '标题', content: '正文', pinned: false,
    createdAt: '2026-11-19T00:00:00.000Z', updatedAt: '2026-11-19T00:00:00.000Z',
    revision: 1, deleted: false, ...patch,
  }
}

function todo(patch: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 't1', title: '任务', notes: '', dueAt: null, important: false, urgent: false,
    completed: false, completedAt: null, listId: 'inbox', tags: [],
    createdAt: '2026-11-19T00:00:00.000Z', updatedAt: '2026-11-19T00:00:00.000Z',
    revision: 1, deleted: false, ...patch,
  }
}

describe('normalizeMemos', () => {
  it('keeps valid memos and drops invalid ones', () => {
    const result = normalizeMemos([
      memo({ id: 'a' }),
      { id: '', title: 'x' },
      null,
      { id: 'b', title: '无时间' },
    ])
    expect(result).toHaveLength(2)
    expect([...result.map((item) => item.id)].sort()).toEqual(['a', 'b'])
  })

  it('truncates long content and de-duplicates ids', () => {
    const long = 'x'.repeat(60000)
    const result = normalizeMemos([memo({ id: 'a', content: long }), memo({ id: 'a', content: 'second' })])
    expect(result).toHaveLength(1)
    expect(result[0]!.content.length).toBe(50000)
  })

  it('caps memo count at 500 and sorts pinned first', () => {
    const many = Array.from({ length: 620 }, (_, index) => memo({ id: `m${index}`, pinned: index % 2 === 0 }))
    const result = normalizeMemos(many)
    expect(result).toHaveLength(500)
    expect(result[0]!.pinned).toBe(true)
  })

  it('keeps a freshly created blank memo so it can be filled in later', () => {
    const result = normalizeMemos([memo({ id: 'draft', title: '', content: '' })])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('draft')
    expect(result[0]!.title).toBe('无标题')
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeMemos(null)).toEqual([])
    expect(normalizeMemos({})).toEqual([])
  })
})

describe('buildSyncPayload', () => {
  it('wraps todos and extras with version and timestamp', () => {
    const extras = createDefaultExtras(new Date('2026-11-19T00:00:00.000Z'))
    const payload = buildSyncPayload([todo()], extras, new Date('2026-11-19T08:00:00.000Z'))
    expect(payload.version).toBe(1)
    expect(payload.syncedAt).toBe('2026-11-19T08:00:00.000Z')
    expect(payload.todos).toHaveLength(1)
    expect(payload.extras.memos).toEqual([])
  })
})

describe('mergeSyncPayload', () => {
  it('keeps the higher revision todo and higher revision memo', () => {
    const local = buildSyncPayload(
      [todo({ id: 't1', revision: 3, title: '本地版本' })],
      { ...createDefaultExtras(), memos: [memo({ id: 'm1', revision: 5, content: '本地备忘' })] },
      new Date('2026-11-19T08:00:00.000Z'),
    )
    const remote = buildSyncPayload(
      [todo({ id: 't1', revision: 2, title: '远端旧版' }), todo({ id: 't2', revision: 1 })],
      { ...createDefaultExtras(), memos: [memo({ id: 'm1', revision: 4, content: '远端旧备忘' }), memo({ id: 'm2' })] },
      new Date('2026-11-19T09:00:00.000Z'),
    )
    const merged = mergeSyncPayload(local, remote)
    expect(merged.todos).toHaveLength(2)
    expect(merged.todos.find((item) => item.id === 't1')!.title).toBe('本地版本')
    expect(merged.extras.memos).toHaveLength(2)
    expect(merged.extras.memos.find((item) => item.id === 'm1')!.content).toBe('本地备忘')
  })

  it('unions habit logs and list ids from both sides', () => {
    const localExtras = createDefaultExtras()
    localExtras.habits = [{ id: 'h1', name: '喝水', emoji: '💧', color: '#000', frequency: 'daily', goal: 1, unit: '次', startDate: '2026-01-01', persistence: 'forever', group: '', reminder: null, autoLog: false, archived: false, createdAt: '2026-01-01T00:00:00.000Z' }]
    localExtras.habitLogs = { h1: ['2026-11-18'] }
    const remoteExtras = createDefaultExtras()
    remoteExtras.habits = localExtras.habits
    remoteExtras.habitLogs = { h1: ['2026-11-19'] }
    const merged = mergeSyncPayload(
      buildSyncPayload([], localExtras, new Date()),
      buildSyncPayload([], remoteExtras, new Date()),
    )
    expect(merged.extras.habitLogs.h1).toEqual(['2026-11-18', '2026-11-19'])
  })

  it('is idempotent: merging the same payload twice yields the same result', () => {
    const payload = buildSyncPayload([todo()], { ...createDefaultExtras(), memos: [memo()] }, new Date('2026-11-19T08:00:00.000Z'))
    const once = mergeSyncPayload(payload, payload)
    const twice = mergeSyncPayload(once, payload)
    expect(twice).toEqual(once)
  })
})

describe('pickWidgetLayout', () => {
  it('maps widget cell spans to the four supported layouts', () => {
    expect(pickWidgetLayout(1, 1)).toBe('1x1')
    expect(pickWidgetLayout(2, 1)).toBe('1x2')
    // 1 列 2 行是窄高型，走 2x2 而不是横向的 1x2
    expect(pickWidgetLayout(1, 2)).toBe('2x2')
    expect(pickWidgetLayout(2, 2)).toBe('2x2')
    expect(pickWidgetLayout(4, 2)).toBe('2x4')
    expect(pickWidgetLayout(2, 4)).toBe('2x4')
    expect(pickWidgetLayout(3, 3)).toBe('2x4')
    expect(pickWidgetLayout(0, 0)).toBe('1x1')
  })
})


describe('createGiteeSync', () => {
  const enc = (text: string) => Buffer.from(text, 'utf8').toString('base64')
  const dec = (value: string) => Buffer.from(value, 'base64').toString('utf8')

  it('returns null when the file does not exist yet (404)', async () => {
    const fetcher = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    const sync = createGiteeSync({ owner: 'o', repo: 'r', branch: 'master', token: 't' }, fetcher)
    expect(await sync.pull()).toBeNull()
  })

  it('creates the file with POST when absent and updates with PUT when present', async () => {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = []
    let exists = false
    const fetcher = (async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        if (!exists) return new Response('', { status: 404 })
        return new Response(JSON.stringify({ sha: 'sha-1', content: enc(JSON.stringify(buildSyncPayload([todo()], createDefaultExtras()))) }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ method, body })
      exists = true
      return new Response(JSON.stringify({ content: { sha: 'sha-2' } }), { status: 201 })
    }) as unknown as typeof fetch

    const sync = createGiteeSync({ owner: 'o', repo: 'r', branch: 'master', token: 't' }, fetcher)
    const payload = buildSyncPayload([todo()], createDefaultExtras())
    const first = await sync.push(payload)
    expect(first.created).toBe(true)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.body.sha).toBeUndefined()
    expect(dec(String(calls[0]!.body.content))).toContain('"todos"')

    const second = await sync.push(payload)
    expect(second.created).toBe(false)
    expect(calls[1]!.method).toBe('PUT')
    expect(calls[1]!.body.sha).toBe('sha-1')
  })

  it('merges remote-only records before updating the same revision', async () => {
    const remote = buildSyncPayload([todo({ id: 'remote' })], createDefaultExtras())
    const local = buildSyncPayload([todo({ id: 'local' })], createDefaultExtras())
    const fetcher = (async (_url: string, init?: RequestInit) => {
      if (!init?.method) return new Response(JSON.stringify({ sha: 'latest', content: enc(JSON.stringify(remote)) }))
      const body = JSON.parse(String(init.body))
      expect(init.method).toBe('PUT')
      expect(body.sha).toBe('latest')
      expect(JSON.parse(dec(body.content)).todos.map((item: TodoItem) => item.id).sort()).toEqual(['local', 'remote'])
      return new Response(JSON.stringify({ content: { sha: 'next' } }))
    }) as typeof fetch
    const sync = createGiteeSync({ owner: 'o', repo: 'r', branch: 'master', token: 't' }, fetcher)
    await expect(sync.push(local, { mergeRemote: true })).resolves.toMatchObject({ sha: 'next' })
  })

  it('round-trips Chinese and emoji through base64 without TextEncoder', async () => {
    const payload = buildSyncPayload(
      [todo({ title: '写周报 📝' })],
      { ...createDefaultExtras(), memos: [memo({ title: '会议纪要', content: '讨论了同步方案，结论：走 Gitee API。' })] },
      new Date('2026-11-19T08:00:00.000Z'),
    )
    let sent = ''
    const fetcher = (async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') return new Response('', { status: 404 })
      sent = String(JSON.parse(String(init?.body ?? '{}')).content ?? '')
      return new Response(JSON.stringify({ content: { sha: 's' } }), { status: 201 })
    }) as unknown as typeof fetch

    await createGiteeSync({ owner: 'o', repo: 'r', branch: 'master', token: 't' }, fetcher).push(payload)
    const decoded = dec(sent)
    expect(decoded).toContain('写周报 📝')
    expect(decoded).toContain('讨论了同步方案')
    expect(JSON.parse(decoded).extras.memos[0].title).toBe('会议纪要')
  })

  it('throws a typed error on server failure', async () => {
    const fetcher = (async () => new Response('', { status: 500 })) as unknown as typeof fetch
    const sync = createGiteeSync({ owner: 'o', repo: 'r', branch: 'master', token: 't' }, fetcher)
    await expect(sync.pull()).rejects.toThrow('读取失败')
  })
})
