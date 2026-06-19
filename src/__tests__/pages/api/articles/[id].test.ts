import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/articles/[id]';
import { createMockArticle } from '@/test/factories';
import type { ApiResponse } from '@/types/article';

// Mock storage functions
vi.mock('@/lib/storage', () => ({
  getArticleById: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticles: vi.fn(),
}));

import { getArticleById, updateArticle, deleteArticles } from '@/lib/storage';

describe('API /api/articles/[id] - 完整测试套件', () => {
  const validId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ID 验证', () => {
    it('应该拒绝无效的 ID 类型', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: ['array', 'of', 'ids'] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('无效的文章 ID');
    });

    it('应该拒绝无效的 UUID 格式', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: 'invalid-uuid' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('无效的文章 ID 格式');
    });

    it('应该接受有效的 UUID', async () => {
      const mockArticle = createMockArticle({ id: validId });
      vi.mocked(getArticleById).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('GET - 获取单个文章', () => {
    it('应该返回文章详情', async () => {
      const mockArticle = createMockArticle({ id: validId });
      vi.mocked(getArticleById).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toBeDefined();
      expect(jsonData.data.id).toBe(validId);
    });

    it('应该返回 404 当文章不存在', async () => {
      vi.mocked(getArticleById).mockResolvedValue(null);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('文章不存在');
    });

    it('应该调用正确的存储函数', async () => {
      const mockArticle = createMockArticle({ id: validId });
      vi.mocked(getArticleById).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: validId },
      });

      await handler(req, res);

      expect(getArticleById).toHaveBeenCalledWith(validId);
      expect(getArticleById).toHaveBeenCalledTimes(1);
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(getArticleById).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBeDefined();
    });
  });

  describe('PUT - 更新文章', () => {
    it('应该成功更新文章', async () => {
      const mockArticle = createMockArticle({ id: validId });
      vi.mocked(updateArticle).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '更新后的标题',
          author: '更新后的作者',
          createdAt: new Date().toISOString(),
          importance: 'high',
          content: '更新后的内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toBeDefined();
    });

    it('应该验证必填字段', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '更新后的标题',
          // 缺少其他必填字段
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBeDefined();
    });

    it('应该拒绝空标题', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '',
          author: '测试作者',
          createdAt: new Date().toISOString(),
          importance: 'medium',
          content: '测试内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该拒绝只包含空格的标题', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '   ',
          author: '测试作者',
          createdAt: new Date().toISOString(),
          importance: 'medium',
          content: '测试内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该返回 404 当文章不存在', async () => {
      vi.mocked(updateArticle).mockResolvedValue(null);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '更新后的标题',
          author: '更新后的作者',
          createdAt: new Date().toISOString(),
          importance: 'high',
          content: '更新后的内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('文章不存在');
    });

    it('应该调用正确的存储函数', async () => {
      const mockArticle = createMockArticle({ id: validId });
      vi.mocked(updateArticle).mockResolvedValue(mockArticle);

      const updateData = {
        title: '更新后的标题',
        author: '更新后的作者',
        createdAt: new Date().toISOString(),
        importance: 'high' as const,
        content: '更新后的内容',
      };

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: updateData,
      });

      await handler(req, res);

      expect(updateArticle).toHaveBeenCalledWith(validId, updateData);
      expect(updateArticle).toHaveBeenCalledTimes(1);
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(updateArticle).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: {
          title: '更新后的标题',
          author: '更新后的作者',
          createdAt: new Date().toISOString(),
          importance: 'high',
          content: '更新后的内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBeDefined();
    });
  });

  describe('DELETE - 删除文章', () => {
    it('应该成功删除文章', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(1);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toEqual({ deletedCount: 1 });
    });

    it('应该调用正确的存储函数', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(1);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        query: { id: validId },
      });

      await handler(req, res);

      expect(deleteArticles).toHaveBeenCalledWith([validId]);
      expect(deleteArticles).toHaveBeenCalledTimes(1);
    });

    it('应该处理文章不存在的情况', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(0);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toEqual({ deletedCount: 0 });
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(deleteArticles).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBeDefined();
    });
  });

  describe('不支持的 HTTP 方法', () => {
    it('应该拒绝 POST 请求', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'POST',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('Method Not Allowed');
    });

    it('应该拒绝 PATCH 请求', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PATCH',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该拒绝 HEAD 请求', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'HEAD',
        query: { id: validId },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
    });
  });

  describe('数据一致性验证', () => {
    it('更新后的数据应该与输入一致', async () => {
      const updateData = {
        title: '更新后的标题',
        author: '更新后的作者',
        createdAt: '2024-01-15T10:30:00.000Z',
        importance: 'high' as const,
        content: '更新后的内容',
      };

      const mockArticle = createMockArticle({
        id: validId,
        ...updateData,
      });

      vi.mocked(updateArticle).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
        query: { id: validId },
        body: updateData,
      });

      await handler(req, res);

      const jsonData = JSON.parse(res._getData());
      expect(jsonData.data.title).toBe(updateData.title);
      expect(jsonData.data.author).toBe(updateData.author);
      expect(jsonData.data.importance).toBe(updateData.importance);
      expect(jsonData.data.content).toBe(updateData.content);
    });
  });
});
