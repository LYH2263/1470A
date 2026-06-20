import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 统一测试环境时区，避免本地时区导致的日期断言波动
process.env.TZ = 'UTC';
process.env.JWT_SECRET = 'test-secret-key-for-ci-min-32-chars-long';

// 绕过 API 认证中间件，便于接口单测聚焦业务逻辑
vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: (req: unknown, res: unknown) => unknown) => {
    return async (req: { user?: { userId: string; username: string; role: string } }, res: unknown) => {
      req.user = { userId: 'test-user-id', username: 'admin', role: 'admin' };
      return handler(req, res);
    };
  },
  withAdmin: (handler: (req: unknown, res: unknown) => unknown) => {
    return async (req: { user?: { userId: string; username: string; role: string } }, res: unknown) => {
      req.user = { userId: 'test-user-id', username: 'admin', role: 'admin' };
      return handler(req, res);
    };
  },
  withMaintenanceCheck: (handler: (req: unknown, res: unknown) => unknown) => handler,
  checkMaintenanceMode: vi.fn().mockResolvedValue(false),
}));

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
