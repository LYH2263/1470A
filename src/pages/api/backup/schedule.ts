import type { NextApiResponse } from 'next';
import { withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import { getScheduleConfig, updateScheduleConfig } from '@/lib/backup';

export default withAdmin(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const schedule = await getScheduleConfig();
      return res.status(200).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      console.error('获取定时备份配置失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取定时备份配置失败',
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { enabled, cronExpression, retentionDays, retentionCount } = req.body;

      if (cronExpression !== undefined) {
        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length < 5 || parts.length > 6) {
          return res.status(400).json({
            success: false,
            error: 'cron 表达式格式不正确，至少需要 5 个字段',
          });
        }
      }

      if (retentionDays !== undefined && (retentionDays < 1 || retentionDays > 365)) {
        return res.status(400).json({
          success: false,
          error: '保留天数须在 1~365 之间',
        });
      }

      if (retentionCount !== undefined && (retentionCount < 1 || retentionCount > 100)) {
        return res.status(400).json({
          success: false,
          error: '保留份数须在 1~100 之间',
        });
      }

      const schedule = await updateScheduleConfig({
        enabled,
        cronExpression,
        retentionDays,
        retentionCount,
      });

      return res.status(200).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      console.error('更新定时备份配置失败:', error);
      return res.status(500).json({
        success: false,
        error: '更新定时备份配置失败',
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
});
