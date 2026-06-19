// 文章数据类型定义

export interface Article {
  id: string;                                    // 唯一标识符（UUID）
  title: string;                                 // 标题（必填）
  author: string;                                // 作者名称（必填）
  createdAt: string;                             // 创建时间（ISO 8601 格式）
  importance: 'low' | 'medium' | 'high';         // 重要性等级
  views: number;                                 // 阅读数
  content: string;                               // 富文本内容（HTML）
  updatedAt: string;                             // 更新时间（用于乐观锁）
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

export const LOCK_CONSTANTS = {
  LOCK_DURATION_MS: 5 * 60 * 1000,          // 锁有效期 5 分钟
  HEARTBEAT_INTERVAL_MS: 60 * 1000,         // 心跳间隔 1 分钟
  HEARTBEAT_MARGIN_MS: 30 * 1000,           // 心跳续约余量 30 秒
} as const;
