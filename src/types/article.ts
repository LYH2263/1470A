// 文章数据类型定义

export interface Article {
  id: string;                                    // 唯一标识符（UUID）
  title: string;                                 // 标题（必填）
  author: string;                                // 作者名称（必填）
  createdAt: string;                             // 创建时间（ISO 8601 格式）
  importance: 'low' | 'medium' | 'high';         // 重要性等级
  views: number;                                 // 阅读数
  content: string;                               // 富文本内容（HTML）
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
