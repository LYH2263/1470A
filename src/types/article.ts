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
  status: 'draft' | 'published';
  updatedAt: string;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
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
  status: 'draft' | 'published';
  categoryId?: string | null;
}

export interface ArticleListQuery {
  page: number;                                  // 当前页码
  pageSize: number;                              // 每页条数
  keyword?: string;                              // 搜索关键词
  categoryId?: string | null;                    // 分类筛选
  status?: 'draft' | 'published' | 'all';        // 状态筛选，默认 published
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
  [key: string]: unknown;
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
  status: string;
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

export type BatchOperationType = 
  | 'batch_update_author'
  | 'batch_update_importance'
  | 'batch_append_footer'
  | 'batch_replace_content'
  | 'batch_delete';

export interface BatchUpdateAuthorParams {
  author: string;
}

export interface BatchUpdateImportanceParams {
  importance: 'low' | 'medium' | 'high';
}

export interface BatchAppendFooterParams {
  footerHtml: string;
}

export interface BatchReplaceContentParams {
  pattern: string;
  replacement: string;
  isRegex: boolean;
  caseSensitive?: boolean;
}

export type BatchOperationParams = 
  | BatchUpdateAuthorParams
  | BatchUpdateImportanceParams
  | BatchAppendFooterParams
  | BatchReplaceContentParams;

export interface ArticleDiffPreview {
  articleId: string;
  articleTitle: string;
  field: string;
  oldValue: string;
  newValue: string;
  hasChange: boolean;
}

export interface BatchPreviewResult {
  articleIds: string[];
  articleCount: number;
  changedCount: number;
  previews: ArticleDiffPreview[];
  warnings: string[];
}

export interface ArticleSnapshot {
  id: string;
  title: string;
  author: string;
  importance: string;
  content: string;
  contentPlainText: string;
  status: string;
  updatedAt: string;
}

export interface BatchOperationError {
  articleId: string;
  articleTitle: string;
  error: string;
}

export interface BatchExecuteResult {
  success: boolean;
  operationId?: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  errors: BatchOperationError[];
  status: 'success' | 'partial_failure' | 'failed';
}

export interface BatchOperationLog {
  id: string;
  operationType: BatchOperationType;
  operatorId: string;
  operatorName: string;
  articleIds: string[];
  articleCount: number;
  params: BatchOperationParams;
  status: 'success' | 'partial_failure' | 'failed';
  successCount: number;
  failureCount: number;
  errorDetails?: BatchOperationError[];
  createdAt: string;
  updatedAt: string;
  reverted: boolean;
  revertedAt?: string;
}

export interface BatchUndoResult {
  success: boolean;
  restoredCount: number;
  failureCount: number;
  errors: BatchOperationError[];
}
