import type { NextApiResponse } from 'next';
import { getArticleById, updateArticle, deleteArticles } from '@/lib/storage';
import { ArticleSchema } from '@/lib/validation';
import type { ApiResponse } from '@/types/article';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: '无效的文章 ID',
    });
  }

  // 验证 ID 格式（UUID）
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: '无效的文章 ID 格式',
    });
  }

  if (req.method === 'GET') {
    // 获取文章详情
    try {
      const article = await getArticleById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          error: '文章不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: article,
      });
    } catch (error) {
      console.error('获取文章详情失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取文章详情失败',
      });
    }
  } else if (req.method === 'PUT') {
    // 更新文章
    try {
      const body = req.body;

      // 数据验证
      const validationResult = ArticleSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const article = await updateArticle(id, validationResult.data);

      if (!article) {
        return res.status(404).json({
          success: false,
          error: '文章不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: article,
      });
    } catch (error) {
      console.error('更新文章失败:', error);
      return res.status(500).json({
        success: false,
        error: '更新文章失败',
      });
    }
  } else if (req.method === 'DELETE') {
    // 删除文章
    try {
      const deletedCount = await deleteArticles([id]);

      return res.status(200).json({
        success: true,
        data: { deletedCount },
      });
    } catch (error) {
      console.error('删除文章失败:', error);
      return res.status(500).json({
        success: false,
        error: '删除文章失败',
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
