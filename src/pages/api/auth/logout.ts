import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiResponse {
  success: boolean;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '仅支持POST请求',
    });
  }

  // JWT是无状态的，登出由客户端删除token即可
  // 这个端点主要用于未来可能的扩展（如token黑名单）
  return res.status(200).json({
    success: true,
    message: '登出成功',
  });
}
