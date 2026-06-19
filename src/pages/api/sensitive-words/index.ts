import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getSensitiveWords,
  createSensitiveWord,
  deleteSensitiveWords,
} from '@/lib/sensitive-word-storage';
import type { ApiResponse } from '@/types/article';
import type {
  SensitiveWordListResponse,
  SensitiveWordCreateInput,
  SensitiveWordQuery,
} from '@/types/sensitive-word';
import { z } from 'zod';

const SensitiveWordCreateSchema = z.object({
  word: z.string().trim().min(1, '敏感词不能为空').max(100, '敏感词不能超过100个字符'),
  category: z.enum(['politics', 'violence', 'pornography', 'advertisement', 'other']),
  level: z.enum(['high', 'medium', 'low']),
  strategy: z.enum(['block', 'replace', 'warn']),
  enabled: z.boolean().optional().default(true),
});

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<SensitiveWordListResponse | unknown>>
) {
  if (req.method === 'GET') {
    try {
      const query: SensitiveWordQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
        keyword: req.query.keyword as string | undefined,
        category: req.query.category as SensitiveWordQuery['category'],
        level: req.query.level as SensitiveWordQuery['level'],
        enabled: req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined,
      };

      const result = await getSensitiveWords(query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('获取敏感词列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取敏感词列表失败',
      });
    }
  } else if (req.method === 'POST') {
    try {
      const body = req.body;

      const validationResult = SensitiveWordCreateSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      const word = await createSensitiveWord(validationResult.data as SensitiveWordCreateInput);

      return res.status(200).json({
        success: true,
        data: word,
      });
    } catch (error: any) {
      console.error('创建敏感词失败:', error);
      if (error.message?.includes('已存在')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: '创建敏感词失败',
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供要删除的敏感词 ID',
        });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = ids.filter((id) => typeof id === 'string' && uuidRegex.test(id));

      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '无效的敏感词 ID 格式',
        });
      }

      const deletedCount = await deleteSensitiveWords(validIds);

      return res.status(200).json({
        success: true,
        data: { deletedCount },
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
