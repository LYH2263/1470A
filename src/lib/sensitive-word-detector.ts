import { stripHtml } from './html-utils';
import type {
  SensitiveWord,
  SensitiveWordMatch,
  SensitiveWordDetectionResult,
  HighlightSegment,
} from '@/types/sensitive-word';
import { SENSITIVE_WORD_DEFAULTS } from '@/types/sensitive-word';

interface AcNode {
  children: Map<string, AcNode>;
  fail: AcNode | null;
  output: SensitiveWord[];
}

interface HtmlPositionMap {
  htmlOffset: number;
  plainOffset: number;
}

function createAcNode(): AcNode {
  return {
    children: new Map(),
    fail: null,
    output: [],
  };
}

const LEVEL_TO_HIGHLIGHT_CLASS: Record<string, string> = {
  high: 'sensitive-highlight-high',
  medium: 'sensitive-highlight-medium',
  low: 'sensitive-highlight-low',
};

const LEVEL_HL_COLOR: Record<string, string> = {
  high: '#ffebee',
  medium: '#fff8e1',
  low: '#e8f5e9',
};

const LEVEL_BORDER_COLOR: Record<string, string> = {
  high: '#ef5350',
  medium: '#ffa726',
  low: '#66bb6a',
};

export class SensitiveWordDetector {
  private root: AcNode;
  private words: SensitiveWord[];
  private built: boolean;

  constructor(words: SensitiveWord[] = []) {
    this.root = createAcNode();
    this.words = [];
    this.built = false;
    this.setWords(words);
  }

  setWords(words: SensitiveWord[]): void {
    const enabledWords = words.filter(w => w.enabled);
    if (JSON.stringify(enabledWords) === JSON.stringify(this.words)) {
      return;
    }
    this.words = enabledWords;
    this.root = createAcNode();
    this.build();
  }

  private build(): void {
    for (const word of this.words) {
      const normalized = normalizeText(word.word);
      if (!normalized) continue;

      let current = this.root;
      for (const ch of normalized) {
        if (!current.children.has(ch)) {
          current.children.set(ch, createAcNode());
        }
        current = current.children.get(ch)!;
      }
      current.output.push(word);
    }

    const queue: AcNode[] = [];
    for (const child of this.root.children.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [ch, child] of current.children) {
        let failNode = current.fail;
        while (failNode !== null && !failNode.children.has(ch)) {
          failNode = failNode.fail;
        }
        child.fail = failNode === null ? this.root : failNode.children.get(ch) || this.root;
        child.output = [...child.output, ...child.fail.output];
        queue.push(child);
      }
    }

