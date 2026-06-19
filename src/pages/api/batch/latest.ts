import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getLatestBatchOperation } from '@/lib/storage';
import type { ApiResponse, BatchOperationLog } from '@/types/article';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<BatchOperationLog | null>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const userId = req.user?.userId || '';

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '未授权',
      });
    }

    const result = await getLatestBatchOperation(userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取最近批量操作失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取失败，请稍后重试',
    });
  }
}

export default withAuth(handler);
