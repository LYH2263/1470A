import { fetchWithAuth } from './api';
import type {
  SensitiveWord,
  SensitiveWordCreateInput,
  SensitiveWordUpdateInput,
  SensitiveWordQuery,
  SensitiveWordListResponse,
  SensitiveWordDetectionResult,
  SensitiveWordImportItem,
} from '@/types/sensitive-word';

export async function detectSensitiveWords(params: {
  content: string;
  checkTitle?: boolean;
  title?: string;
}): Promise<SensitiveWordDetectionResult> {
  const response = await fetchWithAuth('/api/sensitive-words/detect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '检测失败');
  }
  return result.data;
}

export async function getSensitiveWordList(
  query?: SensitiveWordQuery
): Promise<SensitiveWordListResponse> {
  const params = new URLSearchParams();
  if (query?.page) params.append('page', String(query.page));
  if (query?.pageSize) params.append('pageSize', String(query.pageSize));
  if (query?.keyword) params.append('keyword', query.keyword);
  if (query?.category) params.append('category', query.category);
  if (query?.level) params.append('level', query.level);
  if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));

  const url = `/api/sensitive-words${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetchWithAuth(url, {
    method: 'GET',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取敏感词列表失败');
  }
  return result.data;
}

export async function createSensitiveWord(
  data: SensitiveWordCreateInput
): Promise<SensitiveWord> {
  const response = await fetchWithAuth('/api/sensitive-words', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '创建敏感词失败');
  }
  return result.data;
}

export async function updateSensitiveWord(
  id: string,
  data: SensitiveWordUpdateInput
): Promise<SensitiveWord> {
  const response = await fetchWithAuth(`/api/sensitive-words/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '更新敏感词失败');
  }
  return result.data;
}

export async function deleteSensitiveWord(id: string): Promise<void> {
  const response = await fetchWithAuth(`/api/sensitive-words/${id}`, {
    method: 'DELETE',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '删除敏感词失败');
  }
}

export async function deleteSensitiveWords(ids: string[]): Promise<{ deletedCount: number }> {
  const response = await fetchWithAuth('/api/sensitive-words', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '批量删除敏感词失败');
  }
  return result.data;
}

export async function importSensitiveWords(
  data: SensitiveWordImportItem[]
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const response = await fetchWithAuth('/api/sensitive-words/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '导入敏感词失败');
  }
  return result.data;
}

export async function exportSensitiveWords(
  query?: SensitiveWordQuery & { format?: 'json' | 'csv' }
): Promise<void> {
  const params = new URLSearchParams();
  if (query?.keyword) params.append('keyword', query.keyword);
  if (query?.category) params.append('category', query.category);
  if (query?.level) params.append('level', query.level);
  if (query?.enabled !== undefined) params.append('enabled', String(query.enabled));
  if (query?.format) params.append('format', query.format);

  const url = `/api/sensitive-words/export${params.toString() ? `?${params.toString()}` : ''}`;
  
  const response = await fetchWithAuth(url, {
    method: 'GET',
  });

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch?.[1] || `sensitive-words-${Date.now()}.json`;

  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
}

export function getLevelColor(level: string): string {
  switch (level) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'default';
    default: return 'default';
  }
}

export function getLevelLabel(level: string): string {
  switch (level) {
    case 'high': return '高危';
    case 'medium': return '中危';
    case 'low': return '低危';
    default: return level;
  }
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'politics': return '政治敏感';
    case 'violence': return '暴力恐怖';
    case 'pornography': return '色情低俗';
    case 'advertisement': return '广告垃圾';
    case 'other': return '其他';
    default: return category;
  }
}

export function getStrategyLabel(strategy: string): string {
  switch (strategy) {
    case 'block': return '阻断发布';
    case 'replace': return '强制替换';
    case 'warn': return '仅警告';
    default: return strategy;
  }
}
