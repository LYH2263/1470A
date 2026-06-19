import type { NextApiResponse } from 'next';
import { getArticles, createArticle, deleteArticles } from '@/lib/storage';
import { ArticleSchema } from '@/lib/validation';
import type { ApiResponse } from '@/types/article';
import { PAGINATION, SEARCH } from '@/lib/constants';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getGlobalDetector } from '@/lib/sensitive-word-detector';
import { getAllEnabledSensitiveWords } from '@/lib/sensitive-word-storage';
import type { SensitiveWordDetectionResult } from '@/types/sensitive-word';

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method === 'GET') {
    // 获取文章列表
    try {
      // 输入验证和清理
      const rawPage = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : NaN;
      const rawPageSize = typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : NaN;

      const page = Math.max(
        PAGINATION.DEFAULT_PAGE,
        Number.isNaN(rawPage) ? PAGINATION.DEFAULT_PAGE : rawPage
      );
      const pageSize = Math.min(
        PAGINATION.MAX_PAGE_SIZE,
        Math.max(
          PAGINATION.MIN_PAGE_SIZE,
          Number.isNaN(rawPageSize) ? PAGINATION.DEFAULT_PAGE_SIZE : rawPageSize
        )
      );

      // 清理和限制关键词长度
      const keyword = req.query.keyword
        ? (req.query.keyword as string)
            .trim()
            .slice(0, SEARCH.MAX_KEYWORD_LENGTH)
        : undefined;

      const categoryId = req.query.categoryId !== undefined
        ? req.query.categoryId === '' || req.query.categoryId === null
          ? null
          : (req.query.categoryId as string)
        : undefined;

      const statusRaw = req.query.status as string | undefined;
      const status = statusRaw === 'all' || statusRaw === 'draft' || statusRaw === 'published'
        ? statusRaw
        : 'published';

      const result = await getArticles({ page, pageSize, keyword, categoryId, status });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('获取文章列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取文章列表失败',
      });
    }
  } else if (req.method === 'POST') {
    // 创建文章
    try {
      const body = req.body;

      // 1. 数据验证 (validation.ts)
      const validationResult = ArticleSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      // 2. 敏感词检测
      let detector = getGlobalDetector();
      if (detector.getWords().length === 0) {
        const words = await getAllEnabledSensitiveWords();
        detector = getGlobalDetector(words);
      }

      const titleDetection = detector.detect(validationResult.data.title);
      const contentDetection = detector.detect(validationResult.data.content);

      const allMatches = [...titleDetection.matches, ...contentDetection.matches];
      const detectionResult: SensitiveWordDetectionResult = {
        matches: allMatches,
        shouldBlock: titleDetection.shouldBlock || contentDetection.shouldBlock,
        blockReason: titleDetection.blockReason || contentDetection.blockReason,
        replacedContent: contentDetection.replacedContent,
        originalContent: validationResult.data.content,
        stats: {
          totalMatches: titleDetection.stats.totalMatches + contentDetection.stats.totalMatches,
          highLevelCount: titleDetection.stats.highLevelCount + contentDetection.stats.highLevelCount,
          mediumLevelCount: titleDetection.stats.mediumLevelCount + contentDetection.stats.mediumLevelCount,
          lowLevelCount: titleDetection.stats.lowLevelCount + contentDetection.stats.lowLevelCount,
        },
      };

      // 3. 阻断策略：有 block 级别的敏感词则阻止发布
      if (detectionResult.shouldBlock) {
        return res.status(400).json({
          success: false,
          error: detectionResult.blockReason || '内容包含违规敏感词，禁止发布',
          data: {
            sensitiveWordDetection: detectionResult,
          },
        });
      }

      // 4. 替换策略：将 replace 级别的敏感词替换为 ***
      let finalData = { ...validationResult.data };
      if (contentDetection.matches.some(m => m.strategy === 'replace')) {
        const replaceMatch = (text: string, matches: typeof contentDetection.matches) => {
          const replaceable = matches.filter(m => m.strategy === 'replace');
          if (replaceable.length === 0) return text;
          
          let result = '';
          let lastIndex = 0;
          const sorted = [...replaceable].sort((a, b) => a.start - b.start);
          
          for (const match of sorted) {
            if (match.start >= lastIndex) {
              result += text.slice(lastIndex, match.start);
              result += '*'.repeat(match.end - match.start);
              lastIndex = match.end;
            }
          }
          result += text.slice(lastIndex);
          return result;
        };
        
        finalData.content = replaceMatch(validationResult.data.content, contentDetection.matches);
        finalData.title = replaceMatch(validationResult.data.title, titleDetection.matches);
      }

      // 5. 保存文章
      const article = await createArticle(finalData);

      return res.status(200).json({
        success: true,
        data: article,
        message: detectionResult.stats.totalMatches > 0 
          ? `检测到 ${detectionResult.stats.totalMatches} 个敏感词，${detectionResult.stats.mediumLevelCount} 个已自动替换` 
          : undefined,
        sensitiveWordDetection: detectionResult,
      });
    } catch (error) {
      console.error('创建文章失败:', error);
      return res.status(500).json({
        success: false,
        error: '创建文章失败',
      });
    }
  } else if (req.method === 'DELETE') {
    // 批量删除文章（支持按状态过滤）
    try {
      const { ids, status } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请提供要删除的文章 ID',
        });
      }

      // 验证 ID 格式（UUID）
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = ids.filter((id) => typeof id === 'string' && uuidRegex.test(id));

      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: '无效的文章 ID 格式',
        });
      }

      const deletedCount = await deleteArticles(validIds, status);

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
