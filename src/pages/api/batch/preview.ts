import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { previewBatchOperation } from '@/lib/storage';
import type { ApiResponse, BatchOperationType, BatchOperationParams, BatchPreviewResult } from '@/types/article';
import { validateRegexPattern } from '@/lib/batch-utils';

const VALID_OPERATIONS: BatchOperationType[] = [
  'batch_update_author',
  'batch_update_importance',
  'batch_append_footer',
  'batch_replace_content',
  'batch_delete',
];

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<BatchPreviewResult>>
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

    const result = await previewBatchOperation(
      validIds,
      operationType as BatchOperationType,
      params as BatchOperationParams
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量操作预览失败:', error);
    return res.status(500).json({
      success: false,
      error: '预览失败，请稍后重试',
    });
  }
}

export default withAuth(handler);
