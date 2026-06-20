import { describe, it, expect, beforeEach } from 'vitest';
import {
  SensitiveWordDetector,
  normalizeText,
  extractPlainText,
} from '@/lib/sensitive-word-detector';
import type { SensitiveWord } from '@/types/sensitive-word';

const createMockWord = (partial: Partial<SensitiveWord> = {}): SensitiveWord => ({
  id: 'test-id',
  word: '测试',
  category: 'other',
  level: 'medium',
  strategy: 'replace',
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
});

describe('normalizeText 文本规范化', () => {
  it('应该将文本转换为小写', () => {
    expect(normalizeText('Hello World')).toBe('helloworld');
    expect(normalizeText('HELLO')).toBe('hello');
    expect(normalizeText('MixedCase')).toBe('mixedcase');
  });

  it('应该将全角字母数字转换为半角', () => {
    expect(normalizeText('ＡＢＣ１２３')).toBe('abc123');
    expect(normalizeText('ｘｙｚ')).toBe('xyz');
    expect(normalizeText('９９９')).toBe('999');
  });

  it('应该将全角标点转换为半角', () => {
    expect(normalizeText('你好，世界！')).toBe('你好,世界!');
    expect(normalizeText('测试（括号）')).toBe('测试(括号)');
    expect(normalizeText('【引号】')).toBe('[引号]');
    expect(normalizeText('《书名号》')).toBe('<书名号>');
  });

  it('应该移除所有空白字符', () => {
    expect(normalizeText('hello   world')).toBe('helloworld');
    expect(normalizeText('hello\nworld')).toBe('helloworld');
    expect(normalizeText('hello\tworld')).toBe('helloworld');
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('应该处理混合情况', () => {
    expect(normalizeText('Ｈｅｌｌｏ，　Ｗｏｒｌｄ！')).toBe('hello,world!');
    expect(normalizeText('测试ＡＢＣ１２３，。！')).toBe('测试abc123,.!');
  });

  it('应该处理空字符串', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText('   ')).toBe('');
  });
});

describe('extractPlainText HTML文本提取', () => {
  it('应该从简单HTML中提取纯文本', () => {
    expect(extractPlainText('<p>Hello World</p>')).toBe('Hello World');
    expect(extractPlainText('<h1>标题</h1>')).toBe('标题');
  });

  it('应该处理嵌套HTML标签', () => {
    expect(extractPlainText('<div><p>第一段</p><p>第二段</p></div>')).toBe('第一段 第二段');
  });

  it('应该处理HTML实体', () => {
    expect(extractPlainText('<p>你好 &amp; 世界</p>')).toBe('你好 & 世界');
    expect(extractPlainText('<p>&lt;script&gt;</p>')).toBe('<script>');
    expect(extractPlainText('<p>&nbsp;&quot;&#39;</p>')).toBe('"\'');
  });

  it('应该处理换行和段落分隔', () => {
    expect(extractPlainText('<p>第一行<br>第二行</p>')).toBe('第一行 第二行');
    expect(extractPlainText('<div>块1</div><div>块2</div>')).toBe('块1 块2');
  });

  it('应该处理空HTML', () => {
    expect(extractPlainText('')).toBe('');
    expect(extractPlainText('<p></p>')).toBe('');
  });
});

