import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getBackupStats } from '@/lib/backup';
import { initBackupScheduler } from '@/lib/backup-scheduler';

export default withAuth(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    initBackupScheduler();
    const stats = await getBackupStats();
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取备份统计失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取备份统计失败',
    });
  }
});
