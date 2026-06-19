// 文章数据类型定义

export interface Article {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  importance: 'low' | 'medium' | 'high';
  views: number;
  content: string;
  contentPlainText?: string;
  updatedAt: string;
  highlight?: SearchHighlight;
}

export interface SearchHighlight {
  title?: string;
  author?: string;
  snippet?: string;
}

export interface ArticleFormData {
  title: string;
  author: string;
  createdAt: string;
  importance: 'low' | 'medium' | 'high';
  content: string;
}

export interface ArticleListQuery {
  page: number;                                  // 当前页码
  pageSize: number;                              // 每页条数
  keyword?: string;                              // 搜索关键词
}

export interface ArticleListResponse {
  data: Article[];                               // 文章列表
  total: number;                                 // 总条数
  page: number;                                  // 当前页码
  pageSize: number;                              // 每页条数
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 编辑锁相关类型

export interface LockOwner {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface ArticleEditLock {
  id: string;
  articleId: string;
  userId: string;
  sessionId: string;
  expiresAt: string;
  lastHeartbeat: string;
  user: LockOwner;
}

export interface LockStatus {
  isLocked: boolean;
  isLockedByMe: boolean;
  lock?: ArticleEditLock;
  expiresAt?: string;
}

export interface AcquireLockRequest {
  sessionId: string;
}

export interface AcquireLockResponse {
  success: boolean;
  acquired: boolean;
  lock?: ArticleEditLock;
  error?: string;
}

export interface HeartbeatRequest {
  sessionId: string;
}

export interface HeartbeatResponse {
  success: boolean;
  renewed: boolean;
  expiresAt?: string;
  error?: string;
}

export interface ReleaseLockRequest {
  sessionId: string;
}

export interface ReleaseLockResponse {
  success: boolean;
  released: boolean;
  error?: string;
}

export interface StealLockRequest {
  sessionId: string;
}

export interface StealLockResponse {
  success: boolean;
  stolen: boolean;
  lock?: ArticleEditLock;
  error?: string;
}

export interface UpdateArticleWithOptimisticLock extends ArticleFormData {
  lastUpdatedAt: string;
}

export interface SearchSuggestion {
  id: string;
  title: string;
  author: string;
}

export interface FtsSearchResult {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  importance: string;
  views: number;
  content: string;
  contentPlainText: string;
  updatedAt: string;
  rank: number;
  highlightTitle: string | null;
  highlightAuthor: string | null;
  snippet: string | null;
}

export const LOCK_CONSTANTS = {
  LOCK_DURATION_MS: 5 * 60 * 1000,          // 锁有效期 5 分钟
  HEARTBEAT_INTERVAL_MS: 60 * 1000,         // 心跳间隔 1 分钟
  HEARTBEAT_MARGIN_MS: 30 * 1000,           // 心跳续约余量 30 秒
} as const;
