import type { NextApiResponse } from 'next';
import { chromium } from 'playwright';
import { getArticleById } from '@/lib/storage';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getUserById } from '@/lib/auth';
import {
  buildExportTemplate,
  DEFAULT_EXPORT_CONFIG,
  acquireExportSlot,
  releaseExportSlot,
  validateExportContentSize,
  EXPORT_MEMORY_LIMITS,
  type ExportConfig,
} from '@/lib/export-utils';
import type { ApiResponse } from '@/types/article';

interface PdfExportBody {
  config?: Partial<ExportConfig>;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse | Buffer>
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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  let exportSlotAcquired = false;

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

    const slotAcquired = await acquireExportSlot(30000);
    if (!slotAcquired) {
      return res.status(503).json({
        success: false,
        error: '导出服务繁忙，请稍后重试',
      });
    }
    exportSlotAcquired = true;

    const user = req.user?.userId ? await getUserById(req.user.userId) : null;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在',
      });
    }

    let exportConfig: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };
    if (req.method === 'POST') {
      const body = req.body as PdfExportBody;
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
    }

    const { html, headerTemplate, footerTemplate } = buildExportTemplate(
      article,
      article.content,
      exportConfig,
      {
        username: user.username,
        userDisplayName: user.name,
        exportTime: new Date(),
      }
    );

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-web-security',
        '--font-render-hinting=none',
      ],
      timeout: EXPORT_MEMORY_LIMITS.PUPPETEER_TIMEOUT_MS,
    });

    try {
      const context = await browser.newContext({
        locale: 'zh-CN',
        viewport: { width: 1200, height: 1697 },
      });

      const page = await context.newPage();

      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
          if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url) || url.startsWith('data:image/')) {
            return route.continue();
          }
          if (url.startsWith('http://') || url.startsWith('https://')) {
            return route.abort('blockedbyclient');
          }
        }
        return route.continue();
      });

      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: EXPORT_MEMORY_LIMITS.PUPPETEER_TIMEOUT_MS,
      });

      const pageSizeMap: Record<string, { width: string; height: string }> = {
        'A4': { width: '210mm', height: '297mm' },
        'Letter': { width: '215.9mm', height: '279.4mm' },
        'Legal': { width: '215.9mm', height: '355.6mm' },
      };
      const size = pageSizeMap[exportConfig.pageSize || 'A4'] || pageSizeMap['A4'];

      const pdfPromise = page.pdf({
        format: exportConfig.pageSize || 'A4',
        landscape: exportConfig.orientation === 'landscape',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: exportConfig.header.enabled || exportConfig.footer.enabled,
        headerTemplate: headerTemplate || '<span></span>',
        footerTemplate: footerTemplate || '<span></span>',
        margin: {
          top: exportConfig.margin?.top || '25mm',
          bottom: exportConfig.margin?.bottom || '25mm',
          left: exportConfig.margin?.left || '20mm',
          right: exportConfig.margin?.right || '20mm',
        },
        width: size.width,
        height: size.height,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF 生成超时')), EXPORT_MEMORY_LIMITS.PUPPETEER_TIMEOUT_MS);
      });

      const pdfBuffer = await Promise.race([pdfPromise, timeoutPromise]) as Buffer;

      await context.close();

      const safeTitle = article.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
      const filename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Accel-Buffering', 'no');

      return res.status(200).send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
      if (global.gc) {
        try { global.gc(); } catch (_) { /* noop */ }
      }
    }
  } catch (error) {
    console.error('PDF 导出失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? `PDF 导出失败: ${error.message}` : 'PDF 导出失败',
    });
  } finally {
    if (exportSlotAcquired) {
      releaseExportSlot();
    }
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