    this.built = true;
  }

  private findAllMatches(normalizedText: string, originalText: string): SensitiveWordMatch[] {
    if (!this.built) this.build();

    const matches: SensitiveWordMatch[] = [];
    let current = this.root;

    for (let i = 0; i < normalizedText.length; i++) {
      const ch = normalizedText[i];
      while (current !== this.root && !current.children.has(ch)) {
        current = current.fail || this.root;
      }
      current = current.children.get(ch) || this.root;

      if (current.output.length > 0) {
        for (const word of current.output) {
          const normalizedWord = normalizeText(word.word);
          const wordLength = normalizedWord.length;
          const start = i - wordLength + 1;
          if (start >= 0) {
            const originalMatch = originalText.slice(start, i + 1);
            matches.push({
              word: word.word,
              normalizedWord,
              category: word.category,
              level: word.level,
              strategy: word.strategy,
              start,
              end: i + 1,
              originalText: originalMatch,
            });
          }
        }
      }
    }

    return this.resolveOverlaps(matches);
  }

  private resolveOverlaps(matches: SensitiveWordMatch[]): SensitiveWordMatch[] {
    if (matches.length === 0) return [];

    const sorted = [...matches].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end;
    });

    const result: SensitiveWordMatch[] = [];
    let lastEnd = -1;
    const levelOrder = { high: 3, medium: 2, low: 1 };

    for (const match of sorted) {
      if (match.start >= lastEnd) {
        result.push(match);
        lastEnd = match.end;
      } else {
        const existing = result[result.length - 1];
        const existingLen = existing.end - existing.start;
        const newLen = match.end - match.start;
        const existingPriority = levelOrder[existing.level];
        const newPriority = levelOrder[match.level];

        if (newPriority > existingPriority || (newPriority === existingPriority && newLen > existingLen)) {
          result[result.length - 1] = match;
          lastEnd = match.end;
        }
      }
    }

    return result;
  }

  detect(input: string): SensitiveWordDetectionResult {
    const plainText = stripHtml(input);
    const normalizedText = normalizeText(plainText);

    const matches = this.findAllMatches(normalizedText, plainText);

    const shouldBlock = matches.some(m => m.strategy === 'block');
    const blockMatch = matches.find(m => m.strategy === 'block');
    const blockReason = blockMatch 
      ? `内容包含敏感词「${blockMatch.word}」，禁止发布` 
      : null;

    const stats = {
      totalMatches: matches.length,
      highLevelCount: matches.filter(m => m.level === 'high').length,
      mediumLevelCount: matches.filter(m => m.level === 'medium').length,
      lowLevelCount: matches.filter(m => m.level === 'low').length,
    };

    return {
      matches,
      shouldBlock,
      blockReason,
      replacedContent: plainText,
      originalContent: input,
      stats,
    };
  }

  replaceInHtml(html: string, matches: SensitiveWordMatch[]): string {
    const replaceable = matches.filter(m => m.strategy === 'replace');
    if (replaceable.length === 0) return html;

    const { plainToHtmlMap } = buildHtmlPositionMap(html);
    const sorted = [...replaceable].sort((a, b) => a.start - b.start);

    const htmlReplacements: Array<{ start: number; end: number; originalLen: number }> = [];

    for (const match of sorted) {
      const htmlStart = plainToHtmlMap[match.start];
      const htmlEnd = plainToHtmlMap[match.end];
      if (htmlStart === undefined || htmlEnd === undefined) continue;
      htmlReplacements.push({ start: htmlStart, end: htmlEnd, originalLen: match.end - match.start });
    }

    if (htmlReplacements.length === 0) return html;

    htmlReplacements.sort((a, b) => a.start - b.start);

    let result = '';
    let lastHtmlIdx = 0;
    for (const repl of htmlReplacements) {
      if (repl.start >= lastHtmlIdx) {
        result += html.slice(lastHtmlIdx, repl.start);
        result += SENSITIVE_WORD_DEFAULTS.REPLACEMENT_CHAR.repeat(repl.originalLen);
        lastHtmlIdx = repl.end;
      }
    }
    result += html.slice(lastHtmlIdx);
    return result;
  }

  replaceInPlainText(text: string, matches: SensitiveWordMatch[]): string {
    const replaceable = matches.filter(m => m.strategy === 'replace');
    if (replaceable.length === 0) return text;

    let result = '';
    let lastIndex = 0;
    const sorted = [...replaceable].sort((a, b) => a.start - b.start);

    for (const match of sorted) {
      if (match.start >= lastIndex) {
        result += text.slice(lastIndex, match.start);
        result += SENSITIVE_WORD_DEFAULTS.REPLACEMENT_CHAR.repeat(match.end - match.start);
        lastIndex = match.end;
      }
    }

    result += text.slice(lastIndex);
    return result;
  }

  buildHighlightSegments(
    html: string,
    matches: SensitiveWordMatch[]
  ): HighlightSegment[] {
    if (matches.length === 0) return [];

    const { plainToHtmlMap, htmlToPlainMap, plainText } = buildHtmlPositionMap(html);
    const sorted = [...matches].sort((a, b) => a.start - b.start);

    const segments: HighlightSegment[] = [];
    for (const match of sorted) {
      const htmlStart = plainToHtmlMap[match.start];
      const htmlEnd = plainToHtmlMap[match.end];
      if (htmlStart === undefined || htmlEnd === undefined) continue;

      const overlapsTag = this.hasTagBetween(html, htmlStart, htmlEnd);
      segments.push({
        plainStart: match.start,
        plainEnd: match.end,
        htmlStart,
        htmlEnd,
        level: match.level,
        word: match.word,
        originalText: match.originalText,
        overlapsTag,
        highlightClass: LEVEL_TO_HIGHLIGHT_CLASS[match.level],
        backgroundColor: LEVEL_HL_COLOR[match.level],
        borderColor: LEVEL_BORDER_COLOR[match.level],
      });
    }

    return segments;
  }

  private hasTagBetween(html: string, start: number, end: number): boolean {
    const slice = html.slice(start, end);
    return /<[^>]+>/.test(slice);
  }

  wrapHighlightInHtml(html: string, segments: HighlightSegment[]): string {
    if (segments.length === 0) return html;

    const cleanSegs = segments.filter(s => !s.overlapsTag).sort((a, b) => a.htmlStart - b.htmlStart);
    if (cleanSegs.length === 0) return html;

    let result = '';
    let lastIdx = 0;

    for (const seg of cleanSegs) {
      if (seg.htmlStart >= lastIdx) {
        result += html.slice(lastIdx, seg.htmlStart);
        result += `<span data-sensitive-word="${escapeAttr(seg.word)}" data-level="${seg.level}" style="background:${seg.backgroundColor};border:1px solid ${seg.borderColor};border-radius:2px;padding:0 2px;">`;
        result += html.slice(seg.htmlStart, seg.htmlEnd);
        result += '</span>';
        lastIdx = seg.htmlEnd;
      }
    }

    result += html.slice(lastIdx);
    return result;
  }

  getQuillHighlightRanges(html: string, matches: SensitiveWordMatch[]): Array<{
    index: number;
    length: number;
    level: string;
    word: string;
  }> {
    if (matches.length === 0) return [];
    const { plainToQuillMap } = buildHtmlPositionMap(html);
    const sorted = [...matches].sort((a, b) => a.start - b.start);

    const ranges: Array<{ index: number; length: number; level: string; word: string }> = [];
    for (const match of sorted) {
      const quillStart = plainToQuillMap[match.start];
      const quillEnd = plainToQuillMap[match.end];
      if (quillStart === undefined || quillEnd === undefined) continue;
      ranges.push({
        index: quillStart,
        length: quillEnd - quillStart,
        level: match.level,
        word: match.word,
      });
    }
    return ranges;
  }

  getWords(): SensitiveWord[] {
    return [...this.words];
  }
}

