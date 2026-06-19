import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type {
  Article,
  ArticleFormData,
  ArticleListQuery,
  ArticleListResponse,
  ArticleEditLock,
  LockOwner,
  LockStatus,
  UpdateArticleWithOptimisticLock,
} from '@/types/article';
import { LOCK_CONSTANTS } from '@/types/article';

// 辅助函数：将 Prisma 模型转换为 DTO
function mapArticleToDTO(article: {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  importance: string;
  views: number;
  content: string;
  updatedAt: Date;
}): Article {
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    createdAt: article.createdAt.toISOString(),
    importance: article.importance as 'low' | 'medium' | 'high',
    views: article.views,
    content: article.content,
    updatedAt: article.updatedAt.toISOString(),
  };
}

function mapLockToDTO(lock: {
  id: string;
  articleId: string;
  userId: string;
  sessionId: string;
  expiresAt: Date;
  lastHeartbeat: Date;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
}): ArticleEditLock {
  return {
    id: lock.id,
    articleId: lock.articleId,
    userId: lock.userId,
    sessionId: lock.sessionId,
    expiresAt: lock.expiresAt.toISOString(),
    lastHeartbeat: lock.lastHeartbeat.toISOString(),
    user: lock.user as LockOwner,
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

// 获取文章编辑锁状态
export async function getLockStatus(
  articleId: string,
  currentUserId: string
): Promise<LockStatus> {
  const now = new Date();

  const lock = await prisma.articleEditLock.findUnique({
    where: { articleId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!lock) {
    return {
      isLocked: false,
      isLockedByMe: false,
    };
  }

  if (lock.expiresAt < now) {
    await prisma.articleEditLock.delete({
      where: { id: lock.id },
    });
    return {
      isLocked: false,
      isLockedByMe: false,
    };
  }

  const lockDTO = mapLockToDTO(lock);

  return {
    isLocked: true,
    isLockedByMe: lock.userId === currentUserId,
    lock: lockDTO,
    expiresAt: lockDTO.expiresAt,
  };
}

// 申请编辑锁
export async function acquireLock(
  articleId: string,
  userId: string,
  sessionId: string
): Promise<{ acquired: boolean; lock?: ArticleEditLock; error?: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_CONSTANTS.LOCK_DURATION_MS);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingLock = await tx.articleEditLock.findUnique({
        where: { articleId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },
        },
      });

      if (existingLock && existingLock.expiresAt > now) {
        if (existingLock.userId === userId && existingLock.sessionId === sessionId) {
          const updatedLock = await tx.articleEditLock.update({
            where: { id: existingLock.id },
            data: {
              expiresAt,
              lastHeartbeat: now,
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                },
              },
            },
          });
          return { acquired: true, lock: mapLockToDTO(updatedLock) };
        }

        if (existingLock.userId === userId && existingLock.sessionId !== sessionId) {
          const updatedLock = await tx.articleEditLock.update({
            where: { id: existingLock.id },
            data: {
              sessionId,
              expiresAt,
              lastHeartbeat: now,
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  role: true,
                },
              },
            },
          });
          return { acquired: true, lock: mapLockToDTO(updatedLock) };
        }

        return {
          acquired: false,
          lock: mapLockToDTO(existingLock),
          error: '文章已被其他用户占用',
        };
      }

      if (existingLock && existingLock.expiresAt <= now) {
        await tx.articleEditLock.delete({
          where: { id: existingLock.id },
        });
      }

      const article = await tx.article.findUnique({
        where: { id: articleId },
        select: { id: true },
      });

      if (!article) {
        return { acquired: false, error: '文章不存在' };
      }

      const newLock = await tx.articleEditLock.create({
        data: {
          articleId,
          userId,
          sessionId,
          expiresAt,
          lastHeartbeat: now,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return { acquired: true, lock: mapLockToDTO(newLock) };
    });

    return result;
  } catch (error) {
    console.error('申请锁失败:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const lock = await prisma.articleEditLock.findUnique({
        where: { articleId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },
        },
      });
      if (lock) {
        return {
          acquired: false,
          lock: mapLockToDTO(lock),
          error: '文章已被其他用户占用',
        };
      }
    }
    return { acquired: false, error: '申请锁失败' };
  }
}

