/**
 * 全局测试配置
 *
 * 在所有测试运行前执行
 */
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 全局自动清理 - 每个测试后自动清理 DOM
afterEach(() => {
  cleanup();
});

