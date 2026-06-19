export interface Category {
  id: string;
  name: string;
  sort: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryCreateInput {
  name: string;
  sort?: number;
  description?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  sort?: number;
  description?: string;
}

export interface CategoryQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface CategoryListResponse {
  data: Category[];
  total: number;
  page: number;
  pageSize: number;
}
