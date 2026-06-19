import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { exportSensitiveWords } from '@/lib/sensitive-word-storage';
import type { ApiResponse } from '@/types/article';
import type {
  SensitiveWordQuery,
  SensitiveWordImportItem,
} from '@/types/sensitive-word';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<SensitiveWordImportItem[]>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const query: SensitiveWordQuery = {
      keyword: req.query.keyword as string | undefined,
      category: req.query.category as SensitiveWordQuery['category'],
      level: req.query.level as SensitiveWordQuery['level'],
      enabled: req.query.enabled !== undefined ? req.query.enabled === 'true' : undefined,
    };

    const format = req.query.format as string | undefined;
    const data = await exportSensitiveWords(query);

    if (format === 'json' || !format) {
      const filename = `sensitive-words-${Date.now()}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).end(JSON.stringify(data, null, 2));
      return;
    }

    if (format === 'csv') {
      const filename = `sensitive-words-${Date.now()}.csv`;
      const header = 'word,category,level,strategy,enabled\n';
      const rows = data.map(item => 
        `"${item.word}","${item.category}","${item.level}","${item.strategy || 'block'}","${item.enabled !== false}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).end('\uFEFF' + header + rows);
      return;
    }

    return res.status(400).json({
      success: false,
      error: '不支持的导出格式',
    });
  } catch (error) {
    console.error('导出敏感词失败:', error);
    return res.status(500).json({
      success: false,
      error: '导出敏感词失败',
    });
  }
}

export default withAuth(handler);
