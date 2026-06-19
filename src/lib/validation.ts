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
  status: z.enum(['draft', 'published'], {
    message: '状态必须是 draft 或 published',
  }),
  categoryId: z
    .string()
    .uuid('分类格式不正确')
    .optional()
    .nullable(),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;

export const CategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符'),
  sort: z
    .number()
    .int('排序必须是整数')
    .optional()
    .default(0),
  description: z
    .string()
    .max(200, '描述不能超过200个字符')
    .optional()
    .nullable(),
});

export const CategoryUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '分类名称不能为空')
    .max(50, '分类名称不能超过50个字符')
    .optional(),
  sort: z
    .number()
    .int('排序必须是整数')
    .optional(),
  description: z
    .string()
    .max(200, '描述不能超过200个字符')
    .optional()
    .nullable(),
});

export type CategoryInput = z.infer<typeof CategorySchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
