import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getSensitiveWordById,
  updateSensitiveWord,
  deleteSensitiveWord,
} from '@/lib/sensitive-word-storage';
import type { ApiResponse } from '@/types/article';
import type {
  SensitiveWord,
  SensitiveWordUpdateInput,
} from '@/types/sensitive-word';
import { z } from 'zod';

const SensitiveWordUpdateSchema = z.object({
  word: z.string().trim().min(1, '敏感词不能为空').max(100, '敏感词不能超过100个字符').optional(),
  category: z.enum(['politics', 'violence', 'pornography', 'advertisement', 'other']).optional(),
  level: z.enum(['high', 'medium', 'low']).optional(),
  strategy: z.enum(['block', 'replace', 'warn']).optional(),
  enabled: z.boolean().optional(),
});

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<SensitiveWord | { deletedCount: number }>>
) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: '无效的敏感词 ID',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: '无效的敏感词 ID 格式',
    });
  }

  if (req.method === 'GET') {
    try {
      const word = await getSensitiveWordById(id);
      if (!word) {
        return res.status(404).json({
          success: false,
          error: '敏感词不存在',
        });
      }
      return res.status(200).json({
        success: true,
        data: word,
      });
    } catch (error) {
      console.error('获取敏感词详情失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取敏感词详情失败',
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const body = req.body;

      const validationResult = SensitiveWordUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const word = await updateSensitiveWord(id, validationResult.data as SensitiveWordUpdateInput);
      if (!word) {
        return res.status(404).json({
          success: false,
          error: '敏感词不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: word,
      });
    } catch (error: any) {
      console.error('更新敏感词失败:', error);
      if (error.message?.includes('已存在')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: '更新敏感词失败',
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const deleted = await deleteSensitiveWord(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: '敏感词不存在',
        });
      }
      return res.status(200).json({
        success: true,
        data: { deletedCount: 1 },
      });
    } catch (error) {
      console.error('删除敏感词失败:', error);
      return res.status(500).json({
        success: false,
        error: '删除敏感词失败',
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
