import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { stripHtml, tokenizeChinese, searchArticles } from './search';
import { safeReplaceContent, checkHtmlStructureSafety, sanitizeHtmlContent } from './batch-utils';
import type {
  Article,
  ArticleFormData,
  ArticleListQuery,
  ArticleListResponse,
  ArticleEditLock,
  LockOwner,
  LockStatus,
  UpdateArticleWithOptimisticLock,
  SearchHighlight,
  BatchOperationType,
  BatchOperationParams,
  BatchPreviewResult,
  ArticleDiffPreview,
  ArticleSnapshot,
  BatchOperationError,
  BatchExecuteResult,
  BatchOperationLog as BatchOperationLogType,
  BatchUndoResult,
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
  contentPlainText?: string;
  status: string;
  updatedAt: Date;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
}): Article {
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    createdAt: article.createdAt.toISOString(),
    importance: article.importance as 'low' | 'medium' | 'high',
    views: article.views,
    content: article.content,
    status: article.status as 'draft' | 'published',
    updatedAt: article.updatedAt.toISOString(),
    categoryId: article.categoryId,
    category: article.category || null,
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
  const { page, pageSize, keyword, categoryId, status = 'published' } = query;

  if (keyword && keyword.trim()) {
    const { data: ftsResults, total } = await searchArticles(keyword.trim(), page, pageSize, categoryId, status);

    const data: Article[] = ftsResults.map((row) => {
      const highlight: SearchHighlight = {};
      if (row.highlightTitle) highlight.title = row.highlightTitle;
      if (row.highlightAuthor) highlight.author = row.highlightAuthor;
      if (row.snippet) highlight.snippet = row.snippet;

      return {
        id: row.id,
        title: row.title,
        author: row.author,
        createdAt: row.createdAt,
        importance: row.importance as 'low' | 'medium' | 'high',
        views: row.views,
        content: row.content,
        status: row.status as 'draft' | 'published',
        updatedAt: row.updatedAt,
        categoryId: (row as any).categoryId || null,
        category: (row as any).category || null,
        ...(Object.keys(highlight).length > 0 ? { highlight } : {}),
      };
    });

    return { data, total, page, pageSize };
  }

  const where: any = {};
  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    where.categoryId = categoryId;
  } else if (categoryId === null) {
    where.categoryId = null;
  }
  if (status !== 'all') {
    where.status = status;
  }

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

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
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!article) {
    return null;
  }

  return mapArticleToDTO(article);
}

