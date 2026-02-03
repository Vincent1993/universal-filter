import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用 jsdom 环境以支持 React 测试
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    includeSource: ['src/**/*.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      include: [
        'src/core/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/context/**/*.{ts,tsx}',
        'src/plugins/**/*.ts',
        'src/adapters/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/types/**',
      ],
      // 设置覆盖率阈值（关键业务逻辑）
      // 暂时禁用阈值，先查看实际覆盖率
      // thresholds: {
      //   lines: 95,
      //   functions: 95,
      //   branches: 90,
      //   statements: 95,
      // },
    },
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
});
