const { app, nativeImage } = require('electron')
const { execFile } = require('node:child_process')
const { readFile, stat } = require('node:fs/promises')
const path = require('node:path')

let cached

async function loadWallpaper() {
  const script = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; (Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop' -Name WallPaper -ErrorAction SilentlyContinue).WallPaper"
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const configuredPath = await new Promise((resolve) => {
    execFile(exe, ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 2500 }, (error, stdout) => resolve(error ? '' : stdout.trim()))
  })
  const candidates = [configuredPath, path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper')]
  for (const file of candidates) {
    if (!/^[A-Za-z]:[\\/]/.test(file)) continue
    try {
      const info = await stat(file)
      if (!info.isFile() || info.size > 32 * 1024 * 1024) continue
      const image = nativeImage.createFromBuffer(await readFile(file))
      if (image.isEmpty()) continue
      const { width, height } = image.getSize()
      const scale = Math.min(1, 1600 / Math.max(width, height))
      const resized = image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) })
      return 'data:image/jpeg;base64,' + resized.toJPEG(80).toString('base64')
    } catch { /* Solid colors and inaccessible wallpapers use the renderer fallback. */ }
  }
  return null
}

function glassWallpaper() {
  if (process.platform !== 'win32') return null
  if (!cached || Date.now() >= cached.expires) {
    cached = { expires: Date.now() + 30_000, value: loadWallpaper().catch(() => null) }
  }
  return cached.value
}

module.exports = { glassWallpaper }
