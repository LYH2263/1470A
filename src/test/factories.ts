import { v4 as uuidv4 } from 'uuid';
import type { Article, ArticleFormData, ArticleEditLock, LockOwner } from '@/types/article';

/**
 * 创建测试用的文章数据
 */
export function createMockArticle(overrides?: Partial<Article>): Article {
  const id = uuidv4();
  const now = new Date().toISOString();

  return {
    id,
    title: '测试文章标题',
    author: '测试作者',
    createdAt: now,
    importance: 'medium',
    views: 0,
    content: '<p>这是测试内容</p>',
    updatedAt: now,
    categoryId: null,
    ...overrides,
  };
}

/**
 * 创建测试用的文章表单数据
 */
export function createMockArticleFormData(
  overrides?: Partial<ArticleFormData>
): ArticleFormData {
  const now = new Date().toISOString();

  return {
    title: '测试文章标题',
    author: '测试作者',
    createdAt: now,
    importance: 'medium',
    content: '<p>这是测试内容</p>',
    categoryId: null,
    ...overrides,
  };
}

/**
 * 创建多个测试文章
 */
export function createMockArticles(count: number): Article[] {
  return Array.from({ length: count }, (_, index) =>
    createMockArticle({
      title: `测试文章 ${index + 1}`,
      author: `作者 ${index + 1}`,
      views: index * 10,
    })
  );
}

/**
 * 创建测试用户
 */
export function createMockUser(overrides?: Partial<LockOwner>): LockOwner {
  return {
    id: uuidv4(),
    username: 'testuser',
    name: '测试用户',
    role: 'admin',
    ...overrides,
  };
}

/**
 * 创建测试编辑锁
 */
export function createMockArticleEditLock(overrides?: Partial<ArticleEditLock>): ArticleEditLock {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  return {
    id: uuidv4(),
    articleId: uuidv4(),
    userId: uuidv4(),
    sessionId: uuidv4(),
    expiresAt: expiresAt.toISOString(),
    lastHeartbeat: now.toISOString(),
    user: createMockUser(),
    ...overrides,
  };
}

/**
 * 创建包含 XSS 攻击的文章内容
 */
export function createXSSArticle(): Article {
  return createMockArticle({
    title: '<script>alert("XSS")</script>',
    content: '<img src=x onerror="alert(\'XSS\')">',
  });
}

/**
 * 创建包含特殊字符的文章
 */
export function createSpecialCharsArticle(): Article {
  return createMockArticle({
    title: '特殊字符测试 <>&"\'',
    content: '<p>包含特殊字符: <>&"\'</p>',
  });
}

/**
 * 创建超长内容的文章
 */
export function createLongContentArticle(): Article {
  const longContent = '<p>' + 'A'.repeat(10000) + '</p>';
  return createMockArticle({
    title: '超长内容测试',
    content: longContent,
  });
}
