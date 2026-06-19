// 文件上传配置
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const,
} as const;

// 富文本编辑器配置
export const EDITOR_CONFIG = {
  HEIGHT: 400,
  MARGIN_BOTTOM: 50,
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;

// 搜索配置
export const SEARCH = {
  MAX_KEYWORD_LENGTH: 100,
} as const;
