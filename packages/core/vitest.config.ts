import { defineConfig } from 'vitest/config'

// Windows 下 vitest 2.x 并发收集多个测试文件时会争用系统 Temp 的 SSR 缓存，
// 抛 EPERM 并导致只跑一个文件。限制为单线程顺序收集以消除竞态。
export default defineConfig({
  test: {
    include: ['tests/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
})
