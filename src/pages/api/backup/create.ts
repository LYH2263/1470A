import type { NextApiResponse } from 'next';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import { createBackup, isMaintenanceMode } from '@/lib/backup';

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const maintenance = await isMaintenanceMode();
  if (maintenance) {
    return res.status(503).json({
      success: false,
      error: '系统维护中，无法执行备份操作',
    });
  }

  try {
    const { note } = req.body || {};
    const result = await createBackup(
      'manual',
      req.user!.userId,
      req.user!.username,
      note
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('创建备份失败:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建备份失败',
    });
  }
});
