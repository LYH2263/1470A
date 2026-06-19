import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { Article, ArticleFormData, ArticleListQuery, ArticleListResponse } from '@/types/article';

// 辅助函数：将 Prisma 模型转换为 DTO
function mapArticleToDTO(article: {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  importance: string;
  views: number;
  content: string;
}): Article {
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    createdAt: article.createdAt.toISOString(),
    importance: article.importance as 'low' | 'medium' | 'high',
    views: article.views,
    content: article.content,
  };
}

// 获取文章列表（支持分页和搜索）
export async function getArticles(query: ArticleListQuery): Promise<ArticleListResponse> {
  const { page, pageSize, keyword } = query;

  // 构建查询条件
  const where = keyword
    ? {
        title: {
          contains: keyword,
        },
      }
    : {};

  // 获取总数和分页数据（并行执行）
  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // 转换数据格式
  const data = articles.map(mapArticleToDTO);

  return {
    data,
    total,
    page,
    pageSize,
  };
}

// 根据 ID 获取文章
export async function getArticleById(id: string): Promise<Article | null> {
  const article = await prisma.article.findUnique({
    where: { id },
  });

  if (!article) {
    return null;
  }

  return mapArticleToDTO(article);
}

// 创建文章
export async function createArticle(data: ArticleFormData): Promise<Article> {
  const article = await prisma.article.create({
    data: {
      title: data.title,
      author: data.author,
      createdAt: new Date(data.createdAt),
      importance: data.importance,
      content: data.content,
      views: 0,
    },
  });

  return mapArticleToDTO(article);
}

// 更新文章
export async function updateArticle(id: string, data: ArticleFormData): Promise<Article | null> {
  try {
    const article = await prisma.article.update({
      where: { id },
      data: {
        title: data.title,
        author: data.author,
        createdAt: new Date(data.createdAt),
        importance: data.importance,
        content: data.content,
      },
    });

    return mapArticleToDTO(article);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code === 'P2025'
    ) {
      return null;
    }

    console.error('更新文章失败:', error);
    throw error;
  }
}

// 删除文章（支持批量删除）
export async function deleteArticles(ids: string[]): Promise<number> {
  const result = await prisma.article.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });

  return result.count;
}
