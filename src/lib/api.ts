const TOKEN_KEY = 'auth_token';

/**
 * 获取存储的token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 保存token
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 删除token
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 带认证的fetch请求
 * 自动添加Authorization header
 * 处理401响应（清除token并跳转登录页）
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 处理401未授权响应
  if (response.status === 401) {
    removeToken();
    // 只在浏览器环境中跳转
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return response;
}
