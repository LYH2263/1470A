import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import type { Article } from '../src/types/article';

const prisma = new PrismaClient();

async function migrate() {
  try {
    // 读取 JSON 文件
    const dataPath = join(process.cwd(), 'data', 'articles.json');
    const jsonData = readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(jsonData);

    console.log(`找到 ${data.articles.length} 篇文章，开始迁移...`);

    // 导入到数据库
    for (const article of data.articles as Article[]) {
      await prisma.article.create({
        data: {
          id: article.id,
          title: article.title,
          author: article.author,
          createdAt: new Date(article.createdAt),
          importance: article.importance,
          views: article.views,
          content: article.content,
        },
      });
    }

    console.log('✅ 数据迁移成功！');
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
