import type { NextApiResponse } from 'next';
import { getArticleById } from '@/lib/storage';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getUserById } from '@/lib/auth';
import {
  buildExportTemplate,
  DEFAULT_EXPORT_CONFIG,
  validateExportContentSize,
  type ExportConfig,
} from '@/lib/export-utils';
import type { ApiResponse } from '@/types/article';

interface HtmlExportBody {
  config?: Partial<ExportConfig>;
  download?: boolean;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse | string>
) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: '无效的文章 ID',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: '无效的文章 ID 格式',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const article = await getArticleById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        error: '文章不存在',
      });
    }

    const sizeCheck = validateExportContentSize(article.content);
    if (!sizeCheck.valid) {
      return res.status(413).json({
        success: false,
        error: sizeCheck.message || '内容过大，无法导出',
      });
    }

    const user = req.user?.userId ? await getUserById(req.user.userId) : null;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在',
      });
    }

    let exportConfig: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };
    let shouldDownload = true;

    const body = req.body as HtmlExportBody;
    if (body.config) {
      exportConfig = {
        ...DEFAULT_EXPORT_CONFIG,
        ...body.config,
        header: { ...DEFAULT_EXPORT_CONFIG.header, ...(body.config.header || {}) },
        footer: { ...DEFAULT_EXPORT_CONFIG.footer, ...(body.config.footer || {}) },
        cover: { ...DEFAULT_EXPORT_CONFIG.cover, ...(body.config.cover || {}) },
        watermark: { ...DEFAULT_EXPORT_CONFIG.watermark, ...(body.config.watermark || {}) },
        margin: body.config.margin || DEFAULT_EXPORT_CONFIG.margin,
      };
    }
    if (typeof body.download === 'boolean') {
      shouldDownload = body.download;
    }

    const { html } = buildExportTemplate(
      article,
      article.content,
      exportConfig,
      {
        username: user.username,
        userDisplayName: user.name,
        exportTime: new Date(),
      }
    );

    const safeTitle = article.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const filename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.html`;

    if (shouldDownload) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', Buffer.byteLength(html, 'utf-8'));
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(html);
  } catch (error) {
    console.error('HTML 导出失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? `HTML 导出失败: ${error.message}` : 'HTML 导出失败',
    });
  }
}

export default withAuth(handler);

export const config = {
  api: {
    responseLimit: '50mb',
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
