import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '@/lib/category-storage';
import type { ApiResponse } from '@/types/article';
import type { Category, CategoryUpdateInput } from '@/types/category';
import { CategoryUpdateSchema } from '@/lib/validation';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<Category | unknown>>
) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: '无效的分类 ID',
    });
  }

  if (req.method === 'GET') {
    try {
      const category = await getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: '分类不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error('获取分类失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取分类失败',
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const body = req.body;

      const validationResult = CategoryUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const category = await updateCategory(id, validationResult.data as CategoryUpdateInput);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: '分类不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      console.error('更新分类失败:', error);
      if (error.message?.includes('已存在')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: '更新分类失败',
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const success = await deleteCategory(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '分类不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: { deletedCount: 1 },
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
