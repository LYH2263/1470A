import type { NextApiResponse } from 'next';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import { deleteBackupRecord } from '@/lib/backup';

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: '缺少 id 参数' });
  }

  try {
    const result = await deleteBackupRecord(id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('删除备份失败:', error);
    return res.status(500).json({
      success: false,
      error: '删除备份失败',
    });
  }
});
