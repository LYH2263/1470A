export interface SensitiveWord {
  id: string;
  word: string;
  category: SensitiveWordCategory;
  level: SensitiveWordLevel;
  strategy: SensitiveWordStrategy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SensitiveWordCategory = 
  | 'politics' 
  | 'violence' 
  | 'pornography' 
  | 'advertisement' 
  | 'other';

export type SensitiveWordLevel = 'high' | 'medium' | 'low';

export type SensitiveWordStrategy = 'block' | 'replace' | 'warn';

export interface SensitiveWordMatch {
  word: string;
  normalizedWord: string;
  category: SensitiveWordCategory;
  level: SensitiveWordLevel;
  strategy: SensitiveWordStrategy;
  start: number;
  end: number;
  originalText: string;
}

export interface SensitiveWordDetectionResult {
  matches: SensitiveWordMatch[];
  shouldBlock: boolean;
  blockReason: string | null;
  replacedContent: string;
  originalContent: string;
  stats: {
    totalMatches: number;
    highLevelCount: number;
    mediumLevelCount: number;
    lowLevelCount: number;
  };
}

export interface SensitiveWordCreateInput {
  word: string;
  category: SensitiveWordCategory;
  level: SensitiveWordLevel;
  strategy: SensitiveWordStrategy;
  enabled?: boolean;
}

export interface SensitiveWordUpdateInput {
  word?: string;
  category?: SensitiveWordCategory;
  level?: SensitiveWordLevel;
  strategy?: SensitiveWordStrategy;
  enabled?: boolean;
}

export interface SensitiveWordQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  category?: SensitiveWordCategory;
  level?: SensitiveWordLevel;
  enabled?: boolean;
}

export interface SensitiveWordImportItem {
  word: string;
  category: SensitiveWordCategory;
  level: SensitiveWordLevel;
  strategy?: SensitiveWordStrategy;
  enabled?: boolean;
}

export interface SensitiveWordListResponse {
  data: SensitiveWord[];
  total: number;
  page: number;
  pageSize: number;
}

export const SENSITIVE_WORD_CATEGORIES: { value: SensitiveWordCategory; label: string }[] = [
  { value: 'politics', label: '政治敏感' },
  { value: 'violence', label: '暴力恐怖' },
  { value: 'pornography', label: '色情低俗' },
  { value: 'advertisement', label: '广告垃圾' },
  { value: 'other', label: '其他' },
];

export const SENSITIVE_WORD_LEVELS: { value: SensitiveWordLevel; label: string; color: string }[] = [
  { value: 'high', label: '高危', color: 'error' },
  { value: 'medium', label: '中危', color: 'warning' },
  { value: 'low', label: '低危', color: 'default' },
];

export const SENSITIVE_WORD_STRATEGIES: { value: SensitiveWordStrategy; label: string }[] = [
  { value: 'block', label: '阻断发布' },
  { value: 'replace', label: '强制替换' },
  { value: 'warn', label: '仅警告' },
];

export const SENSITIVE_WORD_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  REPLACEMENT_CHAR: '*',
} as const;
