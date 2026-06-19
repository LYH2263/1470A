import { prisma } from './prisma';
import type {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryQuery,
  CategoryListResponse,
} from '@/types/category';
import { PAGINATION } from './constants';

function mapToDTO(category: {
  id: string;
  name: string;
  sort: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Category {
  return {
    id: category.id,
    name: category.name,
    sort: category.sort,
    description: category.description,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function getCategories(
  query: CategoryQuery
): Promise<CategoryListResponse> {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    keyword,
  } = query;

  const where: any = {};

  if (keyword) {
    where.name = {
      contains: keyword,
    };
  }

  const validPage = Math.max(PAGINATION.DEFAULT_PAGE, page);
  const validPageSize = Math.min(
    PAGINATION.MAX_PAGE_SIZE,
    Math.max(1, pageSize)
  );

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [
        { sort: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (validPage - 1) * validPageSize,
      take: validPageSize,
    }),
  ]);

  return {
    data: categories.map(mapToDTO),
    total,
    page: validPage,
    pageSize: validPageSize,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    orderBy: [
      { sort: 'asc' },
      { createdAt: 'desc' },
    ],
  });
  return categories.map(mapToDTO);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const category = await prisma.category.findUnique({
    where: { id },
  });
  return category ? mapToDTO(category) : null;
}

export async function createCategory(
  data: CategoryCreateInput
): Promise<Category> {
  const existing = await prisma.category.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error(`分类「${data.name}」已存在`);
  }

  const category = await prisma.category.create({
    data: {
      name: data.name,
      sort: data.sort ?? 0,
      description: data.description ?? null,
    },
  });

  return mapToDTO(category);
}

export async function updateCategory(
  id: string,
  data: CategoryUpdateInput
): Promise<Category | null> {
  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sort !== undefined) updateData.sort = data.sort;
    if (data.description !== undefined) updateData.description = data.description;

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return mapToDTO(category);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return null;
    }
    if (error?.code === 'P2002') {
      throw new Error(`分类「${data.name}」已存在`);
    }
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    await prisma.category.delete({
      where: { id },
    });
    return true;
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export async function deleteCategories(ids: string[]): Promise<number> {
  const result = await prisma.category.deleteMany({
    where: { id: { in: ids } },
  });
  return result.count;
}
