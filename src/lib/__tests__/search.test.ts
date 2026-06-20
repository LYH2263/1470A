import { describe, it, expect } from 'vitest';
import { stripHtml, tokenizeChinese, buildFtsQuery } from '@/lib/html-utils';

describe('stripHtml - HTML标签剥离', () => {
  it('应该移除基本的HTML标签', () => {
    expect(stripHtml('<p>Hello World</p>')).toBe('Hello World');
  });

  it('应该处理嵌套标签', () => {
    expect(stripHtml('<div><p>Hello</p><p>World</p></div>')).toBe('Hello World');
  });

  it('应该将换行标签转为空格', () => {
    expect(stripHtml('Line1<br/>Line2')).toBe('Line1 Line2');
  });

  it('应该处理HTML实体', () => {
    expect(stripHtml('A&nbsp;B&amp;C')).toBe('A B&C');
  });

  it('应该处理空字符串', () => {
    expect(stripHtml('')).toBe('');
  });

  it('应该处理纯文本（无HTML）', () => {
    expect(stripHtml('Hello World')).toBe('Hello World');
  });

  it('应该合并连续空格', () => {
    expect(stripHtml('<p>A</p>  <p>B</p>')).toBe('A B');
  });

  it('应该处理自闭合标签', () => {
    expect(stripHtml('Text<img src="x"/>More')).toBe('TextMore');
  });
});

describe('tokenizeChinese - 中文分词', () => {
  it('应该将中文字符逐字拆分', () => {
    expect(tokenizeChinese('你好世界')).toBe('你 好 世 界');
  });

  it('应该保留英文单词完整性', () => {
    expect(tokenizeChinese('hello world')).toBe('hello world');
  });

  it('应该混合处理中英文', () => {
    expect(tokenizeChinese('你好hello世界')).toBe('你 好 hello 世 界');
  });

  it('应该处理数字', () => {
    expect(tokenizeChinese('文章123内容')).toBe('文 章 123 内 容');
  });

  it('应该处理空字符串', () => {
    expect(tokenizeChinese('')).toBe('');
  });

  it('应该忽略标点符号', () => {
    expect(tokenizeChinese('你好，世界！')).toBe('你 好 世 界');
  });
});

describe('buildFtsQuery - FTS5查询构建', () => {
  it('应该构建单个词的前缀查询', () => {
    expect(buildFtsQuery('测试')).toBe('"测试"*');
  });

  it('应该构建多个词的AND查询', () => {
    expect(buildFtsQuery('测试 文章')).toBe('"测试"* AND "文章"*');
  });

  it('应该转义双引号', () => {
    expect(buildFtsQuery('测试"文章')).toBe('"测试""文章"*');
  });

  it('应该忽略多余的空格', () => {
    expect(buildFtsQuery('测试  文章')).toBe('"测试"* AND "文章"*');
  });

  it('应该处理单个词', () => {
    expect(buildFtsQuery('hello')).toBe('"hello"*');
  });
});