// 创建文章
export async function createArticle(data: ArticleFormData): Promise<Article> {
  const plainText = stripHtml(data.content);
  const tokenized = tokenizeChinese(plainText);

  const article = await prisma.article.create({
    data: {
      title: data.title,
      author: data.author,
      createdAt: new Date(data.createdAt),
      importance: data.importance,
      content: data.content,
      contentPlainText: tokenized,
      status: data.status,
      views: 0,
      categoryId: data.categoryId || null,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return mapArticleToDTO(article);
}

// 更新文章
export async function updateArticle(id: string, data: ArticleFormData): Promise<Article | null> {
  try {
    const plainText = stripHtml(data.content);
    const tokenized = tokenizeChinese(plainText);

    const article = await prisma.article.update({
      where: { id },
      data: {
        title: data.title,
        author: data.author,
        createdAt: new Date(data.createdAt),
        importance: data.importance,
        content: data.content,
        contentPlainText: tokenized,
        status: data.status,
        categoryId: data.categoryId || null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
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

// 删除文章（支持批量删除，支持按状态过滤）
export async function deleteArticles(ids: string[], status?: 'draft' | 'published'): Promise<number> {
  const where: any = {
    id: {
      in: ids,
    },
  };

  if (status) {
    where.status = status;
  }

  const result = await prisma.article.deleteMany({ where });

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
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
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
          contentPlainText: tokenizeChinese(stripHtml(data.content)),
          status: data.status,
          categoryId: data.categoryId || null,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
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

function snapshotArticle(article: {
  id: string;
  title: string;
  author: string;
  importance: string;
  content: string;
  contentPlainText: string;
  status: string;
  updatedAt: Date;
}): ArticleSnapshot {
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    importance: article.importance,
    content: article.content,
    contentPlainText: article.contentPlainText,
    status: article.status,
    updatedAt: article.updatedAt.toISOString(),
  };
}

export async function previewBatchOperation(
  articleIds: string[],
  operationType: BatchOperationType,
  params: BatchOperationParams
): Promise<BatchPreviewResult> {
  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } },
    select: {
      id: true,
      title: true,
      author: true,
      importance: true,
      content: true,
      contentPlainText: true,
      status: true,
      updatedAt: true,
    },
  });

  const previews: ArticleDiffPreview[] = [];
  const warnings: string[] = [];
  let changedCount = 0;

  for (const article of articles) {
    switch (operationType) {
      case 'batch_update_author': {
        const newAuthor = (params as { author: string }).author;
        const hasChange = article.author !== newAuthor;
        if (hasChange) changedCount++;
        previews.push({
          articleId: article.id,
          articleTitle: article.title,
          field: 'author',
          oldValue: article.author,
          newValue: newAuthor,
          hasChange,
        });
        break;
      }
      case 'batch_update_importance': {
        const newImportance = (params as { importance: string }).importance;
        const hasChange = article.importance !== newImportance;
        if (hasChange) changedCount++;
        previews.push({
          articleId: article.id,
          articleTitle: article.title,
          field: 'importance',
          oldValue: article.importance,
          newValue: newImportance,
          hasChange,
        });
        break;
      }
      case 'batch_append_footer': {
        const footerHtml = (params as { footerHtml: string }).footerHtml;
        const safeFooter = sanitizeHtmlContent(footerHtml);
        const newContent = article.content + safeFooter;
        const hasChange = article.content !== newContent;
        if (hasChange) changedCount++;
        
        const safetyCheck = checkHtmlStructureSafety(article.content, newContent);
        if (!safetyCheck.isSafe) {
          warnings.push(`文章「${article.title}」: ${safetyCheck.warnings.join('; ')}`);
        }
        
        previews.push({
          articleId: article.id,
          articleTitle: article.title,
          field: 'content',
          oldValue: article.content,
          newValue: newContent,
          hasChange,
        });
        break;
      }
      case 'batch_replace_content': {
        const { pattern, replacement, isRegex, caseSensitive } = params as {
          pattern: string;
          replacement: string;
          isRegex: boolean;
          caseSensitive?: boolean;
        };
        
        try {
          const result = safeReplaceContent(
            article.content,
            pattern,
            replacement,
            isRegex,
            caseSensitive
          );
          
          const hasChange = result.replaceCount > 0;
          if (hasChange) changedCount++;
          
          if (hasChange) {
            const safetyCheck = checkHtmlStructureSafety(article.content, result.text);
            if (!safetyCheck.isSafe) {
              warnings.push(`文章「${article.title}」: ${safetyCheck.warnings.join('; ')}`);
            }
          }
          
          previews.push({
            articleId: article.id,
            articleTitle: article.title,
            field: 'content',
            oldValue: article.content,
            newValue: result.text,
            hasChange,
          });
        } catch (error) {
          warnings.push(`文章「${article.title}」替换失败: ${error instanceof Error ? error.message : '未知错误'}`);
          previews.push({
            articleId: article.id,
            articleTitle: article.title,
            field: 'content',
            oldValue: article.content,
            newValue: article.content,
            hasChange: false,
          });
        }
        break;
      }
      case 'batch_delete': {
        changedCount = articles.length;
        previews.push({
          articleId: article.id,
          articleTitle: article.title,
          field: 'deleted',
          oldValue: article.title,
          newValue: '(已删除)',
          hasChange: true,
        });
        break;
      }
    }
  }

  return {
    articleIds: articles.map(a => a.id),
    articleCount: articles.length,
    changedCount,
    previews,
    warnings,
  };
}

export async function executeBatchOperation(
  articleIds: string[],
  operationType: BatchOperationType,
  params: BatchOperationParams,
  operatorId: string,
  operatorName: string
): Promise<BatchExecuteResult> {
  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } },
  });

  const snapshots: ArticleSnapshot[] = articles.map(snapshotArticle);
  
  const errors: BatchOperationError[] = [];
  let successCount = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txErrors: BatchOperationError[] = [];
      let txSuccessCount = 0;

      for (const article of articles) {
        try {
          switch (operationType) {
            case 'batch_update_author': {
              await tx.article.update({
                where: { id: article.id },
                data: { author: (params as { author: string }).author },
              });
              break;
            }
            case 'batch_update_importance': {
              await tx.article.update({
                where: { id: article.id },
                data: { importance: (params as { importance: string }).importance },
              });
              break;
            }
            case 'batch_append_footer': {
              const footerHtml = (params as { footerHtml: string }).footerHtml;
              const safeFooter = sanitizeHtmlContent(footerHtml);
              const newContent = article.content + safeFooter;
              const newPlainText = tokenizeChinese(stripHtml(newContent));
              await tx.article.update({
                where: { id: article.id },
                data: { 
                  content: newContent,
                  contentPlainText: newPlainText,
                },
              });
              break;
            }
            case 'batch_replace_content': {
              const { pattern, replacement, isRegex, caseSensitive } = params as {
                pattern: string;
                replacement: string;
                isRegex: boolean;
                caseSensitive?: boolean;
              };
              const result = safeReplaceContent(
                article.content,
                pattern,
                replacement,
                isRegex,
                caseSensitive
              );
              const newPlainText = tokenizeChinese(stripHtml(result.text));
              await tx.article.update({
                where: { id: article.id },
                data: { 
                  content: result.text,
                  contentPlainText: newPlainText,
                },
              });
              break;
            }
            case 'batch_delete': {
              await tx.article.delete({ where: { id: article.id } });
              break;
            }
          }
          txSuccessCount++;
        } catch (error) {
          txErrors.push({
            articleId: article.id,
            articleTitle: article.title,
            error: error instanceof Error ? error.message : '操作失败',
          });
        }
      }

      if (txErrors.length > 0 && txSuccessCount > 0) {
        return { successCount: txSuccessCount, errors: txErrors, partialSuccess: true };
      } else if (txErrors.length > 0) {
        throw new Error(`全部操作失败: ${txErrors.map(e => e.error).join(', ')}`);
      }

      return { successCount: txSuccessCount, errors: txErrors, partialSuccess: false };
    }, {
      timeout: 30000,
    });

    successCount = result.successCount;
    errors.push(...result.errors);
  } catch (error) {
    return {
      success: false,
      successCount: 0,
      failureCount: articles.length,
      totalCount: articles.length,
      errors: articles.map(a => ({
        articleId: a.id,
        articleTitle: a.title,
        error: error instanceof Error ? error.message : '事务执行失败',
      })),
      status: 'failed',
    };
  }

  const failureCount = errors.length;
  const status: 'success' | 'partial_failure' | 'failed' = 
    failureCount === 0 ? 'success' : 
    successCount > 0 ? 'partial_failure' : 'failed';

  const log = await prisma.batchOperationLog.create({
    data: {
      operationType,
      operatorId,
      operatorName,
      articleIds: JSON.stringify(articles.map(a => a.id)),
      articleCount: articles.length,
      params: JSON.stringify(params),
      snapshots: JSON.stringify(snapshots),
      status,
      successCount,
      failureCount,
      errorDetails: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return {
    success: status !== 'failed',
    operationId: log.id,
    successCount,
    failureCount,
    totalCount: articles.length,
    errors,
    status,
  };
}

export async function getLatestBatchOperation(
  operatorId: string
): Promise<BatchOperationLogType | null> {
  const log = await prisma.batchOperationLog.findFirst({
    where: { 
      operatorId,
      status: { in: ['success', 'partial_failure'] },
      reverted: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!log) return null;

  return {
    id: log.id,
    operationType: log.operationType as BatchOperationType,
    operatorId: log.operatorId,
    operatorName: log.operatorName,
    articleIds: JSON.parse(log.articleIds),
    articleCount: log.articleCount,
    params: JSON.parse(log.params) as BatchOperationParams,
    status: log.status as 'success' | 'partial_failure' | 'failed',
    successCount: log.successCount,
    failureCount: log.failureCount,
    errorDetails: log.errorDetails ? JSON.parse(log.errorDetails) as BatchOperationError[] : undefined,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    reverted: log.reverted,
    revertedAt: log.revertedAt?.toISOString(),
  };
}

export async function undoBatchOperation(
  operationId: string,
  operatorId: string
): Promise<BatchUndoResult> {
  const log = await prisma.batchOperationLog.findUnique({
    where: { id: operationId },
  });

  if (!log) {
    return {
      success: false,
      restoredCount: 0,
      failureCount: 0,
      errors: [{ articleId: '', articleTitle: '', error: '操作记录不存在' }],
    };
  }

  if (log.reverted) {
    return {
      success: false,
      restoredCount: 0,
      failureCount: 0,
      errors: [{ articleId: '', articleTitle: '', error: '该操作已被撤销' }],
    };
  }

  if (log.operatorId !== operatorId) {
    return {
      success: false,
      restoredCount: 0,
      failureCount: 0,
      errors: [{ articleId: '', articleTitle: '', error: '只能撤销自己执行的批量操作' }],
    };
  }

  const snapshots: ArticleSnapshot[] = JSON.parse(log.snapshots);
  const errors: BatchOperationError[] = [];
  let restoredCount = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const snapshot of snapshots) {
        try {
          const existing = await tx.article.findUnique({
            where: { id: snapshot.id },
          });

          if (!existing && log.operationType === 'batch_delete') {
            await tx.article.create({
              data: {
                id: snapshot.id,
                title: snapshot.title,
                author: snapshot.author,
                importance: snapshot.importance,
                content: snapshot.content,
                contentPlainText: snapshot.contentPlainText,
                status: snapshot.status,
                createdAt: new Date(snapshot.updatedAt),
                updatedAt: new Date(snapshot.updatedAt),
                views: 0,
              },
            });
            restoredCount++;
          } else if (existing) {
            await tx.article.update({
              where: { id: snapshot.id },
              data: {
                title: snapshot.title,
                author: snapshot.author,
                importance: snapshot.importance,
                content: snapshot.content,
                contentPlainText: snapshot.contentPlainText,
                status: snapshot.status,
              },
            });
            restoredCount++;
          } else {
            errors.push({
              articleId: snapshot.id,
              articleTitle: snapshot.title,
              error: '文章不存在，无法恢复',
            });
          }
        } catch (error) {
          errors.push({
            articleId: snapshot.id,
            articleTitle: snapshot.title,
            error: error instanceof Error ? error.message : '恢复失败',
          });
        }
      }
    }, {
      timeout: 30000,
    });
  } catch (error) {
    return {
      success: false,
      restoredCount: 0,
      failureCount: snapshots.length,
      errors: snapshots.map(s => ({
        articleId: s.id,
        articleTitle: s.title,
        error: error instanceof Error ? error.message : '事务回滚失败',
      })),
    };
  }

  await prisma.batchOperationLog.update({
    where: { id: operationId },
    data: {
      reverted: true,
      revertedAt: new Date(),
    },
  });

  const failureCount = errors.length;

  return {
    success: failureCount === 0,
    restoredCount,
    failureCount,
    errors,
  };
}
