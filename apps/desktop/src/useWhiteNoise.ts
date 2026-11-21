import { useCallback, useEffect, useRef, useState } from 'react'
import { sleepTimerRemaining } from '@focusnotes/core'

export type NoiseScene =
  | 'rain' | 'waves' | 'forest' | 'cafe' | 'pink'
  | 'thunder' | 'fire' | 'waterfall' | 'birds' | 'brown'
  | 'wind' | 'night'

export const NOISE_SCENES: Array<{ id: NoiseScene; label: string; hint: string; icon: string }> = [
  { id: 'rain', label: '雨声', hint: '细雨落在窗边', icon: 'rain' },
  { id: 'waves', label: '海浪', hint: '潮汐缓慢起伏', icon: 'waves' },
  { id: 'forest', label: '森林', hint: '风穿过树梢', icon: 'forest' },
  { id: 'cafe', label: '咖啡馆', hint: '低语与环境底噪', icon: 'cafe' },
  { id: 'pink', label: '粉红噪音', hint: '柔和宽频背景', icon: 'pink' },
  { id: 'thunder', label: '雷声', hint: '远方闷雷与雨幕', icon: 'thunder' },
  { id: 'fire', label: '篝火', hint: '木柴噼啪作响', icon: 'fire' },
  { id: 'waterfall', label: '瀑布', hint: '水流奔涌轰鸣', icon: 'waterfall' },
  { id: 'birds', label: '鸟鸣', hint: '林间清脆啁啾', icon: 'birds' },
  { id: 'brown', label: '棕噪音', hint: '低沉宽频背景', icon: 'brown' },
  { id: 'wind', label: '风声', hint: '起伏的低频山风', icon: 'wind' },
  { id: 'night', label: '夏夜', hint: '虫鸣与夜间氛围', icon: 'night' },
]

export const SLEEP_OPTIONS = [15, 30, 45, 60, 90] as const
export type SleepMinutes = (typeof SLEEP_OPTIONS)[number]
export const MAX_MIX = 4

interface Engine {
  ctx: AudioContext
  master: GainNode
  nodes: AudioNode[]
  timers: number[]
  sources: AudioBufferSourceNode[]
  cancelled: { value: boolean }
}

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    if (kind === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    } else if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buffer
}

function loopSource(ctx: AudioContext, buffer: AudioBuffer, gainValue: number, filter?: { type: BiquadFilterType; frequency: number; q?: number }): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = gainValue
  if (filter) {
    const biquad = ctx.createBiquadFilter()
    biquad.type = filter.type
    biquad.frequency.value = filter.frequency
    if (filter.q) biquad.Q.value = filter.q
    source.connect(biquad).connect(gain)
  } else {
    source.connect(gain)
  }
  return { source, gain }
}

/** 脉冲包络（雷声/鸟鸣/篝火噼啪），alive 为假时停止递归调度。 */
function pulse(ctx: AudioContext, gain: GainNode, min: number, max: number, level: number, ramp: number, alive: () => boolean, track?: (id: number) => void) {
  if (!alive()) return
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(level, t + ramp)
  gain.gain.linearRampToValueAtTime(0, t + ramp + min / 1000)
  const id = window.setTimeout(() => pulse(ctx, gain, min, max, level, ramp, alive, track), min + Math.random() * (max - min))
  track?.(id)
}

