import { describe, it, expect } from 'vitest';
import { formatDate, importanceMap } from '@/lib/utils';

describe('formatDate 函数', () => {
  describe('有效日期格式化', () => {
    it('应该正确格式化 ISO 日期字符串', () => {
      const date = '2024-01-15T10:30:00.000Z';
      const formatted = formatDate(date);

      // 实际格式: YYYY/MM/DD HH:mm (使用 toLocaleString)
      expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    it('应该正确格式化 Date 对象', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const formatted = formatDate(date.toISOString());

      // 实际格式: YYYY/MM/DD HH:mm
      expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    });

    it('应该保持日期的正确性', () => {
      const date = '2024-01-15T10:30:00.000Z';
      const formatted = formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('01');
      expect(formatted).toContain('15');
    });
  });

  describe('边界情况', () => {
    it('应该处理年初日期', () => {
      const date = '2024-01-01T00:00:00.000Z';
      const formatted = formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('01');
    });

    it('应该处理年末日期', () => {
      const date = '2024-12-31T23:59:59.999Z';
      const formatted = formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('12');
      expect(formatted).toContain('31');
    });

    it('应该处理闰年日期', () => {
      const date = '2024-02-29T12:00:00.000Z';
      const formatted = formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('02');
      expect(formatted).toContain('29');
    });
  });

  describe('时区处理', () => {
    it('应该正确处理不同时区的日期', () => {
      const dates = [
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T12:00:00.000Z',
        '2024-01-15T23:59:59.999Z',
      ];

      dates.forEach((date) => {
        const formatted = formatDate(date);
        // 实际格式: YYYY/MM/DD HH:mm
        expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
      });
    });
  });

  describe('格式一致性', () => {
    it('应该始终返回相同格式的字符串', () => {
      const dates = [
        '2024-01-01T00:00:00.000Z',
        '2024-06-15T12:30:45.000Z',
        '2024-12-31T23:59:59.999Z',
      ];

      dates.forEach((date) => {
        const formatted = formatDate(date);
        // 格式: YYYY/MM/DD HH:mm
        expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
      });
    });

    it('应该正确填充单位数字', () => {
      const date = '2024-01-05T03:04:05.000Z';
      const formatted = formatDate(date);

      // 确保月、日、时、分都是两位数
      const parts = formatted.split(/[\/\s:]/);
      parts.forEach((part) => {
        expect(part.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});

describe('importanceMap 配置', () => {
  describe('配置完整性', () => {
    it('应该包含所有重要性级别', () => {
      expect(importanceMap).toHaveProperty('low');
      expect(importanceMap).toHaveProperty('medium');
      expect(importanceMap).toHaveProperty('high');
    });

    it('每个级别应该有 label 和 color', () => {
      Object.values(importanceMap).forEach((config) => {
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('color');
        expect(typeof config.label).toBe('string');
        expect(typeof config.color).toBe('string');
      });
    });
  });

  describe('配置值验证', () => {
    it('low 级别应该有正确的配置', () => {
      expect(importanceMap.low.label).toBe('低');
      expect(importanceMap.low.color).toBe('default');
    });

    it('medium 级别应该有正确的配置', () => {
      expect(importanceMap.medium.label).toBe('中');
      expect(importanceMap.medium.color).toBe('warning');
    });

    it('high 级别应该有正确的配置', () => {
      expect(importanceMap.high.label).toBe('高');
      expect(importanceMap.high.color).toBe('error');
    });
  });

  describe('颜色值有效性', () => {
    it('所有颜色值应该是有效的 Ant Design 颜色', () => {
      const validColors = [
        'default',
        'success',
        'processing',
        'error',
        'warning',
        'blue',
        'red',
        'green',
        'yellow',
        'orange',
        'purple',
        'cyan',
        'magenta',
        'pink',
        'volcano',
        'gold',
        'lime',
        'geekblue',
      ];

      Object.values(importanceMap).forEach((config) => {
        expect(validColors).toContain(config.color);
      });
    });
  });

  describe('标签文本验证', () => {
    it('所有标签应该是非空字符串', () => {
      Object.values(importanceMap).forEach((config) => {
        expect(config.label).toBeTruthy();
        expect(config.label.length).toBeGreaterThan(0);
      });
    });

    it('标签应该是中文', () => {
      Object.values(importanceMap).forEach((config) => {
        // 检查是否包含中文字符
        expect(/[\u4e00-\u9fa5]/.test(config.label)).toBe(true);
      });
    });
  });

  describe('类型安全', () => {
    it('应该可以通过类型安全的方式访问', () => {
      const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      levels.forEach((level) => {
        const config = importanceMap[level];
        expect(config).toBeDefined();
        expect(config.label).toBeDefined();
        expect(config.color).toBeDefined();
      });
    });
  });
});
