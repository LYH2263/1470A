import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserWithPassword, verifyPassword, generateToken } from '@/lib/auth';

interface LoginRequest {
  username: string;
  password: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      username: string;
      name: string;
      role: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// 防暴力破解：记录失败次数
const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15分钟

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持POST请求',
      },
    });
  }

  try {
    const { username, password } = req.body as LoginRequest;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '用户名和密码不能为空',
        },
      });
    }

    // 检查是否被锁定
    const attempts = loginAttempts.get(username);
    if (attempts && attempts.lockUntil > Date.now()) {
      const remainingTime = Math.ceil((attempts.lockUntil - Date.now()) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `登录失败次数过多，请在${remainingTime}分钟后重试`,
        },
      });
    }

    // 查询用户
    const user = await getUserWithPassword(username);

    if (!user) {
      // 记录失败次数
      recordFailedAttempt(username);

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
        },
      });
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      // 记录失败次数
      recordFailedAttempt(username);

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
        },
      });
    }

    // 清除失败记录
    loginAttempts.delete(username);

    // 生成token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 返回用户信息（不包含密码）
    const { password: _, ...userInfo } = user;

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: userInfo,
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
      },
    });
  }
}

function recordFailedAttempt(username: string) {
  const attempts = loginAttempts.get(username) || { count: 0, lockUntil: 0 };
  attempts.count += 1;

  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.lockUntil = Date.now() + LOCK_TIME;
  }

  loginAttempts.set(username, attempts);
}