/** 单个场景的合成配方。混音时多个场景各分到一个子增益，再汇入总线上。 */
function buildScene(ctx: AudioContext, target: GainNode, scene: NoiseScene, cancelled: { value: boolean }): { sources: AudioBufferSourceNode[]; timers: number[] } {
  const white = noiseBuffer(ctx, 4, 'white')
  const pink = noiseBuffer(ctx, 4, 'pink')
  const brown = noiseBuffer(ctx, 4, 'brown')
  const sources: AudioBufferSourceNode[] = []
  const timers: number[] = []
  const attach = (item: { source: AudioBufferSourceNode; gain: GainNode }) => {
    item.gain.connect(target)
    sources.push(item.source)
    return item
  }
  const alive = () => !cancelled.value
  const track = (id: number) => { timers.push(id) }

  if (scene === 'rain') {
    attach(loopSource(ctx, white, 0.16, { type: 'bandpass', frequency: 1800, q: 0.5 }))
    attach(loopSource(ctx, brown, 0.14, { type: 'lowpass', frequency: 420 }))
  } else if (scene === 'waves') {
    const surf = attach(loopSource(ctx, white, 0.22, { type: 'lowpass', frequency: 700 }))
    timers.push(window.setInterval(() => {
      const t = ctx.currentTime
      surf.gain.gain.cancelScheduledValues(t)
      surf.gain.gain.setValueAtTime(surf.gain.gain.value, t)
      surf.gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.12, t + 3.5)
    }, 3600))
  } else if (scene === 'forest') {
    attach(loopSource(ctx, brown, 0.24, { type: 'lowpass', frequency: 620 }))
    attach(loopSource(ctx, pink, 0.1, { type: 'bandpass', frequency: 3200, q: 0.6 }))
  } else if (scene === 'cafe') {
    attach(loopSource(ctx, pink, 0.18, { type: 'bandpass', frequency: 900, q: 0.7 }))
    attach(loopSource(ctx, brown, 0.1, { type: 'lowpass', frequency: 380 }))
  } else if (scene === 'thunder') {
    attach(loopSource(ctx, brown, 0.12, { type: 'lowpass', frequency: 500 }))
    const rumble = attach(loopSource(ctx, brown, 0, { type: 'lowpass', frequency: 180 }))
    timers.push(window.setTimeout(() => pulse(ctx, rumble.gain, 2200, 5200, 0.55, 0.4, alive, track), 800))
  } else if (scene === 'fire') {
    attach(loopSource(ctx, brown, 0.12, { type: 'lowpass', frequency: 480 }))
    const crackle = attach(loopSource(ctx, white, 0, { type: 'bandpass', frequency: 4200, q: 1.2 }))
    timers.push(window.setTimeout(() => pulse(ctx, crackle.gain, 120, 480, 0.22, 0.02, alive, track), 120))
  } else if (scene === 'waterfall') {
    attach(loopSource(ctx, white, 0.22, { type: 'lowpass', frequency: 2400 }))
    attach(loopSource(ctx, brown, 0.18, { type: 'lowpass', frequency: 520 }))
  } else if (scene === 'birds') {
    attach(loopSource(ctx, pink, 0.08, { type: 'bandpass', frequency: 2600, q: 0.8 }))
    const chirp = attach(loopSource(ctx, white, 0, { type: 'bandpass', frequency: 3800, q: 3 }))
    timers.push(window.setTimeout(() => pulse(ctx, chirp.gain, 800, 2600, 0.16, 0.06, alive, track), 400))
  } else if (scene === 'wind') {
    const gust = attach(loopSource(ctx, brown, 0.2, { type: 'lowpass', frequency: 400 }))
    timers.push(window.setInterval(() => {
      const t = ctx.currentTime
      gust.gain.gain.cancelScheduledValues(t)
      gust.gain.gain.setValueAtTime(gust.gain.gain.value, t)
      gust.gain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.16, t + 4.2)
    }, 4200))
  } else if (scene === 'night') {
    attach(loopSource(ctx, brown, 0.1, { type: 'lowpass', frequency: 300 }))
    const cricket = attach(loopSource(ctx, white, 0, { type: 'bandpass', frequency: 5200, q: 6 }))
    timers.push(window.setTimeout(() => pulse(ctx, cricket.gain, 260, 900, 0.08, 0.02, alive, track), 260))
  } else {
    const base = scene === 'brown' ? brown : pink
    attach(loopSource(ctx, base, 0.3))
  }
  return { sources, timers }
}

export interface WhiteNoiseApi {
  scenes: typeof NOISE_SCENES
  active: NoiseScene[]
  volume: number
  playing: boolean
  sleepMinutes: SleepMinutes | null
  sleepRemaining: number
  toggle: (scene: NoiseScene) => void
  stop: () => void
  setVolume: (value: number) => void
  setSleep: (minutes: SleepMinutes | null) => void
}

const FADE_SECONDS = 15

