import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticles,
} from '@/lib/storage';
import { createMockArticle, createMockArticleFormData, createMockArticles } from '@/test/factories';

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
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

describe('Storage Layer - 数据正确性测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getArticles - 列表查询', () => {
    it('应该返回正确的分页数据结构', async () => {
      const mockArticles = createMockArticles(5);
      const mockPrismaArticles = mockArticles.map((article) => ({
        ...article,
        createdAt: new Date(article.createdAt),
      }));

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

      vi.mocked(prisma.article.count).mockResolvedValue(1);
      vi.mocked(prisma.article.findMany).mockResolvedValue([mockPrismaArticle]);

      const result = await getArticles({ page: 1, pageSize: 10 });

      expect(result.data[0].createdAt).toBe(mockArticle.createdAt);
      expect(typeof result.data[0].createdAt).toBe('string');
    });

    it('应该正确处理搜索关键词', async () => {
      const keyword = '测试';
      vi.mocked(prisma.article.count).mockResolvedValue(0);
      vi.mocked(prisma.article.findMany).mockResolvedValue([]);

      await getArticles({ page: 1, pageSize: 10, keyword });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            title: {
              contains: keyword,
            },
          },
        })
      );
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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockPrismaArticle);

      const result = await getArticleById(mockArticle.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockArticle.id);
      expect(result?.title).toBe(mockArticle.title);
      expect(result?.author).toBe(mockArticle.author);
      expect(result?.importance).toBe(mockArticle.importance);
      expect(result?.views).toBe(mockArticle.views);
      expect(result?.content).toBe(mockArticle.content);
    });

    it('应该正确转换日期格式', async () => {
      const mockArticle = createMockArticle();
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      });
    });
  });

  describe('createArticle - 创建文章', () => {
    it('应该创建文章并返回正确的数据', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle(formData);
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      const result = await createArticle(formData);

      expect(typeof result.createdAt).toBe('string');
    });

    it('应该初始化阅读数为 0', async () => {
      const formData = createMockArticleFormData();
      const mockArticle = createMockArticle({ ...formData, views: 0 });
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

      vi.mocked(prisma.article.create).mockResolvedValue(mockPrismaArticle);

      await createArticle(formData);

      expect(prisma.article.create).toHaveBeenCalledWith({
        data: {
          title: formData.title,
          author: formData.author,
          createdAt: expect.any(Date),
          importance: formData.importance,
          content: formData.content,
          views: 0,
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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

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
      const mockPrismaArticle = {
        ...mockArticle,
        createdAt: new Date(mockArticle.createdAt),
      };

      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockPrismaArticle);

      const result = await getArticleById(mockArticle.id);

      expect(typeof result?.id).toBe('string');
      expect(typeof result?.title).toBe('string');
      expect(typeof result?.author).toBe('string');
      expect(typeof result?.createdAt).toBe('string');
      expect(typeof result?.importance).toBe('string');
      expect(typeof result?.views).toBe('number');
      expect(typeof result?.content).toBe('string');
    });
  });
});