// 心跳续约
export async function renewLock(
  articleId: string,
  userId: string,
  sessionId: string
): Promise<{ renewed: boolean; expiresAt?: string; error?: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_CONSTANTS.LOCK_DURATION_MS);

  try {
    const lock = await prisma.articleEditLock.findUnique({
      where: { articleId },
    });

    if (!lock) {
      return { renewed: false, error: '锁不存在' };
    }

    if (lock.expiresAt < now) {
      await prisma.articleEditLock.delete({
        where: { id: lock.id },
      });
      return { renewed: false, error: '锁已过期' };
    }

    if (lock.userId !== userId || lock.sessionId !== sessionId) {
      return { renewed: false, error: '无权限续约此锁' };
    }

    await prisma.articleEditLock.update({
      where: { id: lock.id },
      data: {
        expiresAt,
        lastHeartbeat: now,
      },
    });

    return { renewed: true, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error('心跳续约失败:', error);
    return { renewed: false, error: '心跳续约失败' };
  }
}

// 释放锁
export async function releaseLock(
  articleId: string,
  userId: string,
  sessionId: string
): Promise<{ released: boolean; error?: string }> {
  try {
    const lock = await prisma.articleEditLock.findUnique({
      where: { articleId },
    });

    if (!lock) {
      return { released: true };
    }

    if (lock.userId !== userId || lock.sessionId !== sessionId) {
      return { released: false, error: '无权限释放此锁' };
    }

    await prisma.articleEditLock.delete({
      where: { id: lock.id },
    });

    return { released: true };
  } catch (error) {
    console.error('释放锁失败:', error);
    return { released: false, error: '释放锁失败' };
  }
}

// Admin 强制夺锁
export async function stealLock(
  articleId: string,
  userId: string,
  sessionId: string,
  isAdmin: boolean
): Promise<{ stolen: boolean; lock?: ArticleEditLock; error?: string }> {
  if (!isAdmin) {
    return { stolen: false, error: '只有管理员可以强制夺锁' };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_CONSTANTS.LOCK_DURATION_MS);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingLock = await tx.articleEditLock.findUnique({
        where: { articleId },
      });

      if (existingLock) {
        await tx.articleEditLock.delete({
          where: { id: existingLock.id },
        });
      }

      const newLock = await tx.articleEditLock.create({
        data: {
          articleId,
          userId,
          sessionId,
          expiresAt,
          lastHeartbeat: now,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return { stolen: true, lock: mapLockToDTO(newLock) };
    });

    return result;
  } catch (error) {
    console.error('强制夺锁失败:', error);
    return { stolen: false, error: '强制夺锁失败' };
  }
}

// 带乐观锁的文章更新
export async function updateArticleWithOptimisticLock(
  id: string,
  data: UpdateArticleWithOptimisticLock
): Promise<{
  success: boolean;
  article?: Article;
  error?: string;
  conflict?: boolean;
  currentArticle?: Article;
}> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const article = await tx.article.findUnique({
        where: { id },
      });

      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      const clientUpdatedAt = new Date(data.lastUpdatedAt);
      const dbUpdatedAt = article.updatedAt;

      if (Math.abs(clientUpdatedAt.getTime() - dbUpdatedAt.getTime()) > 1000) {
        return {
          success: false,
          error: '文章已被其他用户修改，请刷新后重试',
          conflict: true,
          currentArticle: mapArticleToDTO(article),
        };
      }

      const updatedArticle = await tx.article.update({
        where: { id },
        data: {
          title: data.title,
          author: data.author,
          createdAt: new Date(data.createdAt),
          importance: data.importance,
          content: data.content,
        },
      });

      return { success: true, article: mapArticleToDTO(updatedArticle) };
    });

    return result;
  } catch (error: unknown) {
    console.error('更新文章失败:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: '文章不存在' };
    }
    throw error;
  }
}

// 清理过期锁（定时任务调用）
export async function cleanExpiredLocks(): Promise<number> {
  const now = new Date();
  const result = await prisma.articleEditLock.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });
  return result.count;
}
