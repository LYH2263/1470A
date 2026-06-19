import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-this';
const JWT_EXPIRES_IN = '7d'; // 7天过期
const BCRYPT_ROUNDS = 10;

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: string;
}

/**
 * 生成JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * 验证JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 根据用户名查询用户
 */
export async function getUserByUsername(username: string): Promise<UserInfo | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      password: true,
    },
  });

  if (!user) {
    return null;
  }

  // 不返回密码字段
  const { password, ...userInfo } = user;
  return userInfo;
}

/**
 * 根据用户名查询用户（包含密码，用于登录验证）
 */
export async function getUserWithPassword(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      password: true,
    },
  });
}

/**
 * 根据ID查询用户
 */
export async function getUserById(userId: string): Promise<UserInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
    },
  });

  return user;
}