describe('SensitiveWordDetector 敏感词检测', () => {
  let detector: SensitiveWordDetector;

  beforeEach(() => {
    detector = new SensitiveWordDetector();
  });

  describe('基础匹配功能', () => {
    it('应该检测到单个敏感词', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('这是一段包含敏感词的文本');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].word).toBe('敏感词');
      expect(result.shouldBlock).toBe(true);
    });

    it('应该检测到多个不同的敏感词', () => {
      detector.setWords([
        createMockWord({ word: '敏感词1', id: '1', level: 'high', strategy: 'block' }),
        createMockWord({ word: '敏感词2', id: '2', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('文本包含敏感词1和敏感词2');
      expect(result.matches.length).toBe(2);
      expect(result.matches[0].word).toBe('敏感词1');
      expect(result.matches[1].word).toBe('敏感词2');
    });

    it('应该检测到同一个敏感词多次出现', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('敏感词出现了，敏感词又出现了');
      expect(result.matches.length).toBe(2);
    });
  });

  describe('变体处理', () => {
    it('应该忽略大小写差异', () => {
      detector.setWords([
        createMockWord({ word: 'Hello', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('这是 HELLO 世界');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].normalizedWord).toBe('hello');
    });

    it('应该处理全角半角变体', () => {
      detector.setWords([
        createMockWord({ word: 'abc123', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('这是ＡＢＣ１２３测试');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].normalizedWord).toBe('abc123');
    });

    it('应该处理带空格的变体', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('敏 感 词 测 试');
      expect(result.matches.length).toBe(1);
    });

    it('应该处理带HTML标签的内容', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('<p>这是<span>敏感</span>词</p>');
      expect(result.matches.length).toBe(1);
      expect(result.shouldBlock).toBe(true);
    });
  });

  describe('重叠词处理', () => {
    it('应该正确处理重叠的敏感词', () => {
      detector.setWords([
        createMockWord({ word: '中国', id: '1', level: 'low', strategy: 'warn' }),
        createMockWord({ word: '中国人', id: '2', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('我是中国人');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].word).toBe('中国人');
      expect(result.matches[0].level).toBe('high');
    });

    it('应该优先选择更高级别的敏感词', () => {
      detector.setWords([
        createMockWord({ word: '测试', id: '1', level: 'low', strategy: 'warn' }),
        createMockWord({ word: '测试敏感', id: '2', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('这是测试敏感词');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].word).toBe('测试敏感');
      expect(result.matches[0].level).toBe('high');
    });

    it('同级别时应该选择更长的匹配', () => {
      detector.setWords([
        createMockWord({ word: '测试', id: '1', level: 'medium', strategy: 'replace' }),
        createMockWord({ word: '测试词', id: '2', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('这是测试词');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].word).toBe('测试词');
    });
  });

  describe('策略处理', () => {
    it('block策略应该阻止发布', () => {
      detector.setWords([
        createMockWord({ word: '违禁词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('包含违禁词的文本');
      expect(result.shouldBlock).toBe(true);
      expect(result.blockReason).toContain('违禁词');
    });

    it('replace策略应该替换内容', () => {
      detector.setWords([
        createMockWord({ word: '广告', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('这是广告内容');
      expect(result.shouldBlock).toBe(false);
      expect(result.replacedContent).toBe('这是**内容');
    });

    it('warn策略只警告不阻止', () => {
      detector.setWords([
        createMockWord({ word: '提示词', level: 'low', strategy: 'warn' }),
      ]);

      const result = detector.detect('包含提示词的文本');
      expect(result.shouldBlock).toBe(false);
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].strategy).toBe('warn');
    });

    it('混合策略时只要有block就阻止', () => {
      detector.setWords([
        createMockWord({ word: '违禁词', id: '1', level: 'high', strategy: 'block' }),
        createMockWord({ word: '广告', id: '2', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('包含违禁词和广告的文本');
      expect(result.shouldBlock).toBe(true);
      expect(result.matches.length).toBe(2);
    });
  });

  describe('统计信息', () => {
    it('应该正确统计各级别匹配数', () => {
      detector.setWords([
        createMockWord({ word: '高危词', id: '1', level: 'high', strategy: 'block' }),
        createMockWord({ word: '中危词1', id: '2', level: 'medium', strategy: 'replace' }),
        createMockWord({ word: '中危词2', id: '3', level: 'medium', strategy: 'replace' }),
        createMockWord({ word: '低危词', id: '4', level: 'low', strategy: 'warn' }),
      ]);

      const result = detector.detect('高危词 中危词1 中危词2 低危词');
      expect(result.stats.totalMatches).toBe(4);
      expect(result.stats.highLevelCount).toBe(1);
      expect(result.stats.mediumLevelCount).toBe(2);
      expect(result.stats.lowLevelCount).toBe(1);
    });

    it('没有匹配时统计应该为0', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('正常文本');
      expect(result.stats.totalMatches).toBe(0);
      expect(result.stats.highLevelCount).toBe(0);
      expect(result.stats.mediumLevelCount).toBe(0);
      expect(result.stats.lowLevelCount).toBe(0);
    });
  });

  describe('禁用的敏感词', () => {
    it('不应该匹配被禁用的敏感词', () => {
      detector.setWords([
        createMockWord({ word: '禁用词', enabled: false, level: 'high', strategy: 'block' }),
        createMockWord({ word: '启用词', enabled: true, level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('禁用词和启用词');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].word).toBe('启用词');
    });
  });

  describe('性能测试', () => {
    it('应该高效处理大量敏感词', () => {
      const words: SensitiveWord[] = [];
      for (let i = 0; i < 1000; i++) {
        words.push(createMockWord({
          id: `word-${i}`,
          word: `敏感词${i}`,
          level: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
          strategy: i % 3 === 0 ? 'block' : i % 3 === 1 ? 'replace' : 'warn',
        }));
      }
      detector.setWords(words);

      const longText = Array.from({ length: 100 }, (_, i) => `敏感词${i}`).join(' ');
      const startTime = Date.now();
      const result = detector.detect(longText);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('应该高效处理长文本', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const longText = '正常文本 '.repeat(10000) + '敏感词' + ' 更多文本'.repeat(1000);
      const startTime = Date.now();
      const result = detector.detect(`<p>${longText}</p>`);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.matches.length).toBe(1);
    });
  });

  describe('边界情况', () => {
    it('应该处理空内容', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('');
      expect(result.matches.length).toBe(0);
      expect(result.shouldBlock).toBe(false);
    });

    it('应该处理只有HTML标签的内容', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'high', strategy: 'block' }),
      ]);

      const result = detector.detect('<p></p><div></div>');
      expect(result.matches.length).toBe(0);
    });

    it('词库为空时不应该匹配任何内容', () => {
      const emptyDetector = new SensitiveWordDetector([]);
      const result = emptyDetector.detect('任何内容都不应该匹配');
      expect(result.matches.length).toBe(0);
    });

    it('应该处理匹配位置正确', () => {
      detector.setWords([
        createMockWord({ word: '敏感词', level: 'medium', strategy: 'replace' }),
      ]);

      const result = detector.detect('前面的内容敏感词后面的内容');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].start).toBe(5);
      expect(result.matches[0].end).toBe(8);
      expect(result.matches[0].originalText).toBe('敏感词');
    });
  });
});

describe('getGlobalDetector 全局检测器', () => {
  it('应该返回同一个实例', async () => {
    const { getGlobalDetector } = await import('@/lib/sensitive-word-detector');
    const detector1 = getGlobalDetector();
    const detector2 = getGlobalDetector();
    expect(detector1).toBe(detector2);
  });
});
