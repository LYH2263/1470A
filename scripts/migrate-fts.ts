import { PrismaClient } from '@prisma/client';
import { stripHtml, tokenizeChinese } from '../src/lib/search';

const prisma = new PrismaClient();

async function migrateFts() {
  try {
    console.log('开始 FTS5 索引迁移...');

    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE IF NOT EXISTS "ArticleFts" USING fts5(
        "title",
        "contentPlainText",
        "author",
        content="Article",
        content_rowid="rowid"
      )
    `);
    console.log('✅ FTS5 虚拟表已创建');

    const articles = await prisma.article.findMany({
      select: { id: true, content: true, contentPlainText: true },
    });
    console.log(`找到 ${articles.length} 篇文章，开始更新 contentPlainText...`);

    let updated = 0;
    for (const article of articles) {
      const plainText = stripHtml(article.content);
      const tokenized = tokenizeChinese(plainText);

      if (article.contentPlainText !== tokenized) {
        await prisma.article.update({
          where: { id: article.id },
          data: { contentPlainText: tokenized },
        });
        updated++;
      }
    }
    console.log(`✅ 已更新 ${updated} 篇文章的 contentPlainText`);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ArticleFts"("ArticleFts") VALUES ('rebuild')`
    );
    console.log('✅ FTS5 索引已重建');

    const countResult = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM "ArticleFts"`
    );
    const ftsCount = Number(countResult[0]?.total ?? 0);
    console.log(`✅ FTS5 索引包含 ${ftsCount} 条记录`);

    await prisma.$disconnect();
    console.log('迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrateFts();
