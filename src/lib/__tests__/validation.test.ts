import { describe, it, expect } from 'vitest';
import { ArticleSchema } from '@/lib/validation';
import { createMockArticleFormData } from '@/test/factories';

describe('ArticleSchema 验证', () => {
  describe('有效数据验证', () => {
    it('应该接受有效的文章数据', () => {
      const validData = createMockArticleFormData();
      const result = ArticleSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('应该接受所有重要性级别', () => {
      const importanceLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      importanceLevels.forEach((importance) => {
        const data = createMockArticleFormData({ importance });
        const result = ArticleSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.importance).toBe(importance);
        }
      });
    });

    it('应该接受有效的日期格式', () => {
      const validDates = [
        new Date().toISOString(),
        '2024-01-01T00:00:00.000Z',
        '2025-12-31T23:59:59.999Z',
      ];

      validDates.forEach((date) => {
        const data = createMockArticleFormData({ createdAt: date });
        const result = ArticleSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('标题验证', () => {
    it('应该拒绝空标题', () => {
      const data = createMockArticleFormData({ title: '' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('标题');
      }
    });

    it('应该拒绝只包含空格的标题', () => {
      const data = createMockArticleFormData({ title: '   ' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('应该接受包含特殊字符的标题', () => {
      const specialTitles = [
        '标题 <>&"\'',
        '标题 with emoji 🎉',
        '标题 with numbers 123',
      ];

      specialTitles.forEach((title) => {
        const data = createMockArticleFormData({ title });
        const result = ArticleSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('作者验证', () => {
    it('应该拒绝空作者', () => {
      const data = createMockArticleFormData({ author: '' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('作者');
      }
    });

    it('应该拒绝只包含空格的作者', () => {
      const data = createMockArticleFormData({ author: '   ' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('重要性验证', () => {
    it('应该拒绝无效的重要性级别', () => {
      const data = createMockArticleFormData({ importance: 'invalid' as any });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('应该拒绝空的重要性', () => {
      const data = createMockArticleFormData({ importance: '' as any });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('创建时间验证', () => {
    it('应该拒绝无效的日期格式', () => {
      const invalidDates = ['invalid-date', '2024-13-01', '2024-01-32', 'not a date'];

      invalidDates.forEach((date) => {
        const data = createMockArticleFormData({ createdAt: date });
        const result = ArticleSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    it('应该拒绝空的创建时间', () => {
      const data = createMockArticleFormData({ createdAt: '' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('内容验证', () => {
    it('应该拒绝空内容', () => {
      const data = createMockArticleFormData({ content: '' });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('内容');
      }
    });

    it('应该接受 HTML 内容', () => {
      const htmlContents = [
        '<p>简单段落</p>',
        '<h1>标题</h1><p>段落</p>',
        '<ul><li>列表项</li></ul>',
        '<img src="/test.jpg" alt="测试">',
      ];

      htmlContents.forEach((content) => {
        const data = createMockArticleFormData({ content });
        const result = ArticleSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    it('应该接受超长内容', () => {
      const longContent = '<p>' + 'A'.repeat(10000) + '</p>';
      const data = createMockArticleFormData({ content: longContent });
      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('缺失字段验证', () => {
    it('应该拒绝缺少必填字段的数据', () => {
      const requiredFields = ['title', 'author', 'createdAt', 'importance', 'content'];

      requiredFields.forEach((field) => {
        const data = createMockArticleFormData();
        delete (data as any)[field];

        const result = ArticleSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('额外字段验证', () => {
    it('应该忽略额外的字段', () => {
      const data = {
        ...createMockArticleFormData(),
        extraField: 'should be ignored',
        anotherExtra: 123,
      };

      const result = ArticleSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).extraField).toBeUndefined();
        expect((result.data as any).anotherExtra).toBeUndefined();
      }
    });
  });

  describe('边界情况', () => {
    it('应该处理 null 值', () => {
      const result = ArticleSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('应该处理 undefined 值', () => {
      const result = ArticleSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('应该处理空对象', () => {
      const result = ArticleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('应该处理数组', () => {
      const result = ArticleSchema.safeParse([]);
      expect(result.success).toBe(false);
    });
  });
});
