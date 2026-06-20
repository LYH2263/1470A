import { stripHtml } from './html-utils';
import DOMPurify from 'isomorphic-dompurify';
import { configureDOMPurify } from './utils';

export interface HtmlSafetyCheckResult {
  isSafe: boolean;
  warnings: string[];
  tagDiff?: {
    removed: string[];
    added: string[];
  };
}

export function checkHtmlStructureSafety(originalHtml: string, modifiedHtml: string): HtmlSafetyCheckResult {
  const warnings: string[] = [];
  
  const extractTags = (html: string): string[] => {
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    const tags: string[] = [];
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      tags.push(match[1].toLowerCase());
    }
    return tags;
  };

  const countOpenClose = (html: string): Record<string, { open: number; close: number }> => {
    const result: Record<string, { open: number; close: number }> = {};
    const openTagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    const closeTagRegex = /<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g;
    
    let match;
    while ((match = openTagRegex.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      if (!result[tag]) result[tag] = { open: 0, close: 0 };
      if (!match[0].endsWith('/>')) {
        result[tag].open++;
      }
    }
    while ((match = closeTagRegex.exec(html)) !== null) {
      const tag = match[1].toLowerCase();
      if (!result[tag]) result[tag] = { open: 0, close: 0 };
      result[tag].close++;
    }
    return result;
  };

  const selfClosingTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);

  const originalCounts = countOpenClose(originalHtml);
  const modifiedCounts = countOpenClose(modifiedHtml);

  const allTags = new Set([...Object.keys(originalCounts), ...Object.keys(modifiedCounts)]);
  
  const removed: string[] = [];
  const added: string[] = [];

  for (const tag of allTags) {
    if (selfClosingTags.has(tag)) continue;
    
    const orig = originalCounts[tag] || { open: 0, close: 0 };
    const mod = modifiedCounts[tag] || { open: 0, close: 0 };
    
    const origBalance = orig.open - orig.close;
    const modBalance = mod.open - mod.close;
    
    if (origBalance !== modBalance) {
      if (modBalance > origBalance) {
        warnings.push(`标签 <${tag}> 可能未闭合，新增未闭合标签 ${modBalance - origBalance} 个`);
      } else {
        warnings.push(`标签 </${tag}> 可能缺少对应开标签，缺少 ${origBalance - modBalance} 个`);
      }
    }
  }

  const originalTags = extractTags(originalHtml);
  const modifiedTags = extractTags(modifiedHtml);

  const origTagSet = new Set(originalTags);
  const modTagSet = new Set(modifiedTags);

  for (const tag of modTagSet) {
    if (!origTagSet.has(tag)) {
      added.push(tag);
    }
  }
  for (const tag of origTagSet) {
    if (!modTagSet.has(tag)) {
      removed.push(tag);
    }
  }

  if (removed.length > 0) {
    warnings.push(`替换操作移除了以下标签: ${removed.join(', ')}，可能影响页面结构`);
  }

  if (added.length > 0) {
    warnings.push(`替换操作新增了以下标签: ${added.join(', ')}，请确认是否为预期变更`);
  }

  const originalPlainLen = stripHtml(originalHtml).length;
  const modifiedPlainLen = stripHtml(modifiedHtml).length;
  
  if (originalPlainLen > 0 && Math.abs(modifiedPlainLen - originalPlainLen) / originalPlainLen > 0.5) {
    warnings.push('替换后纯文本内容变化超过 50%，请确认是否为预期变更');
  }

  return {
    isSafe: warnings.length === 0,
    warnings,
    tagDiff: { removed, added },
  };
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const result: DiffLine[] = [];
  
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined && newLine !== undefined) {
      result.push({ type: 'added', content: newLine });
    } else if (oldLine !== undefined && newLine === undefined) {
      result.push({ type: 'removed', content: oldLine });
    } else if (oldLine === newLine) {
      result.push({ type: 'unchanged', content: oldLine });
    } else {
      result.push({ type: 'removed', content: oldLine });
      result.push({ type: 'added', content: newLine });
    }
  }
  
  return result;
}

export function truncateForPreview(text: string, maxLength = 500): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxLength) + '...', truncated: true };
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ReplaceResult {
  text: string;
  replaceCount: number;
}

export function safeReplaceContent(
  content: string,
  pattern: string,
  replacement: string,
  isRegex: boolean,
  caseSensitive = false
): ReplaceResult {
  try {
    let regex: RegExp;
    let replaceCount = 0;

    if (isRegex) {
      const flags = caseSensitive ? 'g' : 'gi';
      regex = new RegExp(pattern, flags);
    } else {
      const flags = caseSensitive ? 'g' : 'gi';
      const escapedPattern = escapeRegExp(pattern);
      regex = new RegExp(escapedPattern, flags);
    }

    const matches = content.match(regex);
    replaceCount = matches ? matches.length : 0;

    const newContent = content.replace(regex, replacement);

    return { text: newContent, replaceCount };
  } catch (error) {
    throw new Error(`正则表达式无效: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export function validateRegexPattern(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : '无效的正则表达式' 
    };
  }
}

export function sanitizeHtmlContent(html: string): string {
  configureDOMPurify();
  return DOMPurify.sanitize(html);
}
