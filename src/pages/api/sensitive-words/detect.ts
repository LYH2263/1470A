import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getGlobalDetector } from '@/lib/sensitive-word-detector';
import { getAllEnabledSensitiveWords, initializeDetector } from '@/lib/sensitive-word-storage';
import type { ApiResponse } from '@/types/article';
import type { SensitiveWordDetectionResult } from '@/types/sensitive-word';
import { z } from 'zod';

const DetectRequestSchema = z.object({
  content: z.string().min(0, '内容不能为空'),
  checkTitle: z.boolean().optional().default(false),
  title: z.string().optional(),
});

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse<SensitiveWordDetectionResult>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const validationResult = DetectRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.issues[0].message,
      });
    }

    const { content, checkTitle, title } = validationResult.data;

    let detector = getGlobalDetector();
    if (detector.getWords().length === 0) {
      const words = await getAllEnabledSensitiveWords();
      detector = getGlobalDetector(words);
    }

    const contentResult = detector.detect(content);
    const contentHighlights = detector.buildHighlightSegments(content, contentResult.matches);
    const contentQuillRanges = detector.getQuillHighlightRanges(content, contentResult.matches);
    const highlightedHtml = detector.wrapHighlightInHtml(content, contentHighlights);
    (contentResult as any).highlights = contentHighlights;
    (contentResult as any).quillRanges = contentQuillRanges;
    (contentResult as any).highlightedHtml = highlightedHtml;

    let titleHighlights: any[] = [];
    if (checkTitle && title) {
      const titleResult = detector.detect(title);
      contentResult.matches = [
        ...titleResult.matches.map((m: any) => ({ ...m, inTitle: true })),
        ...contentResult.matches,
      ];
      contentResult.stats.totalMatches += titleResult.stats.totalMatches;
      contentResult.stats.highLevelCount += titleResult.stats.highLevelCount;
      contentResult.stats.mediumLevelCount += titleResult.stats.mediumLevelCount;
      contentResult.stats.lowLevelCount += titleResult.stats.lowLevelCount;
      contentResult.shouldBlock = contentResult.shouldBlock || titleResult.shouldBlock;
      if (!contentResult.blockReason && titleResult.blockReason) {
        contentResult.blockReason = titleResult.blockReason;
      }
    }

    return res.status(200).json({
      success: true,
      data: contentResult,
    });
  } catch (error) {
    console.error('敏感词检测失败:', error);
    return res.status(500).json({
      success: false,
      error: '敏感词检测失败',
    });
  }
}

export default withAuth(handler);
