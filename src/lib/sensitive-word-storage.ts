import { prisma } from './prisma';
import { getGlobalDetector } from './sensitive-word-detector';
import type {
  SensitiveWord,
  SensitiveWordCreateInput,
  SensitiveWordUpdateInput,
  SensitiveWordQuery,
  SensitiveWordListResponse,
  SensitiveWordImportItem,
} from '@/types/sensitive-word';
import { SENSITIVE_WORD_DEFAULTS } from '@/types/sensitive-word';

function mapToDTO(word: {
  id: string;
  word: string;
  category: string;
  level: string;
  strategy: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SensitiveWord {
  return {
    id: word.id,
    word: word.word,
    category: word.category as SensitiveWord['category'],
    level: word.level as SensitiveWord['level'],
    strategy: word.strategy as SensitiveWord['strategy'],
    enabled: word.enabled,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  };
}

export async function refreshGlobalDetector(): Promise<void> {
  const words = await prisma.sensitiveWord.findMany({
    where: { enabled: true },
  });
  const detector = getGlobalDetector(words.map(mapToDTO));
  detector.setWords(words.map(mapToDTO));
}

export async function getSensitiveWords(
  query: SensitiveWordQuery
): Promise<SensitiveWordListResponse> {
  const {
    page = SENSITIVE_WORD_DEFAULTS.DEFAULT_PAGE,
    pageSize = SENSITIVE_WORD_DEFAULTS.DEFAULT_PAGE_SIZE,
    keyword,
    category,
    level,
    enabled,
  } = query;

  const where: any = {};

  if (keyword) {
    where.word = {
      contains: keyword,
    };
  }

  if (category) {
    where.category = category;
  }

  if (level) {
    where.level = level;
  }

  if (enabled !== undefined) {
    where.enabled = enabled;
  }

  const validPage = Math.max(SENSITIVE_WORD_DEFAULTS.DEFAULT_PAGE, page);
  const validPageSize = Math.min(
    SENSITIVE_WORD_DEFAULTS.MAX_PAGE_SIZE,
    Math.max(1, pageSize)
  );

  const [total, words] = await Promise.all([
    prisma.sensitiveWord.count({ where }),
    prisma.sensitiveWord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (validPage - 1) * validPageSize,
      take: validPageSize,
    }),
  ]);

  return {
    data: words.map(mapToDTO),
    total,
    page: validPage,
    pageSize: validPageSize,
  };
}

export async function getSensitiveWordById(id: string): Promise<SensitiveWord | null> {
  const word = await prisma.sensitiveWord.findUnique({
    where: { id },
  });
  return word ? mapToDTO(word) : null;
}

export async function createSensitiveWord(
  data: SensitiveWordCreateInput
): Promise<SensitiveWord> {
  const existing = await prisma.sensitiveWord.findUnique({
    where: { word: data.word },
  });

  if (existing) {
    throw new Error(`敏感词「${data.word}」已存在`);
  }

  const word = await prisma.sensitiveWord.create({
    data: {
      word: data.word,
      category: data.category,
      level: data.level,
      strategy: data.strategy,
      enabled: data.enabled !== false,
    },
  });

  await refreshGlobalDetector();
  return mapToDTO(word);
}

export async function updateSensitiveWord(
  id: string,
  data: SensitiveWordUpdateInput
): Promise<SensitiveWord | null> {
  try {
    const updateData: any = {};
    if (data.word !== undefined) updateData.word = data.word;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.strategy !== undefined) updateData.strategy = data.strategy;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const word = await prisma.sensitiveWord.update({
      where: { id },
      data: updateData,
    });

    await refreshGlobalDetector();
    return mapToDTO(word);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return null;
    }
    if (error?.code === 'P2002') {
      throw new Error(`敏感词「${data.word}」已存在`);
    }
    throw error;
  }
}

export async function deleteSensitiveWord(id: string): Promise<boolean> {
  try {
    await prisma.sensitiveWord.delete({
      where: { id },
    });
    await refreshGlobalDetector();
    return true;
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export async function deleteSensitiveWords(ids: string[]): Promise<number> {
  const result = await prisma.sensitiveWord.deleteMany({
    where: { id: { in: ids } },
  });
  if (result.count > 0) {
    await refreshGlobalDetector();
  }
  return result.count;
}

export async function importSensitiveWords(
  items: SensitiveWordImportItem[]
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const existingWords = await prisma.sensitiveWord.findMany({
    select: { id: true, word: true },
  });
  const existingMap = new Map(existingWords.map(w => [w.word, w.id]));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (!item.word || !item.word.trim()) {
        result.skipped++;
        result.errors.push(`第 ${i + 1} 行：敏感词不能为空`);
        continue;
      }

      const existingId = existingMap.get(item.word);
      if (existingId) {
        await prisma.sensitiveWord.update({
          where: { id: existingId },
          data: {
            category: item.category,
            level: item.level,
            strategy: item.strategy || 'block',
            enabled: item.enabled !== false,
          },
        });
        result.updated++;
      } else {
        await prisma.sensitiveWord.create({
          data: {
            word: item.word,
            category: item.category,
            level: item.level,
            strategy: item.strategy || 'block',
            enabled: item.enabled !== false,
          },
        });
        result.created++;
      }
    } catch (error: any) {
      result.skipped++;
      result.errors.push(`第 ${i + 1} 行「${item.word}」：${error.message || '导入失败'}`);
    }
  }

  if (result.created > 0 || result.updated > 0) {
    await refreshGlobalDetector();
  }

  return result;
}

export async function exportSensitiveWords(
  query?: SensitiveWordQuery
): Promise<SensitiveWordImportItem[]> {
  const where: any = {};

  if (query?.keyword) {
    where.word = { contains: query.keyword };
  }
  if (query?.category) {
    where.category = query.category;
  }
  if (query?.level) {
    where.level = query.level;
  }
  if (query?.enabled !== undefined) {
    where.enabled = query.enabled;
  }

  const words = await prisma.sensitiveWord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return words.map(w => ({
    word: w.word,
    category: w.category as any,
    level: w.level as any,
    strategy: w.strategy as any,
    enabled: w.enabled,
  }));
}

export async function getAllEnabledSensitiveWords(): Promise<SensitiveWord[]> {
  const words = await prisma.sensitiveWord.findMany({
    where: { enabled: true },
  });
  return words.map(mapToDTO);
}

export async function initializeDetector(): Promise<void> {
  await refreshGlobalDetector();
}
