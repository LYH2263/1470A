import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getMaintenanceMode, setMaintenanceMode } from '@/lib/system-status';
import type { MaintenanceMode } from '@/types/announcement';

const setSchema = z.object({
  enabled: z.boolean().optional(),
  message: z.string().min(1).max(1000).optional(),
  startTime: z.coerce.date().optional().nullable(),
  endTime: z.coerce.date().optional().nullable(),
  exemptPaths: z.array(z.string()).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'PUT':
      return handlePut(req, res);
    default:
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: '方法不允许' },
      });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    const mode = await getMaintenanceMode();

    if (req.user?.role !== 'admin') {
      return res.status(200).json({
        success: true,
        data: {
          enabled: mode.enabled,
          message: mode.message,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: mode,
    });
  } catch (error) {
    console.error('获取维护模式失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取维护模式失败' },
    });
  }
}

async function handlePut(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: '仅管理员可操作' },
    });
  }

  try {
    const validated = setSchema.parse(req.body);
    const mode = await setMaintenanceMode(validated as Partial<MaintenanceMode>);

    return res.status(200).json({
      success: true,
      data: mode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '参数验证失败', details: error.issues },
      });
    }
    console.error('设置维护模式失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '设置维护模式失败' },
    });
  }
}

export default withAuth(handler);
