import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { importSensitiveWords } from '@/lib/sensitive-word-storage';
import type { ApiResponse } from '@/types/article';
import type { SensitiveWordImportItem } from '@/types/sensitive-word';
import { z } from 'zod';

const ImportItemSchema = z.object({
  word: z.string().trim().min(1),
  category: z.enum(['politics', 'violence', 'pornography', 'advertisement', 'other']),
  level: z.enum(['high', 'medium', 'low']),
  strategy: z.enum(['block', 'replace', 'warn']).optional(),
  enabled: z.boolean().optional(),
});

const ImportRequestSchema = z.union([
  z.array(ImportItemSchema),
  z.object({
    data: z.array(ImportItemSchema),
  }),
]);

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    let items: SensitiveWordImportItem[];

    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (req.body?.data && Array.isArray(req.body.data)) {
      items = req.body.data;
    } else {
      return res.status(400).json({
        success: false,
        error: '请求格式错误，请提供敏感词数组',
      });
    }

    const validationResult = ImportRequestSchema.safeParse(items);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: `数据格式错误: ${validationResult.error.issues[0].message}`,
      });
    }

    const result = await importSensitiveWords(items as SensitiveWordImportItem[]);

    return res.status(200).json({
      success: true,
      data: result,
      message: `导入完成：新增 ${result.created} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`,
    });
  } catch (error) {
    console.error('导入敏感词失败:', error);
    return res.status(500).json({
      success: false,
      error: '导入敏感词失败',
    });
  }
}

export default withAuth(handler);
