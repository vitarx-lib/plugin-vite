import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // 代码覆盖率配置
    coverage: {
      // 使用V8内置的覆盖率收集器
      provider: 'v8',
      // 指定覆盖率报告的输出格式：文本格式、JSON格式和HTML格式
      reporter: ['text', 'json', 'html'],
      // 指定在收集覆盖率时需要排除的文件
      // 这里排除了node_modules、dist和测试文件本身
      exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/**', '**/tests/**']
    },
    // 设置单个测试用例的超时时间为10秒
    // 如果测试执行时间超过这个值，测试将被标记为失败
    testTimeout: 10000,
    // 添加 globals 配置以支持全局测试函数
    globals: true
  }
})
