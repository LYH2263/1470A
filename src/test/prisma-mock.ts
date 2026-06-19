import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

/**
 * 创建 Prisma Mock 客户端
 */
export function createMockPrismaClient() {
  return {
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;
}

/**
 * 重置所有 Prisma Mock
 */
export function resetPrismaMocks(prisma: ReturnType<typeof createMockPrismaClient>) {
  vi.clearAllMocks();
}
