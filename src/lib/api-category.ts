import { fetchWithAuth } from './api';
import type {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryQuery,
  CategoryListResponse,
} from '@/types/category';

export async function getCategoryList(
  query?: CategoryQuery
): Promise<CategoryListResponse> {
  const params = new URLSearchParams();
  if (query?.page) params.append('page', String(query.page));
  if (query?.pageSize) params.append('pageSize', String(query.pageSize));
  if (query?.keyword) params.append('keyword', query.keyword);

  const url = `/api/categories${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetchWithAuth(url, {
    method: 'GET',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取分类列表失败');
  }
  return result.data;
}

export async function getAllCategories(): Promise<Category[]> {
  const response = await fetchWithAuth('/api/categories?all=true', {
    method: 'GET',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取分类列表失败');
  }
  return result.data;
}

export async function getCategoryById(id: string): Promise<Category> {
  const response = await fetchWithAuth(`/api/categories/${id}`, {
    method: 'GET',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取分类失败');
  }
  return result.data;
}

export async function createCategory(
  data: CategoryCreateInput
): Promise<Category> {
  const response = await fetchWithAuth('/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '创建分类失败');
  }
  return result.data;
}

export async function updateCategory(
  id: string,
  data: CategoryUpdateInput
): Promise<Category> {
  const response = await fetchWithAuth(`/api/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '更新分类失败');
  }
  return result.data;
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await fetchWithAuth(`/api/categories/${id}`, {
    method: 'DELETE',
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '删除分类失败');
  }
}

export async function deleteCategories(ids: string[]): Promise<{ deletedCount: number }> {
  const response = await fetchWithAuth('/api/categories', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '批量删除分类失败');
  }
  return result.data;
}