export function useWhiteNoise(): WhiteNoiseApi {
  const engine = useRef<Engine | null>(null)
  const sleepStartedAt = useRef<number | null>(null)
  const fadeStarted = useRef(false)
  const [active, setActive] = useState<NoiseScene[]>([])
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(window.localStorage.getItem('focusnotes.noiseVolume') ?? 45)
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 45
  })
  const [playing, setPlaying] = useState(false)
  const [sleepMinutes, setSleepMinutesState] = useState<SleepMinutes | null>(() => {
    const saved = Number(window.localStorage.getItem('focusnotes.noiseSleep'))
    return SLEEP_OPTIONS.includes(saved as SleepMinutes) ? saved as SleepMinutes : null
  })
  const [sleepRemaining, setSleepRemaining] = useState(0)

  const stop = useCallback(() => {
    const current = engine.current
    if (current) {
      current.timers.forEach((id) => { window.clearTimeout(id); window.clearInterval(id) })
      current.sources.forEach((source) => { try { source.stop() } catch { /* 已停止 */ } })
      void current.ctx.close().catch(() => undefined)
      current.cancelled.value = true
      engine.current = null
    }
    sleepStartedAt.current = null
    fadeStarted.current = false
    setSleepRemaining(0)
    setPlaying(false)
    setActive([])
  }, [])

  /** 用给定场景集合重建引擎；空数组即停止。 */
  const rebuild = useCallback((next: NoiseScene[]) => {
    stop()
    if (next.length === 0) { setActive([]); return }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = volume / 100
    master.connect(ctx.destination)
    const cancelled = { value: false }
    const nodes: AudioNode[] = [master]
    const sources: AudioBufferSourceNode[] = []
    const timers: number[] = []
    // 每个场景分配独立子增益，混音时按数量均摊，避免叠加爆音
    const perScene = 0.9 / Math.max(1, next.length)
    next.forEach((scene) => {
      const bus = ctx.createGain()
      bus.gain.value = perScene
      bus.connect(master)
      nodes.push(bus)
      const built = buildScene(ctx, bus, scene, cancelled)
      sources.push(...built.sources)
      timers.push(...built.timers)
    })
    sources.forEach((source) => { try { source.start() } catch { /* 忽略 */ } })
    engine.current = { ctx, master, nodes, timers, sources, cancelled }
    void ctx.resume().catch(() => undefined)
    if (sleepMinutes) sleepStartedAt.current = Date.now()
    fadeStarted.current = false
    setActive(next)
    setPlaying(true)
  }, [stop, volume, sleepMinutes])

  const toggle = useCallback((scene: NoiseScene) => {
    const has = active.includes(scene)
    if (has) rebuild(active.filter((item) => item !== scene))
    else if (active.length >= MAX_MIX) rebuild([...active.slice(1), scene])
    else rebuild([...active, scene])
  }, [active, rebuild])

  const setVolume = useCallback((value: number) => {
    const next = Math.min(100, Math.max(0, value))
    setVolumeState(next)
    window.localStorage.setItem('focusnotes.noiseVolume', String(next))
    if (engine.current) engine.current.master.gain.value = next / 100
  }, [])

  const setSleep = useCallback((minutes: SleepMinutes | null) => {
    setSleepMinutesState(minutes)
    if (minutes === null) window.localStorage.removeItem('focusnotes.noiseSleep')
    else window.localStorage.setItem('focusnotes.noiseSleep', String(minutes))
    // 取消可能正在进行的淡出，恢复用户设定的音量。
    if (engine.current) {
      const t = engine.current.ctx.currentTime
      engine.current.master.gain.cancelScheduledValues(t)
      engine.current.master.gain.setValueAtTime(volume / 100, t)
    }
    sleepStartedAt.current = minutes && engine.current ? Date.now() : null
    fadeStarted.current = false
    setSleepRemaining(minutes ? minutes * 60_000 : 0)
  }, [volume])

  useEffect(() => {
    if (!playing || !sleepMinutes) return
    const interval = window.setInterval(() => {
      const started = sleepStartedAt.current
      if (!started || !engine.current) return
      const remaining = sleepTimerRemaining(started, sleepMinutes, new Date())
      setSleepRemaining(Math.max(0, remaining))
      if (remaining <= 0) { stop(); setActive([]); return }
      if (remaining <= FADE_SECONDS * 1000 && !fadeStarted.current) {
        fadeStarted.current = true
        const t = engine.current.ctx.currentTime
        engine.current.master.gain.cancelScheduledValues(t)
        engine.current.master.gain.setValueAtTime(engine.current.master.gain.value, t)
        engine.current.master.gain.linearRampToValueAtTime(0, t + FADE_SECONDS)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [playing, sleepMinutes, stop])

  useEffect(() => () => {
    const current = engine.current
    if (current) {
      current.timers.forEach((id) => { window.clearTimeout(id); window.clearInterval(id) })
      current.sources.forEach((source) => { try { source.stop() } catch { /* 已停止 */ } })
      void current.ctx.close().catch(() => undefined)
    }
  }, [])

  return { scenes: NOISE_SCENES, active, volume, playing, sleepMinutes, sleepRemaining, toggle, stop, setVolume, setSleep }
}
