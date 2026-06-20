import { prisma } from './prisma';
import { SEARCH } from './constants';
import type { FtsSearchResult, SearchSuggestion } from '@/types/article';
import { stripHtml, tokenizeChinese, buildFtsQuery } from './html-utils';

let ftsInitialized = false;

async function ensureFtsTable(): Promise<void> {
  if (ftsInitialized) return;

  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS "ArticleFts" USING fts5(
      "title",
      "contentPlainText",
      "author",
      content="Article",
      content_rowid="rowid"
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS "article_fts_ai" AFTER INSERT ON "Article" BEGIN
      INSERT INTO "ArticleFts"("rowid", "title", "contentPlainText", "author")
      VALUES (new.rowid, new.title, new.contentPlainText, new.author);
    END
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS "article_fts_ad" AFTER DELETE ON "Article" BEGIN
      INSERT INTO "ArticleFts"("ArticleFts", "rowid", "title", "contentPlainText", "author")
      VALUES ('delete', old.rowid, old.title, old.contentPlainText, old.author);
    END
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS "article_fts_au" AFTER UPDATE ON "Article" BEGIN
      INSERT INTO "ArticleFts"("ArticleFts", "rowid", "title", "contentPlainText", "author")
      VALUES ('delete', old.rowid, old.title, old.contentPlainText, old.author);
      INSERT INTO "ArticleFts"("rowid", "title", "contentPlainText", "author")
      VALUES (new.rowid, new.title, new.contentPlainText, new.author);
    END
  `);

  const ftsCount = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) as total FROM "ArticleFts"`
  );
  const articleCount = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) as total FROM "Article"`
  );

  if (Number(ftsCount[0]?.total ?? 0) === 0 && Number(articleCount[0]?.total ?? 0) > 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ArticleFts"("ArticleFts") VALUES ('rebuild')`
    );
  }

  ftsInitialized = true;
}

export async function searchArticles(
  keyword: string,
  page: number,
  pageSize: number,
  categoryId?: string | null,
  status: 'draft' | 'published' | 'all' = 'published'
): Promise<{ data: FtsSearchResult[]; total: number }> {
  await ensureFtsTable();

  const ftsQuery = buildFtsQuery(keyword);
  const offset = (page - 1) * pageSize;

  const whereConditions: string[] = [`"ArticleFts" MATCH ?`];
  const params: any[] = [ftsQuery];

  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    whereConditions.push(`a."categoryId" = ?`);
    params.push(categoryId);
  } else if (categoryId === null) {
    whereConditions.push(`a."categoryId" IS NULL`);
  }

  if (status !== 'all') {
    whereConditions.push(`a."status" = ?`);
    params.push(status);
  }

  const whereClause = whereConditions.join(' AND ');

  const countResult = await prisma.$queryRawUnsafe<
    { total: bigint }[]
  >(
    `SELECT COUNT(*) as total FROM "ArticleFts" fts JOIN "Article" a ON fts.rowid = a.rowid WHERE ${whereClause}`,
    ...params
  );
  const total = Number(countResult[0]?.total ?? 0);

  const pre = SEARCH.HIGHLIGHT_PRE_TAG;
  const post = SEARCH.HIGHLIGHT_POST_TAG;
  const snippetLen = SEARCH.SNIPPET_LENGTH;

  const rows = await prisma.$queryRawUnsafe<
    (Omit<FtsSearchResult, 'createdAt' | 'updatedAt' | 'rank' | 'highlightTitle' | 'highlightAuthor' | 'snippet'> & {
      createdAt: Date;
      updatedAt: Date;
      rank: number;
      highlightTitle: string | null;
      highlightAuthor: string | null;
      snippet: string | null;
      categoryId: string | null;
      categoryName: string | null;
      status: string;
    })[]
  >(
    `SELECT
      a."id",
      a."title",
      a."author",
      a."createdAt",
      a."importance",
      a."views",
      a."content",
      a."contentPlainText",
      a."status",
      a."updatedAt",
      a."categoryId",
      c."name" as "categoryName",
      fts.rank,
      highlight("ArticleFts", 0, ?, ?) as "highlightTitle",
      highlight("ArticleFts", 2, ?, ?) as "highlightAuthor",
      snippet("ArticleFts", 1, ?, ?, '...', ?, ?) as "snippet"
    FROM "ArticleFts" fts
    JOIN "Article" a ON fts.rowid = a.rowid
    LEFT JOIN "Category" c ON a."categoryId" = c."id"
    WHERE ${whereClause}
    ORDER BY fts.rank
    LIMIT ? OFFSET ?`,
    pre,
    post,
    pre,
    post,
    pre,
    post,
    snippetLen,
    0,
    ...params,
    pageSize,
    offset
  );

  const data: FtsSearchResult[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    importance: row.importance,
    views: row.views,
    content: row.content,
    contentPlainText: row.contentPlainText,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    rank: row.rank,
    highlightTitle: row.highlightTitle,
    highlightAuthor: row.highlightAuthor,
    snippet: row.snippet,
    categoryId: row.categoryId,
    category: row.categoryId ? { id: row.categoryId, name: row.categoryName || '' } : null,
  } as any));

  return { data, total };
}

export async function getSearchSuggestions(
  keyword: string,
  limit: number = SEARCH.SUGGESTION_LIMIT,
  status: 'draft' | 'published' | 'all' = 'published'
): Promise<SearchSuggestion[]> {
  await ensureFtsTable();

  const ftsQuery = buildFtsQuery(keyword);

  const whereConditions: string[] = [`"ArticleFts" MATCH ?`];
  const params: any[] = [ftsQuery];

  if (status !== 'all') {
    whereConditions.push(`a."status" = ?`);
    params.push(status);
  }

  const whereClause = whereConditions.join(' AND ');

  const rows = await prisma.$queryRawUnsafe<
    { id: string; title: string; author: string }[]
  >(
    `SELECT a."id", a."title", a."author"
     FROM "ArticleFts" fts
     JOIN "Article" a ON fts.rowid = a.rowid
     WHERE ${whereClause}
     ORDER BY fts.rank
     LIMIT ?`,
    ...params,
    limit
  );

  return rows;
}

export async function rebuildFtsIndex(): Promise<number> {
  await ensureFtsTable();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ArticleFts"("ArticleFts") VALUES ('rebuild')`
  );

  const countResult = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) as total FROM "ArticleFts"`
  );
  return Number(countResult[0]?.total ?? 0);
}

export { stripHtml, tokenizeChinese, buildFtsQuery } from './html-utils';
