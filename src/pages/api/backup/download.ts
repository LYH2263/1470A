import type { NextApiResponse } from 'next';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import { getBackupFilePath } from '@/lib/backup';
import { readFile } from 'fs/promises';

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { filename } = req.query;
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ success: false, error: '缺少 filename 参数' });
  }

  try {
    const filePath = await getBackupFilePath(filename);
    const buffer = await readFile(filePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('下载备份失败:', error);
    return res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : '下载备份失败',
    });
  }
});
