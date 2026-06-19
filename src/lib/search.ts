import { prisma } from './prisma';
import { SEARCH } from './constants';
import type { FtsSearchResult, SearchSuggestion } from '@/types/article';

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeChinese(text: string): string {
  const chars = text.split('');
  const tokens: string[] = [];
  let current = '';

  for (const ch of chars) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(ch);
    } else if (/[\w]/.test(ch)) {
      current += ch;
    } else {
      if (current) {
        tokens.push(current);
        current = '';
      }
    }
  }
  if (current) {
    tokens.push(current);
  }

  return tokens.join(' ');
}

function buildFtsQuery(keyword: string): string {
  const escaped = keyword.replace(/"/g, '""');
  const terms = escaped.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return '';
  if (terms.length === 1) return `"${terms[0]}"*`;
  return terms.map((t) => `"${t}"*`).join(' AND ');
}

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

  ftsInitialized = true;
}

export async function searchArticles(
  keyword: string,
  page: number,
  pageSize: number
): Promise<{ data: FtsSearchResult[]; total: number }> {
  await ensureFtsTable();

  const ftsQuery = buildFtsQuery(keyword);
  const offset = (page - 1) * pageSize;

  const countResult = await prisma.$queryRawUnsafe<
    { total: bigint }[]
  >(
    `SELECT COUNT(*) as total FROM "ArticleFts" WHERE "ArticleFts" MATCH ?`,
    ftsQuery
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
      a."updatedAt",
      fts.rank,
      highlight("ArticleFts", 0, ?, ?) as "highlightTitle",
      highlight("ArticleFts", 2, ?, ?) as "highlightAuthor",
      snippet("ArticleFts", 1, ?, ?, '...', ?, ?) as "snippet"
    FROM "ArticleFts" fts
    JOIN "Article" a ON fts.rowid = a.rowid
    WHERE "ArticleFts" MATCH ?
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
    ftsQuery,
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
    updatedAt: row.updatedAt.toISOString(),
    rank: row.rank,
    highlightTitle: row.highlightTitle,
    highlightAuthor: row.highlightAuthor,
    snippet: row.snippet,
  }));

  return { data, total };
}

export async function getSearchSuggestions(
  keyword: string,
  limit: number = SEARCH.SUGGESTION_LIMIT
): Promise<SearchSuggestion[]> {
  await ensureFtsTable();

  const ftsQuery = buildFtsQuery(keyword);

  const rows = await prisma.$queryRawUnsafe<
    { id: string; title: string; author: string }[]
  >(
    `SELECT a."id", a."title", a."author"
     FROM "ArticleFts" fts
     JOIN "Article" a ON fts.rowid = a.rowid
     WHERE "ArticleFts" MATCH ?
     ORDER BY fts.rank
     LIMIT ?`,
    ftsQuery,
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

export async function updateFtsForArticle(
  articleId: string,
  title: string,
  contentPlainText: string,
  author: string
): Promise<void> {
  const tokenized = tokenizeChinese(contentPlainText);
  await prisma.$executeRawUnsafe(
    `UPDATE "Article" SET "contentPlainText" = ? WHERE "id" = ?`,
    tokenized,
    articleId
  );
}

export { stripHtml, tokenizeChinese, buildFtsQuery };
