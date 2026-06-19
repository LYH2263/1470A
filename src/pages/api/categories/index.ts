import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getCategories,
  createCategory,
  deleteCategories,
  getAllCategories,
} from '@/lib/category-storage';
import type { ApiResponse } from '@/types/article';
import type { CategoryListResponse, CategoryCreateInput } from '@/types/category';
import { CategorySchema } from '@/lib/validation';
import { z } from 'zod';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<CategoryListResponse | unknown>>
) {
  if (req.method === 'GET') {
    try {
      const all = req.query.all === 'true';

      if (all) {
        const categories = await getAllCategories();
        return res.status(200).json({
          success: true,
          data: categories,
        });
      }

      const query = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
        keyword: req.query.keyword as string | undefined,
      };

      const result = await getCategories(query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('获取分类列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取分类列表失败',
      });
    }
  } else if (req.method === 'POST') {
    try {
      const body = req.body;

      const validationResult = CategorySchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const category = await createCategory(validationResult.data as CategoryCreateInput);

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      console.error('创建分类失败:', error);
      if (error.message?.includes('已存在')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: '创建分类失败',
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供要删除的分类 ID',
        });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = ids.filter((id) => typeof id === 'string' && uuidRegex.test(id));

      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '无效的分类 ID 格式',
        });
      }

      const deletedCount = await deleteCategories(validIds);

      return res.status(200).json({
        success: true,
        data: { deletedCount },
      });
    } catch (error) {
      console.error('删除分类失败:', error);
      return res.status(500).json({
        success: false,
        error: '删除分类失败',
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }
}

export default withAuth(handler);
