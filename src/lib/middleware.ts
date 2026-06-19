import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken, getUserById, type JWTPayload } from './auth';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: JWTPayload;
}

type ApiHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void> | void;

/**
 * 认证中间件 - 保护API路由
 * 从Authorization header提取token并验证
 */
export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // 从Authorization header获取token
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

      const token = authHeader.substring(7); // 移除 "Bearer " 前缀

      // 验证token
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

      // 验证用户是否存在
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

      // 将用户信息附加到请求对象
      req.user = payload;

      // 调用原始handler
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
