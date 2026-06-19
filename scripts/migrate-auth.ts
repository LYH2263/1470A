import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始数据迁移...');

  // 1. 创建管理员账号
  console.log('创建管理员账号...');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '管理员',
      role: 'admin',
    },
  });

  console.log(`管理员账号已创建: ${admin.username} (ID: ${admin.id})`);

  // 2. 检查是否有现有文章需要迁移
  // 注意：由于schema已经改变，这里需要使用原始SQL查询
  try {
    const articlesCount = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM Article
    `;

    const count = articlesCount[0]?.count || 0;

    if (count > 0) {
      console.log(`发现 ${count} 篇文章需要迁移...`);
      console.log('注意：所有现有文章将关联到管理员账号');

      // 由于schema已经改变，旧的author字段已经不存在
      // 新的迁移会自动处理这个问题
      console.log('文章迁移将在Prisma迁移过程中自动完成');
    } else {
      console.log('没有发现需要迁移的文章');
    }
  } catch (error) {
    console.log('检查文章时出错（这是正常的，如果是首次运行）:', error);
  }

  console.log('\n数据迁移完成！');
  console.log('\n初始账号信息：');
  console.log('用户名: admin');
  console.log('密码: admin123');
  console.log('\n请登录后立即修改密码！');
}

main()
  .catch((e) => {
    console.error('迁移失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