function buildHtmlPositionMap(html: string): {
  plainToHtmlMap: number[];
  htmlToPlainMap: number[];
  plainToQuillMap: number[];
  plainText: string;
} {
  const plainToHtmlMap: number[] = [];
  const htmlToPlainMap: number[] = [];
  const plainToQuillMap: number[] = [];
  let plainText = '';

  let inTag = false;
  let tagName = '';
  let inAttr = false;
  let attrQuote = '';
  let inEntity = false;
  let entityBuf = '';
  const skipTags = new Set(['script', 'style', 'noscript']);
  let inSkipTag: string | null = null;
  let quillOffset = 0;

  const pushPlainChar = (char: string, htmlOffset: number, quillDelta: number = 1) => {
    plainToHtmlMap.push(htmlOffset);
    htmlToPlainMap[htmlOffset] = plainText.length;
    plainToQuillMap.push(quillOffset);
    plainText += char;
    quillOffset += quillDelta;
  };

  for (let i = 0; i < html.length; i++) {
    htmlToPlainMap[i] = plainText.length;
    const ch = html[i];

    if (inSkipTag !== null) {
      if (ch === '<') {
        const tagLen = inSkipTag.length;
        const closeTag = `/${inSkipTag}>`;
        if (html.slice(i + 1, i + 2 + tagLen).toLowerCase() === closeTag) {
          inSkipTag = null;
          i += tagLen + 1;
        }
      }
      continue;
    }

    if (inTag) {
      if (inAttr) {
        if (ch === attrQuote) {
          inAttr = false;
          attrQuote = '';
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inAttr = true;
        attrQuote = ch;
        continue;
      }
      if (ch === '>') {
        inTag = false;
        tagName = tagName.toLowerCase().trim();

        if (skipTags.has(tagName)) {
          inSkipTag = tagName;
          tagName = '';
          continue;
        }

        if (tagName === 'br' || tagName === '/p' || tagName === '/div' || tagName === '/h1' || tagName === '/h2' || tagName === '/h3' || tagName === '/li' || tagName === '/tr') {
          pushPlainChar('\n', i, 1);
        } else if (tagName === 'p' || tagName === 'div' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'li' || tagName === 'tr') {
          if (plainText.length > 0 && !plainText.endsWith('\n')) {
            pushPlainChar('\n', i, 1);
          }
        } else if (tagName === 'img') {
          pushPlainChar(' ', i, 1);
        }
        tagName = '';
        continue;
      }
      tagName += ch;
      continue;
    }

    if (inEntity) {
      if (ch === ';') {
        inEntity = false;
        const decoded = decodeEntity(entityBuf);
        if (decoded) {
          if (decoded === '\n') {
            pushPlainChar('\n', i, 1);
          } else {
            for (let k = 0; k < decoded.length; k++) {
              pushPlainChar(decoded[k], i, k === decoded.length - 1 ? 1 : 0);
            }
          }
        }
        entityBuf = '';
        continue;
      }
      if (/[a-zA-Z0-9#]/.test(ch)) {
        entityBuf += ch;
        continue;
      }
      inEntity = false;
      entityBuf = '';
    }

    if (ch === '<') {
      inTag = true;
      tagName = '';
      continue;
    }

    if (ch === '&') {
      inEntity = true;
      entityBuf = '';
      continue;
    }

    pushPlainChar(ch, i, 1);
  }
  htmlToPlainMap[html.length] = plainText.length;
  plainToHtmlMap.push(html.length);
  plainToQuillMap.push(quillOffset);

  return { plainToHtmlMap, htmlToPlainMap, plainToQuillMap, plainText };
}

function decodeEntity(entity: string): string | null {
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
    copy: '©', reg: '®', trade: '™',
    hellip: '…', mdash: '—', ndash: '–',
    lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"',
    bull: '•', middot: '·',
  };
  if (entities[entity]) return entities[entity];
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const code = parseInt(entity.slice(2), 16);
    if (!isNaN(code)) return String.fromCharCode(code);
  }
  if (entity.startsWith('#')) {
    const code = parseInt(entity.slice(1), 10);
    if (!isNaN(code)) return String.fromCharCode(code);
  }
  return null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function normalizeText(text: string): string {
  if (!text) return '';

  let result = text.toLowerCase();

  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  });

  const fullwidthMap: Record<string, string> = {
    '，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':',
    '（': '(', '）': ')', '【': '[', '】': ']', '「': '[', '」': ']',
    '『': '[', '』': ']', '《': '<', '》': '>', '〈': '<', '〉': '>',
    '、': '/', '　': ' ', '・': '.', '～': '~', '—': '-', '…': '...',
    '“': '"', '”': '"', '‘': "'", '’': "'",
  };

  result = result.replace(/./g, function(ch) {
    return fullwidthMap[ch] || ch;
  });

  result = result.replace(/\s+/g, '');

  return result;
}

export function extractPlainText(html: string): string {
  return stripHtml(html);
}

export function buildPositionMapForDebug(html: string): ReturnType<typeof buildHtmlPositionMap> {
  return buildHtmlPositionMap(html);
}

let globalDetector: SensitiveWordDetector | null = null;

export function getGlobalDetector(words?: SensitiveWord[]): SensitiveWordDetector {
  if (!globalDetector) {
    globalDetector = new SensitiveWordDetector(words || []);
  } else if (words) {
    globalDetector.setWords(words);
  }
  return globalDetector;
}

export { LEVEL_HL_COLOR, LEVEL_BORDER_COLOR, LEVEL_TO_HIGHLIGHT_CLASS };
