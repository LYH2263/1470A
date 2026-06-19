import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { executeBatchOperation } from '@/lib/storage';
import type { ApiResponse, BatchOperationType, BatchOperationParams, BatchExecuteResult } from '@/types/article';
import { validateRegexPattern } from '@/lib/batch-utils';
import { getUserById } from '@/lib/auth';

const VALID_OPERATIONS: BatchOperationType[] = [
  'batch_update_author',
  'batch_update_importance',
  'batch_append_footer',
  'batch_replace_content',
  'batch_delete',
];

const MAX_BATCH_SIZE = 500;

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<BatchExecuteResult>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const { articleIds, operationType, params } = req.body;

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请选择要操作的文章',
      });
    }

    if (articleIds.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `单次批量操作最多支持 ${MAX_BATCH_SIZE} 篇文章`,
      });
    }

    if (!VALID_OPERATIONS.includes(operationType)) {
      return res.status(400).json({
        success: false,
        error: '无效的操作类型',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = articleIds.filter((id: unknown) => typeof id === 'string' && uuidRegex.test(id));

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '无效的文章 ID 格式',
      });
    }

    if (!params || typeof params !== 'object') {
      return res.status(400).json({
        success: false,
        error: '操作参数不能为空',
      });
    }

    switch (operationType) {
      case 'batch_update_author':
        if (!params.author || typeof params.author !== 'string' || params.author.trim() === '') {
          return res.status(400).json({
            success: false,
            error: '作者名称不能为空',
          });
        }
        break;
      case 'batch_update_importance':
        if (!['low', 'medium', 'high'].includes(params.importance)) {
          return res.status(400).json({
            success: false,
            error: '无效的重要性等级',
          });
        }
        break;
      case 'batch_append_footer':
        if (!params.footerHtml || typeof params.footerHtml !== 'string') {
          return res.status(400).json({
            success: false,
            error: '页脚内容不能为空',
          });
        }
        break;
      case 'batch_replace_content':
        if (!params.pattern || typeof params.pattern !== 'string') {
          return res.status(400).json({
            success: false,
            error: '查找内容不能为空',
          });
        }
        if (typeof params.replacement !== 'string') {
          return res.status(400).json({
            success: false,
            error: '替换内容不能为空',
          });
        }
        if (params.isRegex) {
          const validation = validateRegexPattern(params.pattern);
          if (!validation.valid) {
            return res.status(400).json({
              success: false,
              error: `正则表达式无效: ${validation.error}`,
            });
          }
        }
        break;
    }

    const userId = req.user?.userId || '';
    const user = await getUserById(userId);
    const userName = user?.name || user?.username || '未知用户';

    const result = await executeBatchOperation(
      validIds,
      operationType as BatchOperationType,
      params as BatchOperationParams,
      userId,
      userName
    );

    return res.status(200).json({
      success: result.success,
      data: result,
      message: result.status === 'success' 
        ? `成功处理 ${result.successCount} 篇文章`
        : result.status === 'partial_failure'
          ? `部分成功：${result.successCount} 篇成功，${result.failureCount} 篇失败`
          : '批量操作失败',
    });
  } catch (error) {
    console.error('批量操作执行失败:', error);
    return res.status(500).json({
      success: false,
      error: '执行失败，请稍后重试',
    });
  }
}

export default withAuth(handler);
