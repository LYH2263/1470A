import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticles,
  getLockStatus,
  acquireLock,
  renewLock,
  releaseLock,
  stealLock,
  updateArticleWithOptimisticLock,
  cleanExpiredLocks,
} from '@/lib/storage';
import {
  createMockArticle,
  createMockArticleFormData,
  createMockArticles,
  createMockArticleEditLock,
  createMockUser,
} from '@/test/factories';
import type { ArticleEditLock, LockOwner } from '@/types/article';

vi.mock('@/lib/search', () => ({
  searchArticles: vi.fn(),
  getSearchSuggestions: vi.fn(),
  rebuildFtsIndex: vi.fn(),
  stripHtml: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  tokenizeChinese: vi.fn((text: string) => text),
}));

import { searchArticles } from '@/lib/search';

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    articleEditLock: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

function toPrismaArticle(article: ReturnType<typeof createMockArticle>) {
  return {
    ...article,
    contentPlainText: article.contentPlainText || '',
    createdAt: new Date(article.createdAt),
    updatedAt: new Date(article.updatedAt),
  };
}

describe('Storage Layer - 数据正确性测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getArticles - 列表查询', () => {
    it('应该返回正确的分页数据结构', async () => {
      const mockArticles = createMockArticles(5);
      const mockPrismaArticles = mockArticles.map(toPrismaArticle);

      vi.mocked(prisma.article.count).mockResolvedValue(50);
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockPrismaArticles);

      const result = await getArticles({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.data).toHaveLength(5);
    });

    it('应该正确转换日期格式', async () => {
      const mockArticle = createMockArticle();
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.count).mockResolvedValue(1);
      vi.mocked(prisma.article.findMany).mockResolvedValue([mockPrismaArticle]);

      const result = await getArticles({ page: 1, pageSize: 10 });

      expect(result.data[0].createdAt).toBe(mockArticle.createdAt);
      expect(typeof result.data[0].createdAt).toBe('string');
    });

    it('应该正确处理搜索关键词（使用FTS5）', async () => {
      const keyword = '测试';
      const mockFtsResult = {
        id: 'test-id',
        title: '测试文章',
        author: '测试作者',
        createdAt: new Date().toISOString(),
        importance: 'medium',
        views: 0,
        content: '<p>测试内容</p>',
        contentPlainText: '测试内容',
        status: 'published',
        updatedAt: new Date().toISOString(),
        rank: -1,
        highlightTitle: '<mark>测试</mark>文章',
        highlightAuthor: null,
        snippet: '<mark>测试</mark>内容',
      };

      vi.mocked(searchArticles).mockResolvedValue({
        data: [mockFtsResult],
        total: 1,
      });

      const result = await getArticles({ page: 1, pageSize: 10, keyword });

      expect(searchArticles).toHaveBeenCalledWith(keyword, 1, 10, undefined, 'published');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].highlight).toBeDefined();
      expect(result.data[0].highlight?.title).toBe('<mark>测试</mark>文章');
      expect(result.data[0].highlight?.snippet).toBe('<mark>测试</mark>内容');
    });

    it('应该正确计算分页偏移量', async () => {
      vi.mocked(prisma.article.count).mockResolvedValue(0);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      await getArticles({ page: 3, pageSize: 20 });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3 - 1) * 20
          take: 20,
        })
      );
    });

    it('应该按创建时间倒序排列', async () => {
      vi.mocked(prisma.article.count).mockResolvedValue(0);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      await getArticles({ page: 1, pageSize: 10 });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('应该并行执行 count 和 findMany', async () => {
      const countPromise = Promise.resolve(10);
      const findManyPromise = Promise.resolve([]);

      vi.mocked(prisma.article.count).mockReturnValue(countPromise as any);
      vi.mocked(prisma.article.findMany).mockReturnValue(findManyPromise as any);

      await getArticles({ page: 1, pageSize: 10 });

      // 验证两个方法都被调用
      expect(prisma.article.count).toHaveBeenCalled();
      expect(prisma.article.findMany).toHaveBeenCalled();
    });

    it('应该处理空结果', async () => {
      vi.mocked(prisma.article.count).mockResolvedValue(0);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      const result = await getArticles({ page: 1, pageSize: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getArticleById - 单条查询', () => {
    it('应该返回正确的文章数据', async () => {
      const mockArticle = createMockArticle();
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockPrismaArticle);

      const result = await getArticleById(mockArticle.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockArticle.id);
      expect(result?.title).toBe(mockArticle.title);
      expect(result?.author).toBe(mockArticle.author);
      expect(result?.importance).toBe(mockArticle.importance);
      expect(result?.views).toBe(mockArticle.views);
      expect(result?.content).toBe(mockArticle.content);
      expect(result?.updatedAt).toBe(mockArticle.updatedAt);
    });

    it('应该正确转换日期格式', async () => {
      const mockArticle = createMockArticle();
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockPrismaArticle);

      const result = await getArticleById(mockArticle.id);

      expect(result?.createdAt).toBe(mockArticle.createdAt);
      expect(typeof result?.createdAt).toBe('string');
    });

    it('应该在文章不存在时返回 null', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      const result = await getArticleById('non-existent-id');

      expect(result).toBeNull();
    });

    it('应该使用正确的查询条件', async () => {
      const id = 'test-id';
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      await getArticleById(id);

      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  });

  describe('createArticle - 创建文章', () => {
    it('应该创建文章并返回正确的数据', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle(formData);
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      const result = await createArticle(formData);

      expect(result.title).toBe(formData.title);
      expect(result.author).toBe(formData.author);
      expect(result.importance).toBe(formData.importance);
      expect(result.content).toBe(formData.content);
      expect(result.views).toBe(0);
    });

    it('应该正确转换日期格式', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle(formData);
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      const result = await createArticle(formData);

      expect(typeof result.createdAt).toBe('string');
    });

    it('应该初始化阅读数为 0', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle({ ...formData, views: 0 });
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      await createArticle(formData);

      expect(prisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            views: 0,
          }),
        })
      );
    });

    it('应该正确传递所有字段', async () => {
      const formData = createMockArticleFormData({
        title: '测试标题',
        author: '测试作者',
        importance: 'high',
        content: '<p>测试内容</p>',
      });

      const mockArticle = createMockArticle(formData);
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      await createArticle(formData);

      expect(prisma.article.create).toHaveBeenCalledWith({
        data: {
          title: formData.title,
          author: formData.author,
          createdAt: expect.any(Date),
          importance: formData.importance,
          content: formData.content,
          contentPlainText: expect.any(String),
          status: formData.status,
          views: 0,
          categoryId: formData.categoryId || null,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  });

  describe('updateArticle - 更新文章', () => {
    it('应该更新文章并返回正确的数据', async () => {
      const id = 'test-id';
      const formData = createMockArticleFormData({
        title: '更新后的标题',
      });
      const mockArticle = createMockArticle({ id, ...formData });
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.update).mockResolvedValue(mockPrismaArticle);

      const result = await updateArticle(id, formData);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(id);
      expect(result?.title).toBe(formData.title);
    });

    it('应该在文章不存在时返回 null', async () => {
      const id = 'non-existent-id';
      const formData = createMockArticleFormData();

      const error = new Error('Record not found');
      (error as any).code = 'P2025';
      vi.mocked(prisma.article.update).mockRejectedValue(error);

      const result = await updateArticle(id, formData);

      expect(result).toBeNull();
    });

    it('应该在其他错误时抛出异常', async () => {
      const id = 'test-id';
      const formData = createMockArticleFormData();

      const error = new Error('Database error');
      vi.mocked(prisma.article.update).mockRejectedValue(error);

      await expect(updateArticle(id, formData)).rejects.toThrow('Database error');
    });

    it('应该正确传递更新数据', async () => {
      const id = 'test-id';
      const formData = createMockArticleFormData({
        title: '新标题',
        author: '新作者',
        importance: 'high',
        content: '<p>新内容</p>',
      });

      const mockArticle = createMockArticle({ id, ...formData });
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.update).mockResolvedValue(mockPrismaArticle);

      await updateArticle(id, formData);

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          title: formData.title,
          author: formData.author,
          createdAt: expect.any(Date),
          importance: formData.importance,
          content: formData.content,
          contentPlainText: expect.any(String),
          status: formData.status,
          categoryId: formData.categoryId || null,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  });

  describe('deleteArticles - 删除文章', () => {
    it('应该删除单个文章并返回删除数量', async () => {
      const ids = ['id-1'];
      vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 1 });

      const result = await deleteArticles(ids);

      expect(result).toBe(1);
    });

    it('应该批量删除多个文章', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 3 });

      const result = await deleteArticles(ids);

      expect(result).toBe(3);
      expect(prisma.article.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids,
          },
        },
      });
    });

    it('应该处理部分删除的情况', async () => {
      const ids = ['id-1', 'id-2', 'non-existent-id'];
      vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 2 });

      const result = await deleteArticles(ids);

      expect(result).toBe(2);
    });

    it('应该处理空数组', async () => {
      const ids: string[] = [];
      vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteArticles(ids);

      expect(result).toBe(0);
    });

    it('应该处理全部不存在的情况', async () => {
      const ids = ['non-existent-1', 'non-existent-2'];
      vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 0 });

      const result = await deleteArticles(ids);

      expect(result).toBe(0);
    });
  });

  describe('数据完整性验证', () => {
    it('创建的文章应该包含所有必需字段', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle(formData);
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      const result = await createArticle(formData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('importance');
      expect(result).toHaveProperty('views');
      expect(result).toHaveProperty('content');
    });

    it('查询的文章应该保持数据类型正确', async () => {
      const mockArticle = createMockArticle();
      const mockPrismaArticle = toPrismaArticle(mockArticle);

      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockPrismaArticle);

      const result = await getArticleById(mockArticle.id);

      expect(typeof result?.id).toBe('string');
      expect(typeof result?.title).toBe('string');
      expect(typeof result?.author).toBe('string');
      expect(typeof result?.createdAt).toBe('string');
      expect(typeof result?.importance).toBe('string');
      expect(typeof result?.views).toBe('number');
      expect(typeof result?.content).toBe('string');
      expect(typeof result?.updatedAt).toBe('string');
    });
  });

  describe('getLockStatus - 获取锁状态', () => {
    it('应该在没有锁时返回未锁定状态', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(null);

      const result = await getLockStatus(articleId, userId);

      expect(result.isLocked).toBe(false);
      expect(result.isLockedByMe).toBe(false);
      expect(result.lock).toBeUndefined();
    });

    it('应该在有有效锁且是自己时返回正确状态', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const mockUser = createMockUser({ id: userId });
      const mockLock = createMockArticleEditLock({
        articleId,
        userId,
        user: mockUser,
      });
      const mockPrismaLock = {
        ...mockLock,
        expiresAt: new Date(mockLock.expiresAt),
        lastHeartbeat: new Date(mockLock.lastHeartbeat),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(mockPrismaLock as any);

      const result = await getLockStatus(articleId, userId);

      expect(result.isLocked).toBe(true);
      expect(result.isLockedByMe).toBe(true);
      expect(result.lock).toBeDefined();
      expect(result.lock?.user.id).toBe(userId);
    });

    it('应该在有有效锁且是他人时返回正确状态', async () => {
      const articleId = 'test-article-id';
      const currentUserId = 'current-user-id';
      const otherUserId = 'other-user-id';
      const mockUser = createMockUser({ id: otherUserId });
      const mockLock = createMockArticleEditLock({
        articleId,
        userId: otherUserId,
        user: mockUser,
      });
      const mockPrismaLock = {
        ...mockLock,
        expiresAt: new Date(mockLock.expiresAt),
        lastHeartbeat: new Date(mockLock.lastHeartbeat),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      };

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(mockPrismaLock as any);

      const result = await getLockStatus(articleId, currentUserId);

      expect(result.isLocked).toBe(true);
      expect(result.isLockedByMe).toBe(false);
      expect(result.lock?.user.id).toBe(otherUserId);
    });

    it('应该自动清理过期锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const expiredDate = new Date(Date.now() - 60000);
      const mockUser = createMockUser({ id: userId });
      const mockPrismaLock = {
        id: 'lock-id',
        articleId,
        userId,
        sessionId: 'session-id',
        expiresAt: expiredDate,
        lastHeartbeat: expiredDate,
        createdAt: expiredDate,
        updatedAt: expiredDate,
        user: mockUser,
      };

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(mockPrismaLock as any);
      vi.mocked(prisma.articleEditLock.delete).mockResolvedValue({} as any);

      const result = await getLockStatus(articleId, userId);

      expect(result.isLocked).toBe(false);
      expect(prisma.articleEditLock.delete).toHaveBeenCalled();
    });
  });

  describe('acquireLock - 申请锁', () => {
    it('应该在没有锁时成功申请', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';
      const mockArticle = createMockArticle({ id: articleId });
      const mockUser = createMockUser({ id: userId });
      const mockLock = createMockArticleEditLock({
        articleId,
        userId,
        sessionId,
        user: mockUser,
      });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          articleEditLock: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              ...mockLock,
              expiresAt: new Date(mockLock.expiresAt),
              lastHeartbeat: new Date(mockLock.lastHeartbeat),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: mockUser,
            }),
          },
          article: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockArticle,
              createdAt: new Date(mockArticle.createdAt),
              updatedAt: new Date(mockArticle.updatedAt),
            }),
          },
        };
        return fn(tx);
      });

      const result = await acquireLock(articleId, userId, sessionId);

      expect(result.acquired).toBe(true);
      expect(result.lock).toBeDefined();
      expect(result.lock?.articleId).toBe(articleId);
    });

    it('应该在锁已被其他用户占用时拒绝申请', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';
      const otherUserId = 'other-user-id';
      const mockUser = createMockUser({ id: otherUserId });
      const existingLock = createMockArticleEditLock({
        articleId,
        userId: otherUserId,
        user: mockUser,
      });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          articleEditLock: {
            findUnique: vi.fn().mockResolvedValue({
              ...existingLock,
              expiresAt: new Date(existingLock.expiresAt),
              lastHeartbeat: new Date(existingLock.lastHeartbeat),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: mockUser,
            }),
          },
        };
        return fn(tx);
      });

      const result = await acquireLock(articleId, userId, sessionId);

      expect(result.acquired).toBe(false);
      expect(result.error).toBe('文章已被其他用户占用');
      expect(result.lock?.user.id).toBe(otherUserId);
    });

    it('应该在自己已有锁时更新锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';
      const mockUser = createMockUser({ id: userId });
      const existingLock = createMockArticleEditLock({
        articleId,
        userId,
        sessionId,
        user: mockUser,
      });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          articleEditLock: {
            findUnique: vi.fn().mockResolvedValue({
              ...existingLock,
              expiresAt: new Date(existingLock.expiresAt),
              lastHeartbeat: new Date(existingLock.lastHeartbeat),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: mockUser,
            }),
            update: vi.fn().mockResolvedValue({
              ...existingLock,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
              lastHeartbeat: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: mockUser,
            }),
          },
        };
        return fn(tx);
      });

      const result = await acquireLock(articleId, userId, sessionId);

      expect(result.acquired).toBe(true);
    });

    it('应该在文章不存在时返回错误', async () => {
      const articleId = 'non-existent-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          articleEditLock: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
          article: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await acquireLock(articleId, userId, sessionId);

      expect(result.acquired).toBe(false);
      expect(result.error).toBe('文章不存在');
    });
  });

  describe('renewLock - 心跳续约', () => {
    it('应该成功续约锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';
      const mockLock = createMockArticleEditLock({
        articleId,
        userId,
        sessionId,
      });

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue({
        ...mockLock,
        expiresAt: new Date(mockLock.expiresAt),
        lastHeartbeat: new Date(mockLock.lastHeartbeat),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(prisma.articleEditLock.update).mockResolvedValue({} as any);

      const result = await renewLock(articleId, userId, sessionId);

      expect(result.renewed).toBe(true);
      expect(result.expiresAt).toBeDefined();
    });

    it('应该在锁不存在时返回错误', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(null);

      const result = await renewLock(articleId, userId, sessionId);

      expect(result.renewed).toBe(false);
      expect(result.error).toBe('锁不存在');
    });

    it('应该在锁已过期时返回错误', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';
      const expiredDate = new Date(Date.now() - 60000);

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue({
        id: 'lock-id',
        articleId,
        userId,
        sessionId,
        expiresAt: expiredDate,
        lastHeartbeat: expiredDate,
      } as any);
      vi.mocked(prisma.articleEditLock.delete).mockResolvedValue({} as any);

      const result = await renewLock(articleId, userId, sessionId);

      expect(result.renewed).toBe(false);
      expect(result.error).toBe('锁已过期');
    });

    it('应该在用户不匹配时拒绝续约', async () => {
      const articleId = 'test-article-id';
      const currentUserId = 'current-user-id';
      const lockUserId = 'lock-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue({
        id: 'lock-id',
        articleId,
        userId: lockUserId,
        sessionId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        lastHeartbeat: new Date(),
      } as any);

      const result = await renewLock(articleId, currentUserId, sessionId);

      expect(result.renewed).toBe(false);
      expect(result.error).toBe('无权限续约此锁');
    });
  });

  describe('releaseLock - 释放锁', () => {
    it('应该成功释放锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue({
        id: 'lock-id',
        articleId,
        userId,
        sessionId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        lastHeartbeat: new Date(),
      } as any);
      vi.mocked(prisma.articleEditLock.delete).mockResolvedValue({} as any);

      const result = await releaseLock(articleId, userId, sessionId);

      expect(result.released).toBe(true);
    });

    it('应该在锁不存在时返回成功', async () => {
      const articleId = 'test-article-id';
      const userId = 'test-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue(null);

      const result = await releaseLock(articleId, userId, sessionId);

      expect(result.released).toBe(true);
    });

    it('应该在用户不匹配时拒绝释放', async () => {
      const articleId = 'test-article-id';
      const currentUserId = 'current-user-id';
      const lockUserId = 'lock-user-id';
      const sessionId = 'session-id';

      vi.mocked(prisma.articleEditLock.findUnique).mockResolvedValue({
        id: 'lock-id',
        articleId,
        userId: lockUserId,
        sessionId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        lastHeartbeat: new Date(),
      } as any);

      const result = await releaseLock(articleId, currentUserId, sessionId);

      expect(result.released).toBe(false);
      expect(result.error).toBe('无权限释放此锁');
    });
  });

  describe('stealLock - 强制夺锁', () => {
    it('应该在管理员时成功夺锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'admin-user-id';
      const sessionId = 'session-id';
      const isAdmin = true;
      const mockUser = createMockUser({ id: userId, role: 'admin' });
      const mockLock = createMockArticleEditLock({
        articleId,
        userId,
        user: mockUser,
      });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          articleEditLock: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'existing-lock-id',
              articleId,
              userId: 'other-user-id',
              sessionId: 'other-session-id',
            }),
            delete: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({
              ...mockLock,
              expiresAt: new Date(mockLock.expiresAt),
              lastHeartbeat: new Date(mockLock.lastHeartbeat),
              createdAt: new Date(),
              updatedAt: new Date(),
              user: mockUser,
            }),
          },
        };
        return fn(tx);
      });

      const result = await stealLock(articleId, userId, sessionId, isAdmin);

      expect(result.stolen).toBe(true);
      expect(result.lock).toBeDefined();
    });

    it('应该在非管理员时拒绝夺锁', async () => {
      const articleId = 'test-article-id';
      const userId = 'regular-user-id';
      const sessionId = 'session-id';
      const isAdmin = false;

      const result = await stealLock(articleId, userId, sessionId, isAdmin);

      expect(result.stolen).toBe(false);
      expect(result.error).toBe('只有管理员可以强制夺锁');
    });
  });

  describe('updateArticleWithOptimisticLock - 带乐观锁更新', () => {
    it('应该在版本匹配时成功更新', async () => {
      const id = 'test-article-id';
      const now = new Date();
      const formData = createMockArticleFormData({ title: '更新后的标题' });
      const mockArticle = createMockArticle({ id, ...formData });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          article: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockArticle,
              createdAt: new Date(mockArticle.createdAt),
              updatedAt: now,
            }),
            update: vi.fn().mockResolvedValue({
              ...mockArticle,
              createdAt: new Date(mockArticle.createdAt),
              updatedAt: new Date(),
            }),
          },
        };
        return fn(tx);
      });

      const result = await updateArticleWithOptimisticLock(id, {
        ...formData,
        lastUpdatedAt: now.toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.article).toBeDefined();
      expect(result.conflict).toBeUndefined();
    });

    it('应该在版本不匹配时返回冲突', async () => {
      const id = 'test-article-id';
      const dbUpdatedAt = new Date();
      const clientUpdatedAt = new Date(dbUpdatedAt.getTime() - 5000);
      const formData = createMockArticleFormData({ title: '更新后的标题' });
      const mockArticle = createMockArticle({ id, ...formData });

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          article: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockArticle,
              createdAt: new Date(mockArticle.createdAt),
              updatedAt: dbUpdatedAt,
            }),
          },
        };
        return fn(tx);
      });

      const result = await updateArticleWithOptimisticLock(id, {
        ...formData,
        lastUpdatedAt: clientUpdatedAt.toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.error).toBe('文章已被其他用户修改，请刷新后重试');
      expect(result.currentArticle).toBeDefined();
    });

    it('应该在文章不存在时返回错误', async () => {
      const id = 'non-existent-id';
      const formData = createMockArticleFormData();

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          article: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await updateArticleWithOptimisticLock(id, {
        ...formData,
        lastUpdatedAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('文章不存在');
    });
  });

  describe('cleanExpiredLocks - 清理过期锁', () => {
    it('应该删除所有过期锁', async () => {
      vi.mocked(prisma.articleEditLock.deleteMany).mockResolvedValue({ count: 3 });

      const result = await cleanExpiredLocks();

      expect(result).toBe(3);
      expect(prisma.articleEditLock.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expiresAt: {
              lt: expect.any(Date),
            },
          },
        })
      );
    });
  });
});
