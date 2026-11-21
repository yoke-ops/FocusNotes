import type { SyncPayload } from './sync-payload'
import { mergeSyncPayload, parseSyncPayload } from './sync-payload'

export interface GiteeConfig {
  owner: string
  repo: string
  branch: string
  token: string
  /** 仓库内文件路径，默认 focusnotes/data.json */
  path?: string
}

export interface GiteeSyncApi {
  pull(): Promise<SyncPayload | null>
  push(payload: SyncPayload, options?: { mergeRemote?: boolean }): Promise<{ created: boolean; sha: string }>
  test(): Promise<boolean>
}

export class GiteeSyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'GiteeSyncError'
  }
}

const API = 'https://gitee.com/api/v5'
const DEFAULT_PATH = 'focusnotes/data.json'

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 纯 JS UTF-8 编码，避免依赖 RN/Hermes 不一定提供的 TextEncoder。 */
function utf8Encode(text: string): number[] {
  const bytes: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        index += 1
      }
    }
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return bytes
}

function utf8Decode(bytes: number[]): string {
  let text = ''
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]!
    let code: number
    if (first < 0x80) { code = first; index += 1 }
    else if ((first & 0xe0) === 0xc0) { code = ((first & 0x1f) << 6) | (bytes[index + 1]! & 0x3f); index += 2 }
    else if ((first & 0xf0) === 0xe0) { code = ((first & 0x0f) << 12) | ((bytes[index + 1]! & 0x3f) << 6) | (bytes[index + 2]! & 0x3f); index += 3 }
    else {
      code = ((first & 0x07) << 18) | ((bytes[index + 1]! & 0x3f) << 12) | ((bytes[index + 2]! & 0x3f) << 6) | (bytes[index + 3]! & 0x3f)
      index += 4
    }
    if (code > 0xffff) {
      code -= 0x10000
      text += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
    } else {
      text += String.fromCharCode(code)
    }
  }
  return text
}

function base64Encode(text: string): string {
  const bytes = utf8Encode(text)
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    output += BASE64_ALPHABET.charAt(first >> 2)
    output += BASE64_ALPHABET.charAt(((first & 0x03) << 4) | ((second ?? 0) >> 4))
    output += second === undefined ? '=' : BASE64_ALPHABET.charAt(((second & 0x0f) << 2) | ((third ?? 0) >> 6))
    output += third === undefined ? '=' : BASE64_ALPHABET.charAt(third & 0x3f)
  }
  return output
}

function base64Decode(value: string): string {
  const clean = value.replace(/\s/g, '')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of clean) {
    if (char === '=') break
    const index = BASE64_ALPHABET.indexOf(char)
    if (index < 0) continue
    buffer = (buffer << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return utf8Decode(bytes)
}

/**
 * 基于 Gitee OpenAPI 的同步实现：读取= pull，提交= push（每次产生一个 commit）。
 * fetch 由调用方注入，便于桌面/移动共用同一实现并做测试替身。
 */
export function createGiteeSync(config: GiteeConfig, fetcher: typeof fetch, path = config.path ?? DEFAULT_PATH): GiteeSyncApi {
  const { owner, repo, branch, token } = config
  const headers = { Authorization: `token ${token}`, 'Content-Type': 'application/json' }
  const fileUrl = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`

  async function readFile(): Promise<{ sha: string; content: string } | null> {
    const response = await fetcher(`${fileUrl}?ref=${encodeURIComponent(branch)}`, { headers })
    if (response.status === 404) return null
    if (!response.ok) throw new GiteeSyncError(`读取失败（${response.status}）`, response.status)
    const data = await response.json() as { sha?: string; content?: string }
    if (!data.sha) return null
    const content = data.content ? base64Decode(data.content) : ''
    return { sha: data.sha, content }
  }

  return {
    async pull() {
      const file = await readFile()
      if (!file || !file.content.trim()) return null
      try {
        return parseSyncPayload(JSON.parse(file.content))
      } catch {
        throw new GiteeSyncError('远端数据格式无法解析')
      }
    },
    async push(payload, options) {
      const file = await readFile()
      if (file?.content.trim() && options?.mergeRemote) {
        const remote = parseSyncPayload(JSON.parse(file.content))
        if (!remote) throw new GiteeSyncError('远端数据格式无法解析，未覆盖原文件。')
        payload = mergeSyncPayload(payload, remote)
      }
      const body: Record<string, unknown> = {
        content: base64Encode(JSON.stringify(payload)),
        message: `sync: ${payload.syncedAt}`,
        branch,
      }
      if (file) body.sha = file.sha
      const response = await fetcher(fileUrl, {
        method: file ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new GiteeSyncError(`提交失败（${response.status}）`, response.status)
      const data = await response.json() as { content?: { sha?: string } }
      return { created: !file, sha: data.content?.sha ?? '' }
    },
    async test() {
      const response = await fetcher(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers })
      return response.ok
    },
  }
}
