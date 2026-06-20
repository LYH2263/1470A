import type { NextApiResponse } from 'next';
import { getArticleById, updateArticle, deleteArticles, updateArticleWithOptimisticLock } from '@/lib/storage';
import { ArticleSchema } from '@/lib/validation';
import type { ApiResponse, UpdateArticleWithOptimisticLock } from '@/types/article';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getGlobalDetector } from '@/lib/sensitive-word-detector';
import { getAllEnabledSensitiveWords } from '@/lib/sensitive-word-storage';
import type { SensitiveWordDetectionResult } from '@/types/sensitive-word';
import { getCategoryById } from '@/lib/category-storage';

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
    // 更新文章（带乐观锁检测）
    try {
      const body = req.body as UpdateArticleWithOptimisticLock;

      // 1. 数据验证 (validation.ts)
      const validationResult = ArticleSchema.safeParse(body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: validationResult.error.issues[0].message,
        });
      }

      // 2. 校验分类是否存在
      const category = await getCategoryById(validationResult.data.categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          error: '所选分类不存在',
        });
      }

      // 3. 敏感词检测
      let detector = getGlobalDetector();
      if (detector.getWords().length === 0) {
        const words = await getAllEnabledSensitiveWords();
        detector = getGlobalDetector(words);
      }

      const titleDetection = detector.detect(validationResult.data.title);
      const contentDetection = detector.detect(validationResult.data.content);

      const contentHighlights = detector.buildHighlightSegments(
        validationResult.data.content,
        contentDetection.matches
      );
      const contentQuillRanges = detector.getQuillHighlightRanges(
        validationResult.data.content,
        contentDetection.matches
      );
      const highlightedHtml = detector.wrapHighlightInHtml(
        validationResult.data.content,
        contentHighlights
      );

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
        highlights: contentHighlights,
        quillRanges: contentQuillRanges,
        highlightedHtml,
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

      // 4. 替换策略：统一使用新的 replaceInHtml / replaceInPlainText
      const finalData = { ...validationResult.data };
      const hasReplace =
        titleDetection.matches.some(m => m.strategy === 'replace') ||
        contentDetection.matches.some(m => m.strategy === 'replace');

      if (hasReplace) {
        finalData.title = detector.replaceInPlainText(
          validationResult.data.title,
          titleDetection.matches
        );
        finalData.content = detector.replaceInHtml(
          validationResult.data.content,
          contentDetection.matches
        );
      }

      // 5. 保存文章
      if (body.lastUpdatedAt) {
        const updateBody = {
          ...body,
          ...finalData,
        };
        const result = await updateArticleWithOptimisticLock(id, updateBody);

        if (result.conflict) {
          return res.status(409).json({
            success: false,
            error: result.error,
            data: {
              conflict: true,
              currentArticle: result.currentArticle,
            },
          });
        }

        if (!result.success) {
          return res.status(404).json({
            success: false,
            error: result.error || '文章不存在',
          });
        }

        return res.status(200).json({
          success: true,
          data: result.article,
          message: detectionResult.stats.totalMatches > 0 
            ? `检测到 ${detectionResult.stats.totalMatches} 个敏感词，${detectionResult.stats.mediumLevelCount} 个已自动替换` 
            : undefined,
          sensitiveWordDetection: detectionResult,
        });
      }

      const article = await updateArticle(id, finalData);

      if (!article) {
        return res.status(404).json({
          success: false,
          error: '文章不存在',
        });
      }

      return res.status(200).json({
        success: true,
        data: article,
        message: detectionResult.stats.totalMatches > 0 
          ? `检测到 ${detectionResult.stats.totalMatches} 个敏感词，${detectionResult.stats.mediumLevelCount} 个已自动替换` 
          : undefined,
        sensitiveWordDetection: detectionResult,
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
