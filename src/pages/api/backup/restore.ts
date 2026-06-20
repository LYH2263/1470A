import type { NextApiResponse } from 'next';
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import formidable from 'formidable';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import {
  validateBackupFile,
  restoreFromBackup,
  setMaintenanceMode,
  isMaintenanceMode,
} from '@/lib/backup';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const wasMaintenance = await isMaintenanceMode();

  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    await mkdir(backupDir, { recursive: true });

    const form = formidable({
      maxFileSize: 500 * 1024 * 1024,
    });
    const [, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({ success: false, error: '请选择要上传的备份文件' });
    }

    const uploadPath = path.join(backupDir, `upload-${Date.now()}.db`);

    try {
      const buffer = await readFile(file.filepath);
      await writeFile(uploadPath, buffer);

      const validation = await validateBackupFile(uploadPath);
      if (!validation.valid) {
        await unlink(uploadPath).catch(() => undefined);
        return res.status(400).json({
          success: false,
          error: `备份文件校验失败: ${validation.error}`,
        });
      }

      if (!wasMaintenance) {
        await setMaintenanceMode(true);
      }

      const result = await restoreFromBackup(
        uploadPath,
        req.user!.userId,
        req.user!.username
      );

      if (!wasMaintenance) {
        await setMaintenanceMode(false);
      }

      await unlink(uploadPath).catch(() => undefined);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          snapshotId: result.snapshotId,
          message: '数据恢复成功',
          needsReload: result.needsReload,
        },
      });
    } finally {
      await unlink(file.filepath).catch(() => undefined);
    }
  } catch (error) {
    console.error('恢复备份失败:', error);
    if (!wasMaintenance) {
      await setMaintenanceMode(false).catch(() => undefined);
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '恢复备份失败',
    });
  }
});
