import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { undoBatchOperation, getLatestBatchOperation } from '@/lib/storage';
import type { ApiResponse, BatchUndoResult } from '@/types/article';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<BatchUndoResult>>
) {
  if (req.method !== 'POST') {
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

    let { operationId } = req.body;

    if (!operationId) {
      const latest = await getLatestBatchOperation(userId);
      if (latest) {
        operationId = latest.id;
      } else {
        return res.status(400).json({
          success: false,
          error: '没有可撤销的批量操作',
        });
      }
    }

    const result = await undoBatchOperation(operationId, userId);

    return res.status(200).json({
      success: result.success,
      data: result,
      message: result.success 
        ? `成功撤销，恢复了 ${result.restoredCount} 篇文章`
        : `撤销失败: ${result.errors[0]?.error || '未知错误'}`,
    });
  } catch (error) {
    console.error('撤销批量操作失败:', error);
    return res.status(500).json({
      success: false,
      error: '撤销失败，请稍后重试',
    });
  }
}

export default withAuth(handler);
