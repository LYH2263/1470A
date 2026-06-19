import type { NextApiRequest, NextApiResponse } from 'next';
import { getSystemStatus } from '@/lib/system-status';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: '方法不允许' },
    });
  }

  try {
    const status = await getSystemStatus();
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取系统状态失败' },
    });
  }
}
