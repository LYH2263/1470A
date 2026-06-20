import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken, getUserById, type JWTPayload } from './auth';
import { getMaintenanceMode, getMaintenanceExemptPaths, isPathExempt } from './system-status';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: JWTPayload;
}

type ApiHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void> | void;

const HARDCODED_EXEMPT_PATHS = ['/api/health', '/api/auth/login', '/api/system/status', '/login'];

export async function checkMaintenanceMode(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  const path = req.url || '';

  const configuredExemptPaths = await getMaintenanceExemptPaths();
  const allExemptPaths = [...new Set([...HARDCODED_EXEMPT_PATHS, ...configuredExemptPaths])];

  if (isPathExempt(path, allExemptPaths)) {
    return false;
  }

  const maintenance = await getMaintenanceMode();
  if (!maintenance.enabled) {
    return false;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload && payload.role === 'admin') {
      return false;
    }
  }

  res.status(503).json({
    success: false,
    error: {
      code: 'MAINTENANCE_MODE',
      message: maintenance.message || '系统正在维护中，请稍后访问。',
    },
  });
  return true;
}

export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      const blocked = await checkMaintenanceMode(req, res);
      if (blocked) return;

      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未提供认证令牌',
          },
        });
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: '认证令牌无效或已过期',
          },
        });
      }

      const user = await getUserById(payload.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
          },
        });
      }

      req.user = payload;
      return handler(req, res);
    } catch (error) {
      console.error('认证中间件错误:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      });
    }
  };
}

export function withAdmin(handler: ApiHandler): ApiHandler {
  return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '仅管理员可执行此操作',
        },
      });
    }
    return handler(req, res);
  });
}

export function withMaintenanceCheck(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const blocked = await checkMaintenanceMode(req, res);
    if (blocked) return;
    return handler(req, res);
  };
}
