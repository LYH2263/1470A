import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { withAuth, withAdmin, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getActiveAnnouncements,
  getAllAnnouncements,
  createAnnouncement,
} from '@/lib/system-status';
import type { AnnouncementLevel } from '@/types/announcement';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  level: z.enum(['normal', 'important', 'urgent']) as z.ZodType<AnnouncementLevel>,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  isActive: z.boolean().default(true),
}).refine(data => data.endTime > data.startTime, {
  message: '结束时间必须晚于开始时间',
  path: ['endTime'],
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: '方法不允许' },
      });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse) {
  const { all } = req.query;
  const isAdmin = req.user?.role === 'admin';

  try {
    let announcements;
    if (all === 'true' && isAdmin) {
      announcements = await getAllAnnouncements();
    } else {
      announcements = await getActiveAnnouncements();
    }

    return res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    console.error('获取公告失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取公告失败' },
    });
  }
}

async function handlePost(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: '仅管理员可发布公告' },
    });
  }

  try {
    const validated = createSchema.parse(req.body);
    const announcement = await createAnnouncement(validated, req.user.userId);

    return res.status(201).json({
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
    console.error('创建公告失败:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '创建公告失败' },
    });
  }
}

export default withAuth(handler);
