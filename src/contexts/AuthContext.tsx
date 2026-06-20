import React, { createContext, useContext, useState, ReactNode } from 'react';
import { getToken, setToken as saveToken, removeToken } from '@/lib/api';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = 'auth_user';

function readStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }

  const storedToken = getToken();
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedToken || !storedUser) {
    return { user: null, token: null };
  }

  try {
    return { user: JSON.parse(storedUser), token: storedToken };
  } catch (error) {
    console.error('解析用户信息失败:', error);
    removeToken();
    localStorage.removeItem(USER_KEY);
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialAuth = readStoredAuth();
  const [user, setUser] = useState<User | null>(initialAuth.user);
  const [token, setToken] = useState<string | null>(initialAuth.token);
  const [loading] = useState(false);

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '登录失败');
    }

    const { token: newToken, user: newUser } = result.data;

    // 保存到state和localStorage
    setToken(newToken);
    setUser(newUser);
    saveToken(newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    removeToken();
    localStorage.removeItem(USER_KEY);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
