import type { NextApiResponse } from 'next';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getUserById } from '@/lib/auth';

interface ApiResponse {
  success: boolean;
  data?: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持GET请求',
      },
    });
  }

  try {
    // req.user由withAuth中间件注入
    const userId = req.user!.userId;

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

export default withAuth(handler);
