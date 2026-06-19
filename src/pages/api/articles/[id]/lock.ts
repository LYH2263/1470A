import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  getLockStatus,
  acquireLock,
  renewLock,
  releaseLock,
} from '@/lib/storage';
import type {
  ApiResponse,
  AcquireLockRequest,
  AcquireLockResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  ReleaseLockRequest,
  ReleaseLockResponse,
  LockStatus,
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

  const userId = req.user!.userId;

  if (req.method === 'GET') {
    try {
      const status = await getLockStatus(id, userId) as LockStatus;
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('获取锁状态失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取锁状态失败',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body as AcquireLockRequest;

      if (!validateSessionId(body.sessionId)) {
        return res.status(400).json({
          success: false,
          error: '缺少会话 ID',
        });
      }

      const result = await acquireLock(id, userId, body.sessionId) as AcquireLockResponse;

      if (result.acquired) {
        return res.status(200).json({
          success: true,
          data: result,
        });
      } else {
        return res.status(409).json({
          success: false,
          error: result.error || '无法获取锁',
          data: result,
        });
      }
    } catch (error) {
      console.error('申请锁失败:', error);
      return res.status(500).json({
        success: false,
        error: '申请锁失败',
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body as HeartbeatRequest;

      if (!validateSessionId(body.sessionId)) {
        return res.status(400).json({
          success: false,
          error: '缺少会话 ID',
        });
      }

      const result = await renewLock(id, userId, body.sessionId) as HeartbeatResponse;

      if (result.renewed) {
        return res.status(200).json({
          success: true,
          data: result,
        });
      } else {
        return res.status(410).json({
          success: false,
          error: result.error || '续约失败',
          data: result,
        });
      }
    } catch (error) {
      console.error('心跳续约失败:', error);
      return res.status(500).json({
        success: false,
        error: '心跳续约失败',
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const body = (req.body || {}) as ReleaseLockRequest;

      if (!validateSessionId(body.sessionId)) {
        return res.status(400).json({
          success: false,
          error: '缺少会话 ID',
        });
      }

      const result = await releaseLock(id, userId, body.sessionId) as ReleaseLockResponse;

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('释放锁失败:', error);
      return res.status(500).json({
        success: false,
        error: '释放锁失败',
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
  });
}

export default withAuth(handler);
