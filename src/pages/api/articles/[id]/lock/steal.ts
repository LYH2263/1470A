import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { stealLock } from '@/lib/storage';
import type {
  ApiResponse,
  StealLockRequest,
  StealLockResponse,
} from '@/types/article';

function validateId(id: string | string[] | undefined): id is string {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function validateSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id } = req.query;

  if (!validateId(id)) {
    return res.status(400).json({
      success: false,
      error: '无效的文章 ID',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const isAdmin = userRole === 'admin';

  try {
    const body = req.body as StealLockRequest;

    if (!validateSessionId(body.sessionId)) {
      return res.status(400).json({
        success: false,
        error: '缺少会话 ID',
      });
    }

    const result = (await stealLock(id, userId, body.sessionId, isAdmin)) as StealLockResponse;

    if (result.stolen) {
      return res.status(200).json({
        success: true,
        data: result,
      });
    } else {
      return res.status(403).json({
        success: false,
        error: result.error || '夺锁失败',
        data: result,
      });
    }
  } catch (error) {
    console.error('强制夺锁失败:', error);
    return res.status(500).json({
      success: false,
      error: '强制夺锁失败',
    });
  }
}

export default withAuth(handler);
