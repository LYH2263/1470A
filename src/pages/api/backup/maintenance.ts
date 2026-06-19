import type { NextApiResponse } from 'next';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import { setMaintenanceMode, isMaintenanceMode } from '@/lib/backup';

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const enabled = await isMaintenanceMode();
      return res.status(200).json({
        success: true,
        data: { enabled },
      });
    } catch (error) {
      console.error('获取维护模式状态失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取维护模式状态失败',
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'enabled 参数须为布尔值',
        });
      }

      await setMaintenanceMode(enabled);
      return res.status(200).json({
        success: true,
        data: { enabled },
      });
    } catch (error) {
      console.error('设置维护模式失败:', error);
      return res.status(500).json({
        success: false,
        error: '设置维护模式失败',
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
});
