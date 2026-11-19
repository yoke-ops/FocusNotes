import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../apps/mobile/android/', import.meta.url))
const windows = process.platform === 'win32'
const executable = windows ? process.env.ComSpec || 'cmd.exe' : 'bash'
const wrapper = windows ? ['/d', '/c', 'gradlew.bat'] : ['./gradlew']
const result = spawnSync(executable, [...wrapper, ':app:assembleQa', '--no-daemon'], {
  cwd,
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
}
process.exitCode = result.status ?? 1
