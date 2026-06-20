import { stripHtml } from './html-utils';
import type {
  SensitiveWord,
  SensitiveWordMatch,
  SensitiveWordDetectionResult,
} from '@/types/sensitive-word';
import { SENSITIVE_WORD_DEFAULTS } from '@/types/sensitive-word';

interface AcNode {
  children: Map<string, AcNode>;
  fail: AcNode | null;
  output: SensitiveWord[];
}

function createAcNode(): AcNode {
  return {
    children: new Map(),
    fail: null,
    output: [],
  };
}

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

    for (const match of sorted) {
      if (match.start >= lastEnd) {
        result.push(match);
        lastEnd = match.end;
      } else {
        const existing = result[result.length - 1];
        const existingLen = existing.end - existing.start;
        const newLen = match.end - match.start;
        const levelOrder = { high: 3, medium: 2, low: 1 };
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

  detect(htmlContent: string): SensitiveWordDetectionResult {
    const plainText = stripHtml(htmlContent);
    const normalizedText = normalizeText(plainText);

    const matches = this.findAllMatches(normalizedText, plainText);

    const shouldBlock = matches.some(m => m.strategy === 'block');
    const blockMatch = matches.find(m => m.strategy === 'block');
    const blockReason = blockMatch 
      ? `内容包含敏感词「${blockMatch.word}」，禁止发布` 
      : null;

    const replacedContent = this.replaceMatches(plainText, matches);

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
      replacedContent,
      originalContent: plainText,
      stats,
    };
  }

  detectForEditor(htmlContent: string): SensitiveWordDetectionResult {
    return this.detect(htmlContent);
  }

  private replaceMatches(text: string, matches: SensitiveWordMatch[]): string {
    if (matches.length === 0) return text;

    const replaceable = matches.filter(m => m.strategy === 'replace');
    if (replaceable.length === 0) return text;

    let result = '';
    let lastIndex = 0;

    const sorted = [...replaceable].sort((a, b) => a.start - b.start);

    for (const match of sorted) {
      if (match.start >= lastIndex) {
        result += text.slice(lastIndex, match.start);
        const replacement = SENSITIVE_WORD_DEFAULTS.REPLACEMENT_CHAR.repeat(
          match.end - match.start
        );
        result += replacement;
        lastIndex = match.end;
      }
    }

    result += text.slice(lastIndex);
    return result;
  }

  getWords(): SensitiveWord[] {
    return [...this.words];
  }
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

let globalDetector: SensitiveWordDetector | null = null;

export function getGlobalDetector(words?: SensitiveWord[]): SensitiveWordDetector {
  if (!globalDetector) {
    globalDetector = new SensitiveWordDetector(words || []);
  } else if (words) {
    globalDetector.setWords(words);
  }
  return globalDetector;
}
