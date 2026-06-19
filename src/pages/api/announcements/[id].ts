import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/system-status';
import type { AnnouncementLevel, UpdateAnnouncementInput } from '@/types/announcement';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  level: z.enum(['normal', 'important', 'urgent']).optional() as z.ZodOptional<z.ZodType<AnnouncementLevel>>,
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
}).refine(data => {
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: '结束时间必须晚于开始时间',
  path: ['endTime'],
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: '仅管理员可操作' },
    });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: '无效的公告ID' },
    });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(id, res);
    case 'PUT':
      return handlePut(id, req, res);
    case 'DELETE':
      return handleDelete(id, res);
    default:
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: '方法不允许' },
      });
  }
}

async function handleGet(id: string, res: NextApiResponse) {
  try {
    const announcement = await getAnnouncementById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '公告不存在' },
      });
    }
    return res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    console.error('获取公告失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取公告失败' },
    });
  }
}

async function handlePut(id: string, req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    const validated = updateSchema.parse(req.body) as UpdateAnnouncementInput;
    const announcement = await updateAnnouncement(id, validated);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '公告不存在' },
      });
    }

    return res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '参数验证失败', details: error.issues },
      });
    }
    console.error('更新公告失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '更新公告失败' },
    });
  }
}

async function handleDelete(id: string, res: NextApiResponse) {
  try {
    const announcement = await getAnnouncementById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '公告不存在' },
      });
    }

    await deleteAnnouncement(id);
    return res.status(200).json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除公告失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '删除公告失败' },
    });
  }
}

export default withAuth(handler);
