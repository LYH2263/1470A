import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 统一测试环境时区，避免本地时区导致的日期断言波动
process.env.TZ = 'UTC';

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    query: {},
    pathname: '/',
    asPath: '/',
    route: '/',
  }),
}));

// Mock Next.js dynamic
vi.mock('next/dynamic', () => ({
  default: (fn: any) => {
    const Component = fn();
    return Component;
  },
}));
