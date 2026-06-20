import DOMPurify from 'isomorphic-dompurify';
import type { Article } from '@/types/article';

export interface ExportHeaderFooter {
  enabled: boolean;
  left?: string;
  right?: string;
  center?: string;
  fontSize?: number;
}

export interface ExportCover {
  enabled: boolean;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showExportDate?: boolean;
  showAuthor?: boolean;
}

export interface ExportWatermark {
  enabled: boolean;
  text?: string;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
  color?: string;
}

export interface ExportConfig {
  header: ExportHeaderFooter;
  footer: ExportHeaderFooter;
  cover: ExportCover;
  watermark: ExportWatermark;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  includeTableOfContents?: boolean;
  stripDarkStyles?: boolean;
}

export interface ExportContext {
  username: string;
  userDisplayName: string;
  exportTime: Date;
  baseUrl?: string;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  header: {
    enabled: true,
    left: '文章管理系统',
    center: '',
    right: '{title}',
    fontSize: 10,
  },
  footer: {
    enabled: true,
    left: '{exportUser}',
    center: '',
    right: '第 {pageNumber} 页 / 共 {totalPages} 页',
    fontSize: 9,
  },
  cover: {
    enabled: true,
    showExportDate: true,
    showAuthor: true,
  },
  watermark: {
    enabled: true,
    opacity: 0.08,
    fontSize: 16,
    rotation: -30,
    color: '#666666',
  },
  pageSize: 'A4',
  orientation: 'portrait',
  margin: {
    top: '25mm',
    bottom: '25mm',
    left: '20mm',
    right: '20mm',
  },
  includeTableOfContents: false,
  stripDarkStyles: true,
};

export interface ExportTemplateResult {
  html: string;
  headerTemplate?: string;
  footerTemplate?: string;
}

const CJK_FONT_STACK = "'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'WenQuanYi Micro Hei', 'Noto Sans CJK SC', 'Source Han Sans SC', SimSun, sans-serif";
const MONO_FONT_STACK = "Consolas, Monaco, 'Courier New', monospace";

