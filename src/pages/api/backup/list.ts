import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { listBackupRecords } from '@/lib/backup';

export default withAuth(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { type, status, page, pageSize } = req.query;

    const result = await listBackupRecords({
      type: typeof type === 'string' ? type : undefined,
      status: typeof status === 'string' ? status : undefined,
      page: typeof page === 'string' ? parseInt(page, 10) : undefined,
      pageSize: typeof pageSize === 'string' ? parseInt(pageSize, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    return res.status(500).json({
      success: false,
      error: '获取备份列表失败',
    });
  }
});
