import { PrismaClient } from '@prisma/client';
import { copyFile, mkdir, readdir, stat, unlink, readFile, writeFile, access } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/dev.db';
  const filePath = dbUrl.replace(/^file:/, '');
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(process.cwd(), filePath);
}

interface UploadsFileEntry {
  relativePath: string;
  size: number;
  hash: string;
}

async function collectUploadsMeta(): Promise<UploadsFileEntry[]> {
  const entries: UploadsFileEntry[] = [];

  async function walkDir(dir: string, baseDir: string): Promise<void> {
    try {
      await access(dir);
    } catch {
      return;
    }
    const files = await readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const fileStat = await stat(fullPath);
      if (fileStat.isDirectory()) {
        await walkDir(fullPath, baseDir);
      } else {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const buffer = await readFile(fullPath);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        entries.push({ relativePath, size: fileStat.size, hash });
      }
    }
  }

  await walkDir(UPLOADS_DIR, UPLOADS_DIR);
  return entries;
}

async function runScheduledBackup(): Promise<void> {
  const schedule = await prisma.backupSchedule.findFirst();

  if (!schedule || !schedule.enabled) {
    console.log('[backup-cron] 定时备份未启用，跳过');
    return;
  }

  console.log('[backup-cron] 开始执行定时备份...');

  await mkdir(BACKUP_DIR, { recursive: true });

  const dbPath = getDbPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-scheduled-${timestamp}.db`;
  const backupFilePath = path.join(BACKUP_DIR, filename);

  let dbSize = 0;
  try {
    const dbStat = await stat(dbPath);
    dbSize = dbStat.size;
  } catch {
    console.error('[backup-cron] 数据库文件不存在:', dbPath);
    process.exit(1);
  }

  const articleCount = await prisma.article.count();
  const uploadsFiles = await collectUploadsMeta();

  const meta = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    type: 'scheduled',
    articleCount,
    dbSize,
    uploadsFiles,
  };

  const metaFilename = `backup-scheduled-${timestamp}.meta.json`;
  const metaFilePath = path.join(BACKUP_DIR, metaFilename);

  await copyFile(dbPath, backupFilePath);
  await writeFile(metaFilePath, JSON.stringify(meta, null, 2), 'utf-8');

  await prisma.backupRecord.create({
    data: {
      type: 'scheduled',
      status: 'completed',
      filename,
      fileSize: dbSize,
      dbPath,
      uploadsMetaJson: JSON.stringify(uploadsFiles),
      articleCount,
      note: '定时自动备份',
    },
  });

  const now = new Date();
  await prisma.backupSchedule.update({
    where: { id: schedule.id },
    data: { lastRunAt: now },
  });

  console.log(`[backup-cron] 定时备份完成: ${filename} (${(dbSize / 1024 / 1024).toFixed(2)} MB)`);

  await applyRetentionPolicy(schedule.retentionDays, schedule.retentionCount);
}

async function applyRetentionPolicy(retentionDays: number, retentionCount: number): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expiredRecords = await prisma.backupRecord.findMany({
    where: {
      type: 'scheduled',
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (expiredRecords.length === 0) return;

  const scheduledRecords = await prisma.backupRecord.findMany({
    where: { type: 'scheduled' },
    orderBy: { createdAt: 'desc' },
  });

  const toKeep = new Set(scheduledRecords.slice(0, retentionCount).map((r) => r.id));
  const toDelete = expiredRecords.filter((r) => !toKeep.has(r.id));

  for (const record of toDelete) {
    const safeName = path.basename(record.filename);
    const filePath = path.join(BACKUP_DIR, safeName);
    const metaName = safeName.replace(/\.db$/, '.meta.json');
    const metaPath = path.join(BACKUP_DIR, metaName);

    await unlink(filePath).catch(() => undefined);
    await unlink(metaPath).catch(() => undefined);

    await prisma.backupRecord.delete({ where: { id: record.id } });
  }

  console.log(`[backup-cron] 保留策略已执行: 删除 ${toDelete.length} 条过期备份`);
}

runScheduledBackup()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('[backup-cron] 定时备份失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
