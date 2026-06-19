import { z } from 'zod';

// 文章数据验证 Schema
export const ArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(200, '标题不能超过200个字符'),
  author: z
    .string()
    .trim()
    .min(1, '作者不能为空')
    .max(50, '作者不能超过50个字符'),
  createdAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: '创建时间格式不正确',
    }),
  importance: z.enum(['low', 'medium', 'high'], {
    message: '重要性必须是 low、medium 或 high',
  }),
  content: z
    .string()
    .min(1, '内容不能为空'),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;