function configureDOMPurifyForExport(): void {
  DOMPurify.setConfig({
    ADD_TAGS: [
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup',
      'caption', 'pre', 'code', 'span', 'div', 'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
      'blockquote', 'figure', 'figcaption',
      'img', 'a', 'abbr', 'acronym', 'address', 'cite', 'q',
      'del', 'ins', 'mark', 'small',
    ],
    ADD_ATTR: [
      'class', 'style', 'src', 'href', 'target', 'rel', 'width', 'height',
      'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'align',
      'type', 'data-language', 'alt', 'title',
    ],
    FORBID_TAGS: ['script', 'noscript', 'iframe', 'form', 'input', 'button', 'select', 'textarea'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

export function stripScriptsAndStyles(html: string): string {
  configureDOMPurifyForExport();
  const purified = DOMPurify.sanitize(html);

  let result = purified;

  result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '');

  result = result.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  result = result.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  result = result.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  return result;
}

export function stripDarkThemeStyles(html: string): string {
  const darkColorPatterns = [
    /background-color\s*:\s*(#(?:0[0-9a-f]{5}|1[0-2][0-9a-f]{5})|rgba?\(\s*(?:[0-2]?\d{1,2}\s*,\s*){2}[0-2]?\d{1,2}\s*(?:,\s*[\d.]+\s*)?\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*(?:[0-2]?\d|30)%\)|black|dark(?:gray|grey|slate|blue|green|red|olive|purple|teal|magenta|cyan)?|#(?:1a1a1a|222222|2d2d2d|333333))/gi,
    /color\s*:\s*(#(?:f{3}|f{6}|e[0-9a-f]{5}|fff)|rgba?\(\s*(?:2[0-4]\d|25[0-5])\s*(?:,\s*(?:2[0-4]\d|25[0-5])\s*){2,3}\)|white|light(?:gray|grey|slate|blue|green|red|olive|purple|teal|magenta|cyan)?|silver|#(?:eee|fff|f5f5f5|e0e0e0))/gi,
  ];

  let result = html;
  for (const pattern of darkColorPatterns) {
    result = result.replace(pattern, '');
  }

  result = result.replace(/class\s*=\s*"[^"]*(?:dark|theme-dark|bg-dark|text-light|ant-dark)[^"]*"/gi, (match) => {
    return match.replace(/[^"]*(?:dark|theme-dark|bg-dark|text-light|ant-dark)[^"]*\s*/g, '');
  }).replace(/class\s*=\s*""\s*/g, '');

  return result;
}

export function handleLongImagePagination(html: string, maxHeightPx: number = 800): string {
  return html.replace(/<img\s+([^>]*?)>/gi, (fullMatch, attrs: string) => {
    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*?)["']/i);
    const existingStyle = styleMatch ? styleMatch[1] : '';

    const heightAttrMatch = attrs.match(/height\s*=\s*["'](\d+)["']/i);

    let hasHeightConstraint = false;
    if (existingStyle && /max-height|height\s*:\s*\d+/i.test(existingStyle)) {
      hasHeightConstraint = true;
    }
    if (heightAttrMatch) {
      hasHeightConstraint = true;
    }

    let newStyle = existingStyle;
    if (newStyle && !newStyle.trim().endsWith(';')) {
      newStyle += ';';
    }

    if (!hasHeightConstraint) {
      newStyle += ` max-height: ${maxHeightPx}px;`;
    }
    newStyle += ' object-fit: contain; page-break-inside: avoid; break-inside: avoid;';

    let newAttrs = attrs;
    if (styleMatch) {
      newAttrs = newAttrs.replace(/style\s*=\s*["'][^"']*?["']/i, `style="${newStyle.trim()}"`);
    } else {
      newAttrs += ` style="${newStyle.trim()}"`;
    }

    return `<img ${newAttrs}>`;
  });
}

function applyTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function buildWatermarkSvg(watermark: ExportWatermark, username: string, exportTime: Date): string {
  const text = watermark.text || `${username} ${formatDate(exportTime)}`;
  const opacity = watermark.opacity ?? 0.08;
  const fontSize = watermark.fontSize ?? 16;
  const rotation = watermark.rotation ?? -30;
  const color = watermark.color ?? '#666666';

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg class="watermark-layer" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><pattern id="watermarkPattern" x="0" y="0" width="300" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(${rotation})"><text x="150" y="100" text-anchor="middle" font-size="${fontSize}px" font-family=${CJK_FONT_STACK} fill="${color}" opacity="${opacity}" style="user-select:none;-webkit-user-select:none;">${escapedText}</text></pattern></defs><rect x="0" y="0" width="100%" height="100%" fill="url(#watermarkPattern)"/></svg>`;
}

function buildCoverHtml(article: Article, cover: ExportCover, ctx: ExportContext): string {
  if (!cover.enabled) return '';

  const title = (cover.title || article.title)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const subtitle = (cover.subtitle || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const exportDate = formatDate(ctx.exportTime);
  const safeAuthor = article.author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeUsername = ctx.username.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDisplayName = ctx.userDisplayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<section class="export-cover" style="page-break-after:always;"><div class="cover-content">${cover.showLogo ? `<div class="cover-logo"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="#1890ff"/><path d="M8 8h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" fill="white"/></svg></div>` : ''}<h1 class="cover-title">${title}</h1>${subtitle ? `<h2 class="cover-subtitle">${subtitle}</h2>` : ''}<div class="cover-meta">${cover.showAuthor ? `<div class="cover-meta-item"><span class="cover-meta-label">作者：</span><span class="cover-meta-value">${safeAuthor}</span></div>` : ''}${article.category ? `<div class="cover-meta-item"><span class="cover-meta-label">分类：</span><span class="cover-meta-value">${article.category.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></div>` : ''}<div class="cover-meta-item"><span class="cover-meta-label">创建时间：</span><span class="cover-meta-value">${formatDate(new Date(article.createdAt))}</span></div><div class="cover-meta-item"><span class="cover-meta-label">阅读数：</span><span class="cover-meta-value">${article.views}</span></div></div>${cover.showExportDate ? `<div class="cover-export-info"><div>导出人：${safeDisplayName} (${safeUsername})</div><div>导出时间：${exportDate}</div></div>` : ''}</div></section>`;
}

export function buildPdfHeaderTemplate(config: ExportConfig, vars: Record<string, string>): string {
  if (!config.header.enabled) return '<span></span>';

  const fontSize = config.header.fontSize ?? 10;
  return `<div style="font-size:${fontSize}px;padding:0 20px;width:100%;display:flex;justify-content:space-between;color:#666;border-bottom:1px solid #e8e8e8;padding-bottom:6px;font-family:${CJK_FONT_STACK};"><span style="text-align:left;flex:1;">${applyTemplateVars(config.header.left || '', vars)}</span><span style="text-align:center;flex:1;">${applyTemplateVars(config.header.center || '', vars)}</span><span style="text-align:right;flex:1;">${applyTemplateVars(config.header.right || '', vars)}</span></div>`;
}

export function buildPdfFooterTemplate(config: ExportConfig, vars: Record<string, string>): string {
  if (!config.footer.enabled) return '<span></span>';

  const fontSize = config.footer.fontSize ?? 9;
  const leftText = applyTemplateVars(config.footer.left || '', vars);
  const centerText = applyTemplateVars(config.footer.center || '', vars);
  const rightRaw = (config.footer.right || '').replace(/\{pageNumber\}/g, '<span class="pageNumber"></span>').replace(/\{totalPages\}/g, '<span class="totalPages"></span>');
  const rightText = applyTemplateVars(rightRaw, vars);

  return `<div style="font-size:${fontSize}px;padding:0 20px;width:100%;display:flex;justify-content:space-between;color:#666;border-top:1px solid #e8e8e8;padding-top:6px;font-family:${CJK_FONT_STACK};"><span style="text-align:left;flex:1;">${leftText}</span><span style="text-align:center;flex:1;">${centerText}</span><span style="text-align:right;flex:1;">${rightText}</span></div>`;
}

function buildPrintStyles(pageSize: string, orientation: string, margin: ExportConfig['margin']): string {
  const sizeMap: Record<string, string> = {
    'A4': '210mm 297mm',
    'Letter': '215.9mm 279.4mm',
    'Legal': '215.9mm 355.6mm',
  };
  const baseSize = sizeMap[pageSize] || sizeMap['A4'];
  const finalSize = orientation === 'landscape' ? baseSize.split(' ').reverse().join(' ') : baseSize;

  return `@page{size:${finalSize};margin:${margin?.top || '25mm'} ${margin?.right || '20mm'} ${margin?.bottom || '25mm'} ${margin?.left || '20mm'};}@media print{html,body{background:white!important;color:black!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.watermark-layer{position:fixed!important;top:0;left:0;z-index:9999;pointer-events:none;}.export-cover{page-break-after:always;break-after:page;}h1,h2,h3,h4,h5,h6{page-break-after:avoid;break-after:avoid;}table,img,figure{page-break-inside:avoid;break-inside:avoid;}p,li,tr{orphans:3;widows:3;}}@media screen{body{background:#f5f5f5;padding:40px 0;}.print-page{background:white;max-width:210mm;margin:0 auto 20px;padding:25mm 20mm;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-height:297mm;box-sizing:border-box;}}`;
}

function buildArticleStyles(): string {
  return `*{box-sizing:border-box;}html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}body{font-family:${CJK_FONT_STACK};font-size:14px;line-height:1.8;color:#333;margin:0;padding:0;word-break:break-word;overflow-wrap:break-word;line-break:auto;-webkit-text-size-adjust:100%;}.article-print-container{position:relative;}.watermark-layer{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;overflow:hidden;}.article-content-wrapper{position:relative;z-index:1;}.article-header{border-bottom:2px solid #1890ff;padding-bottom:20px;margin-bottom:30px;}.article-header h1{font-size:28px;font-weight:700;color:#111;margin:0 0 16px 0;line-height:1.5;word-break:break-word;}.article-meta{display:flex;flex-wrap:wrap;gap:16px 24px;font-size:13px;color:#666;}.article-meta-item{display:inline-flex;align-items:center;gap:4px;}.article-meta-label{color:#999;}.article-content{font-size:15px;line-height:2;}.article-content h1{font-size:24px;font-weight:700;margin:32px 0 16px;padding-bottom:8px;border-bottom:1px solid #e8e8e8;color:#111;line-height:1.5;}.article-content h2{font-size:20px;font-weight:700;margin:28px 0 14px;color:#222;line-height:1.5;}.article-content h3{font-size:18px;font-weight:600;margin:24px 0 12px;color:#222;line-height:1.5;}.article-content h4,.article-content h5,.article-content h6{font-size:16px;font-weight:600;margin:20px 0 10px;color:#333;line-height:1.5;}.article-content p{margin:12px 0;text-align:justify;line-height:2;}.article-content a{color:#1890ff;text-decoration:none;border-bottom:1px solid #1890ff;}.article-content img{max-width:100%;height:auto;display:block;margin:16px auto;border-radius:4px;page-break-inside:avoid;break-inside:avoid;}.article-content ul,.article-content ol{padding-left:24px;margin:12px 0;}.article-content li{margin:6px 0;line-height:2;}.article-content blockquote{margin:16px 0;padding:12px 16px;background:#f6f8fa;border-left:4px solid #1890ff;color:#555;border-radius:0 4px 4px 0;}.article-content blockquote p{margin:0;}.article-content pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:16px;overflow-x:auto;margin:16px 0;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;page-break-inside:avoid;break-inside:avoid;}.article-content pre code{background:none;padding:0;border:none;font-size:inherit;font-family:${MONO_FONT_STACK};}.article-content code{background:#f6f8fa;padding:2px 6px;border-radius:3px;font-size:13px;font-family:${MONO_FONT_STACK};border:1px solid #e1e4e8;}.article-content table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;page-break-inside:avoid;break-inside:avoid;}.article-content th,.article-content td{border:1px solid #d0d7de;padding:10px 14px;text-align:left;vertical-align:top;word-break:break-word;}.article-content th{background:#f6f8fa;font-weight:600;color:#222;}.article-content tr:nth-child(even) td{background:#fafbfc;}.article-content hr{border:none;border-top:1px solid #e8e8e8;margin:24px 0;}.article-content strong{font-weight:600;}.article-content em{font-style:italic;}.article-content del{text-decoration:line-through;color:#999;}.article-content mark{background:#fff3cd;padding:2px 4px;border-radius:2px;}.article-content figure{margin:16px 0;text-align:center;page-break-inside:avoid;break-inside:avoid;}.article-content figcaption{font-size:13px;color:#666;margin-top:8px;text-align:center;}.export-cover{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:60px 40px;}.cover-content{text-align:center;max-width:600px;}.cover-logo{margin-bottom:40px;display:flex;justify-content:center;}.cover-title{font-size:36px;font-weight:700;color:#111;margin:0 0 16px 0;line-height:1.5;word-break:break-word;}.cover-subtitle{font-size:20px;color:#666;font-weight:400;margin:0 0 48px 0;}.cover-meta{text-align:left;background:#f6f8fa;padding:24px 32px;border-radius:8px;margin:0 0 40px 0;}.cover-meta-item{display:flex;padding:8px 0;border-bottom:1px solid #e1e4e8;font-size:15px;}.cover-meta-item:last-child{border-bottom:none;}.cover-meta-label{color:#666;min-width:100px;font-weight:500;}.cover-meta-value{color:#222;font-weight:600;}.cover-export-info{text-align:center;font-size:13px;color:#999;padding-top:24px;border-top:1px solid #e8e8e8;line-height:2;}`;
}

export function buildExportTemplate(
  article: Article,
  rawContent: string,
  config: ExportConfig,
  ctx: ExportContext
): ExportTemplateResult {
  const templateVars: Record<string, string> = {
    title: article.title,
    author: article.author,
    exportUser: `${ctx.userDisplayName}(${ctx.username})`,
    exportDate: formatDate(ctx.exportTime),
    createDate: formatDate(new Date(article.createdAt)),
  };

  let processedContent = stripScriptsAndStyles(rawContent);

  if (config.stripDarkStyles) {
    processedContent = stripDarkThemeStyles(processedContent);
  }

  processedContent = handleLongImagePagination(processedContent);

  const coverHtml = buildCoverHtml(article, config.cover, ctx);

  const watermarkHtml = config.watermark.enabled
    ? buildWatermarkSvg(config.watermark, ctx.username, ctx.exportTime)
    : '';

  const headerTemplate = buildPdfHeaderTemplate(config, templateVars);
  const footerTemplate = buildPdfFooterTemplate(config, templateVars);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')} - 导出文档</title>
<style>
${buildPrintStyles(config.pageSize || 'A4', config.orientation || 'portrait', config.margin)}
${buildArticleStyles()}
</style>
</head>
<body>
<div class="print-page">
<div class="article-print-container">
${watermarkHtml}
<div class="article-content-wrapper">
${coverHtml}
<article>
<header class="article-header">
<h1>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
<div class="article-meta">
<div class="article-meta-item"><span class="article-meta-label">作者：</span><span>${article.author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></div>
${article.category ? `<div class="article-meta-item"><span class="article-meta-label">分类：</span><span>${article.category.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></div>` : ''}
<div class="article-meta-item"><span class="article-meta-label">创建时间：</span><span>${formatDate(new Date(article.createdAt))}</span></div>
<div class="article-meta-item"><span class="article-meta-label">阅读：</span><span>${article.views} 次</span></div>
</div>
</header>
<div class="article-content">
${processedContent}
</div>
</article>
</div>
</div>
</div>
</body>
</html>`;

  return {
    html,
    headerTemplate: config.header.enabled ? headerTemplate : undefined,
    footerTemplate: config.footer.enabled ? footerTemplate : undefined,
  };
}

export const EXPORT_MEMORY_LIMITS = {
  MAX_CONTENT_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_IMAGES_PER_ARTICLE: 50,
  PUPPETEER_TIMEOUT_MS: 30000,
  MAX_CONCURRENT_EXPORTS: 3,
} as const;

let concurrentExportCount = 0;

export async function acquireExportSlot(timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (concurrentExportCount >= EXPORT_MEMORY_LIMITS.MAX_CONCURRENT_EXPORTS) {
    if (Date.now() - start > timeoutMs) {
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  concurrentExportCount++;
  return true;
}

export function releaseExportSlot(): void {
  if (concurrentExportCount > 0) {
    concurrentExportCount--;
  }
}

export function getConcurrentExportCount(): number {
  return concurrentExportCount;
}

export function validateExportContentSize(content: string): { valid: boolean; sizeBytes: number; message?: string } {
  const sizeBytes = Buffer.byteLength(content, 'utf-8');
  if (sizeBytes > EXPORT_MEMORY_LIMITS.MAX_CONTENT_SIZE_BYTES) {
    return {
      valid: false,
      sizeBytes,
      message: `内容大小 (${(sizeBytes / 1024 / 1024).toFixed(2)} MB) 超过最大限制 (${EXPORT_MEMORY_LIMITS.MAX_CONTENT_SIZE_BYTES / 1024 / 1024} MB)`,
    };
  }
  return { valid: true, sizeBytes };
}
