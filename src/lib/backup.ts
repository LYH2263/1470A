import { copyFile, mkdir, readdir, stat, unlink, readFile, writeFile, access, rename } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma, resetPrismaClient } from './prisma';
import { getMaintenanceMode, setMaintenanceMode as setSysMaintenanceMode } from './system-status';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/dev.db';
  const filePath = dbUrl.replace(/^file:/, '');
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(process.cwd(), filePath);
}

async function ensureBackupDir(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true });
}

export interface BackupMeta {
  version: string;
  createdAt: string;
  type: string;
  articleCount: number;
  dbSize: number;
  uploadsFiles: UploadsFileEntry[];
}

export interface UploadsFileEntry {
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
        entries.push({
          relativePath,
          size: fileStat.size,
          hash,
        });
      }
    }
  }

  await walkDir(UPLOADS_DIR, UPLOADS_DIR);
  return entries;
}

async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function createBackup(
  type: 'manual' | 'scheduled' | 'snapshot',
  operatorId?: string,
  operatorName?: string,
  note?: string
): Promise<{ id: string; filename: string; fileSize: number; articleCount: number }> {
  await ensureBackupDir();

  const dbPath = getDbPath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${type}-${timestamp}.db`;
  const backupFilePath = path.join(BACKUP_DIR, filename);

  let dbSize = 0;
  try {
    const dbStat = await stat(dbPath);
    dbSize = dbStat.size;
  } catch {
    throw new Error(`数据库文件不存在: ${dbPath}`);
  }

  const articleCount = await prisma.article.count();

  const uploadsFiles = await collectUploadsMeta();

  const meta: BackupMeta = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    type,
    articleCount,
    dbSize,
    uploadsFiles,
  };

  const metaFilename = `backup-${type}-${timestamp}.meta.json`;
  const metaFilePath = path.join(BACKUP_DIR, metaFilename);

  await copyFile(dbPath, backupFilePath);
  await writeFile(metaFilePath, JSON.stringify(meta, null, 2), 'utf-8');

  const backupRecord = await prisma.backupRecord.create({
    data: {
      type,
      status: 'completed',
      filename,
      fileSize: dbSize,
      dbPath,
      uploadsMetaJson: JSON.stringify(uploadsFiles),
      articleCount,
      operatorId,
      operatorName,
      note,
    },
  });

  return {
    id: backupRecord.id,
    filename,
    fileSize: dbSize,
    articleCount,
  };
}

export async function getBackupFilePath(filename: string): Promise<string> {
  const safeName = path.basename(filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  try {
    await access(filePath);
    return filePath;
  } catch {
    throw new Error(`备份文件不存在: ${safeName}`);
  }
}

export async function getBackupMeta(filename: string): Promise<BackupMeta | null> {
  const safeName = path.basename(filename);
  const metaName = safeName.replace(/\.db$/, '.meta.json');
  const metaPath = path.join(BACKUP_DIR, metaName);
  try {
    const content = await readFile(metaPath, 'utf-8');
    return JSON.parse(content) as BackupMeta;
  } catch {
    return null;
  }
}

export async function validateBackupFile(backupFilePath: string): Promise<{
  valid: boolean;
  meta: BackupMeta | null;
  error?: string;
}> {
  try {
    await access(backupFilePath);
  } catch {
    return { valid: false, meta: null, error: '备份文件不存在' };
  }

  const fileStat = await stat(backupFilePath);
  if (fileStat.size === 0) {
    return { valid: false, meta: null, error: '备份文件为空' };
  }

  const buffer = await readFile(backupFilePath);
  const header = buffer.slice(0, 16).toString('ascii');
  if (!header.startsWith('SQLite format 3')) {
    return { valid: false, meta: null, error: '备份文件不是有效的 SQLite 数据库' };
  }

  const dir = path.dirname(backupFilePath);
  const baseName = path.basename(backupFilePath, '.db');
  const metaPath = path.join(dir, `${baseName}.meta.json`);

  let meta: BackupMeta | null = null;
  try {
    const metaContent = await readFile(metaPath, 'utf-8');
    meta = JSON.parse(metaContent) as BackupMeta;
  } catch {
    // meta file is optional
  }

  return { valid: true, meta };
}

export async function restoreFromBackup(
  backupFilePath: string,
  operatorId?: string,
  operatorName?: string
): Promise<{
  success: boolean;
  snapshotId?: string;
  error?: string;
  needsReload?: boolean;
}> {
  const validation = await validateBackupFile(backupFilePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  let snapshotId: string | undefined;
  try {
    const snapshot = await createBackup('snapshot', operatorId, operatorName, '恢复前自动快照');
    snapshotId = snapshot.id;
  } catch (err) {
    return { success: false, error: `创建恢复前快照失败: ${err instanceof Error ? err.message : '未知错误'}` };
  }

  const dbPath = getDbPath();

  try {
    await copyFile(backupFilePath, dbPath);
  } catch (err) {
    return { success: false, error: `恢复数据库文件失败: ${err instanceof Error ? err.message : '未知错误'}` };
  }

  const meta = await getBackupMeta(path.basename(backupFilePath));
  if (meta?.uploadsFiles && meta.uploadsFiles.length > 0) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }

  try {
    await resetPrismaClient();
  } catch (err) {
    console.warn('重置 Prisma 连接失败:', err);
  }

  return { success: true, snapshotId, needsReload: true };
}

export async function listBackupRecords(options?: {
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: Array<{
    id: string;
    type: string;
    status: string;
    filename: string;
    fileSize: number;
    articleCount: number;
    operatorName?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const { type, status, page = 1, pageSize = 20 } = options || {};
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const [total, records] = await Promise.all([
    prisma.backupRecord.count({ where }),
    prisma.backupRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: records.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      filename: r.filename,
      fileSize: r.fileSize,
      articleCount: r.articleCount,
      operatorName: r.operatorName,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

export async function deleteBackupRecord(id: string): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) {
    return { success: false, error: '备份记录不存在' };
  }

  const safeName = path.basename(record.filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  const metaName = safeName.replace(/\.db$/, '.meta.json');
  const metaPath = path.join(BACKUP_DIR, metaName);

  try {
    await unlink(filePath).catch(() => undefined);
    await unlink(metaPath).catch(() => undefined);
  } catch {
    // ignore file cleanup errors
  }

  await prisma.backupRecord.delete({ where: { id } });
  return { success: true };
}

export async function applyRetentionPolicy(retentionDays: number, retentionCount: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expiredRecords = await prisma.backupRecord.findMany({
    where: {
      type: 'scheduled',
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (expiredRecords.length === 0) return 0;

  const scheduledRecords = await prisma.backupRecord.findMany({
    where: { type: 'scheduled' },
    orderBy: { createdAt: 'desc' },
  });

  const toKeep = new Set(scheduledRecords.slice(0, retentionCount).map((r) => r.id));
  const toDelete = expiredRecords.filter((r) => !toKeep.has(r.id));

  let deletedCount = 0;
  for (const record of toDelete) {
    const result = await deleteBackupRecord(record.id);
    if (result.success) deletedCount++;
  }

  return deletedCount;
}

export async function getScheduleConfig(): Promise<{
  id: string;
  enabled: boolean;
  cronExpression: string;
  retentionDays: number;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
} | null> {
  const schedule = await prisma.backupSchedule.findFirst();
  if (!schedule) return null;
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    cronExpression: schedule.cronExpression,
    retentionDays: schedule.retentionDays,
    retentionCount: schedule.retentionCount,
    lastRunAt: schedule.lastRunAt?.toISOString() || null,
    nextRunAt: schedule.nextRunAt?.toISOString() || null,
  };
}

export async function updateScheduleConfig(data: {
  enabled?: boolean;
  cronExpression?: string;
  retentionDays?: number;
  retentionCount?: number;
}): Promise<{
  id: string;
  enabled: boolean;
  cronExpression: string;
  retentionDays: number;
  retentionCount: number;
}> {
  let schedule = await prisma.backupSchedule.findFirst();

  if (!schedule) {
    schedule = await prisma.backupSchedule.create({
      data: {
        enabled: data.enabled ?? true,
        cronExpression: data.cronExpression ?? '0 2 * * *',
        retentionDays: data.retentionDays ?? 7,
        retentionCount: data.retentionCount ?? 10,
      },
    });
  } else {
    schedule = await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.cronExpression !== undefined && { cronExpression: data.cronExpression }),
        ...(data.retentionDays !== undefined && { retentionDays: data.retentionDays }),
        ...(data.retentionCount !== undefined && { retentionCount: data.retentionCount }),
      },
    });
  }

  return {
    id: schedule.id,
    enabled: schedule.enabled,
    cronExpression: schedule.cronExpression,
    retentionDays: schedule.retentionDays,
    retentionCount: schedule.retentionCount,
  };
}

export async function isMaintenanceMode(): Promise<boolean> {
  const mode = await getMaintenanceMode();
  return mode.enabled;
}

export async function setMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
  await setSysMaintenanceMode({
    enabled,
    ...(message !== undefined && { message }),
  });
}

export async function getBackupStats(): Promise<{
  totalBackups: number;
  totalSize: number;
  latestBackup: string | null;
  scheduleEnabled: boolean;
  maintenanceMode: boolean;
}> {
  const [totalCount, sizeResult, latestRecord, schedule, maintenance] = await Promise.all([
    prisma.backupRecord.count({ where: { type: { in: ['manual', 'scheduled'] } } }),
    prisma.backupRecord.aggregate({
      _sum: { fileSize: true },
      where: { type: { in: ['manual', 'scheduled'] } },
    }),
    prisma.backupRecord.findFirst({
      where: { type: { in: ['manual', 'scheduled'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.backupSchedule.findFirst(),
    isMaintenanceMode(),
  ]);

  return {
    totalBackups: totalCount,
    totalSize: sizeResult._sum.fileSize || 0,
    latestBackup: latestRecord?.createdAt.toISOString() || null,
    scheduleEnabled: schedule?.enabled ?? false,
    maintenanceMode: maintenance,
  };
}
