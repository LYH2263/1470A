import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/articles/index';
import { createMockArticle, createMockArticles } from '@/test/factories';
import type { ApiResponse } from '@/types/article';

// Mock storage functions
vi.mock('@/lib/storage', () => ({
  getArticles: vi.fn(),
  createArticle: vi.fn(),
  deleteArticles: vi.fn(),
}));

import { getArticles, createArticle, deleteArticles } from '@/lib/storage';

describe('API /api/articles - 完整测试套件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET - 获取文章列表', () => {
    it('应该返回文章列表和分页信息', async () => {
      const mockArticles = createMockArticles(5);
      const mockResult = {
        data: mockArticles,
        total: 5,
        page: 1,
        pageSize: 10,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { page: '1', pageSize: '10' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toHaveProperty('data');
      expect(jsonData.data).toHaveProperty('total');
      expect(jsonData.data).toHaveProperty('page');
      expect(jsonData.data).toHaveProperty('pageSize');
      expect(Array.isArray(jsonData.data.data)).toBe(true);
    });

    it('应该正确处理分页参数', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 2,
        pageSize: 20,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { page: '2', pageSize: '20' },
      });

      await handler(req, res);

      expect(getArticles).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        keyword: undefined,
      });
    });

    it('应该正确处理搜索关键词', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { keyword: 'test' },
      });

      await handler(req, res);

      expect(getArticles).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        keyword: 'test',
      });
    });

    it('应该使用默认分页参数', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: {},
      });

      await handler(req, res);

      expect(getArticles).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        keyword: undefined,
      });
    });

    it('应该限制最大页面大小', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 100,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { pageSize: '1000' },
      });

      await handler(req, res);

      // 应该被限制为最大值 100
      expect(getArticles).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100,
        keyword: undefined,
      });
    });

    it('应该处理无效的分页参数', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      vi.mocked(getArticles).mockResolvedValue(mockResult);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: { page: 'invalid', pageSize: 'invalid' },
      });

      await handler(req, res);

      // 应该使用默认值
      expect(getArticles).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        keyword: undefined,
      });
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(getArticles).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'GET',
        query: {},
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBeDefined();
    });
  });

  describe('POST - 创建文章', () => {
    it('应该成功创建文章', async () => {
      const mockArticle = createMockArticle();
      vi.mocked(createArticle).mockResolvedValue(mockArticle);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'POST',
        body: {
          title: '测试标题',
          author: '测试作者',
          createdAt: new Date().toISOString(),
          importance: 'medium',
          content: '测试内容',
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
        method: 'POST',
        body: {
          title: '测试标题',
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
        method: 'POST',
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
        method: 'POST',
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

    it('应该拒绝无效的重要性级别', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'POST',
        body: {
          title: '测试标题',
          author: '测试作者',
          createdAt: new Date().toISOString(),
          importance: 'invalid',
          content: '测试内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(createArticle).mockRejectedValue(new Error('Database error'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'POST',
        body: {
          title: '测试标题',
          author: '测试作者',
          createdAt: new Date().toISOString(),
          importance: 'medium',
          content: '测试内容',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });
  });

  describe('DELETE - 批量删除文章', () => {
    it('应该成功删除单个文章', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(1);

      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: [validId] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toEqual({ deletedCount: 1 });
      expect(deleteArticles).toHaveBeenCalledWith([validId]);
    });

    it('应该成功批量删除多个文章', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(3);

      const validIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
      ];
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: validIds },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      expect(jsonData.data).toEqual({ deletedCount: 3 });
      expect(deleteArticles).toHaveBeenCalledWith(validIds);
    });

    it('应该验证 ID 格式（UUID）', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: ['invalid-id', 'not-a-uuid'] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('无效的文章 ID 格式');
    });

    it('应该过滤掉无效的 ID 并只删除有效的', async () => {
      vi.mocked(deleteArticles).mockResolvedValue(1);

      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: [validId, 'invalid-id'] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(true);
      // 应该只删除有效的 ID
      expect(deleteArticles).toHaveBeenCalledWith([validId]);
    });

    it('应该拒绝空数组', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: [] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('请提供要删除的文章 ID');
    });

    it('应该拒绝缺少 ids 字段', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: {},
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该处理数据库错误', async () => {
      vi.mocked(deleteArticles).mockRejectedValue(new Error('Database error'));

      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'DELETE',
        body: { ids: [validId] },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });
  });

  describe('不支持的 HTTP 方法', () => {
    it('应该拒绝 PUT 请求', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'PUT',
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
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const jsonData = JSON.parse(res._getData());
      expect(jsonData.success).toBe(false);
    });

    it('应该拒绝 HEAD 请求', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse<ApiResponse>>({
        method: 'HEAD',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
    });
  });
});
