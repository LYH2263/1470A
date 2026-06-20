import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { message } from 'antd';
import { fetchWithAuth } from '@/lib/api';
import type {
  LockStatus,
  ArticleEditLock,
  AcquireLockResponse,
  HeartbeatResponse,
  ReleaseLockResponse,
  StealLockResponse,
} from '@/types/article';
import { LOCK_CONSTANTS } from '@/types/article';

const SESSION_ID_KEY = 'edit_session_id';
const BROADCAST_CHANNEL_NAME = 'article_edit_lock';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

interface UseEditLockOptions {
  articleId: string;
  userId: string;
  userRole: string;
  autoAcquire?: boolean;
  onLockLost?: () => void;
  onLockAcquired?: () => void;
}

interface UseEditLockReturn {
  lockStatus: LockStatus | null;
  isLoading: boolean;
  error: string | null;
  canEdit: boolean;
  currentLock: ArticleEditLock | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<boolean>;
  stealLock: () => Promise<boolean>;
  refreshLockStatus: () => Promise<void>;
}

export function useEditLock({
  articleId,
  userId,
  userRole,
  autoAcquire = true,
  onLockLost,
  onLockAcquired,
}: UseEditLockOptions): UseEditLockReturn {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLock, setCurrentLock] = useState<ArticleEditLock | null>(null);

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isUnmountingRef = useRef(false);
  const sessionIdRef = useRef<string>('');
  const isFetchingRef = useRef(false);
  const isAcquiringRef = useRef(false);
  const hasAutoAcquiredRef = useRef(false);
  const currentArticleIdRef = useRef<string>('');

  const onLockLostRef = useRef(onLockLost);
  const onLockAcquiredRef = useRef(onLockAcquired);
  const userRoleRef = useRef(userRole);

  useEffect(() => {
    onLockLostRef.current = onLockLost;
  }, [onLockLost]);

  useEffect(() => {
    onLockAcquiredRef.current = onLockAcquired;
  }, [onLockAcquired]);

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeatTimer();

    const heartbeat = async () => {
      if (isUnmountingRef.current) return;
      if (currentArticleIdRef.current !== articleId) return;

      try {
        const response = await fetchWithAuth(`/api/articles/${articleId}/lock`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
          }),
        });

        const result = (await response.json()) as { data: HeartbeatResponse };

        if (response.ok && result.data?.renewed) {
          if (!isUnmountingRef.current && currentArticleIdRef.current === articleId) {
            heartbeatTimerRef.current = setTimeout(
              heartbeat,
              LOCK_CONSTANTS.HEARTBEAT_INTERVAL_MS
            );
          }
        } else {
          message.warning('编辑锁已过期，页面将变为只读模式');
          setLockStatus((prev) =>
            prev ? { ...prev, isLockedByMe: false, isLocked: true } : null
          );
          setCurrentLock(null);
          clearHeartbeatTimer();
          onLockLostRef.current?.();

          try {
            const statusResponse = await fetchWithAuth(`/api/articles/${articleId}/lock`);
            const statusResult = (await statusResponse.json()) as { data: LockStatus };
            if (statusResponse.ok && statusResult.data && !isUnmountingRef.current) {
              setLockStatus(statusResult.data);
              setCurrentLock(statusResult.data.lock || null);
            }
          } catch (e) {
            console.error('刷新锁状态失败:', e);
          }
        }
      } catch (err) {
        console.error('心跳失败:', err);
        if (!isUnmountingRef.current && currentArticleIdRef.current === articleId) {
          heartbeatTimerRef.current = setTimeout(
            heartbeat,
            LOCK_CONSTANTS.HEARTBEAT_INTERVAL_MS
          );
        }
      }
    };

    heartbeatTimerRef.current = setTimeout(heartbeat, LOCK_CONSTANTS.HEARTBEAT_INTERVAL_MS);
  }, [articleId, clearHeartbeatTimer]);

  const fetchLockStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/articles/${articleId}/lock`);
      const result = (await response.json()) as { data: LockStatus };

      if (response.ok && result.data) {
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('获取锁状态失败:', err);
      setError('获取锁状态失败');
      return null;
    }
  }, [articleId]);

  const updateLockState = useCallback((status: LockStatus | null) => {
    if (!status) return;

    setLockStatus(status);
    setCurrentLock(status.lock || null);
    setError(null);

    if (status.isLockedByMe && status.lock) {
      if (!heartbeatTimerRef.current) {
        startHeartbeat();
      }
    } else {
      clearHeartbeatTimer();
    }
  }, [startHeartbeat, clearHeartbeatTimer]);

  const refreshLockStatus = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (currentArticleIdRef.current !== articleId) return;

    isFetchingRef.current = true;
    try {
      const status = await fetchLockStatus();
      if (!isUnmountingRef.current && currentArticleIdRef.current === articleId) {
        updateLockState(status);
      }
    } finally {
      if (!isUnmountingRef.current) {
        isFetchingRef.current = false;
      }
    }
  }, [articleId, fetchLockStatus, updateLockState]);

  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (isAcquiringRef.current) return false;
    if (currentArticleIdRef.current !== articleId) return false;

    isAcquiringRef.current = true;
    try {
      const response = await fetchWithAuth(`/api/articles/${articleId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
        }),
      });

      const result = (await response.json()) as {
        data: AcquireLockResponse;
        error?: string;
      };

      if (response.ok && result.data?.acquired && result.data.lock) {
        const newStatus: LockStatus = {
          isLocked: true,
          isLockedByMe: true,
          lock: result.data.lock,
          expiresAt: result.data.lock.expiresAt,
        };
        setLockStatus(newStatus);
        setCurrentLock(result.data.lock);
        setError(null);
        if (!heartbeatTimerRef.current) {
          startHeartbeat();
        }
        onLockAcquiredRef.current?.();
        broadcastChannelRef.current?.postMessage({
          type: 'LOCK_ACQUIRED',
          articleId,
          lock: result.data.lock,
        });
        return true;
      } else {
        const errorMsg = result.error || result.data?.error || '无法获取编辑锁';
        setError(errorMsg);
        return false;
      }
    } catch (err) {
      console.error('申请锁失败:', err);
      setError('申请锁失败');
      return false;
    } finally {
      if (!isUnmountingRef.current) {
        isAcquiringRef.current = false;
      }
    }
  }, [articleId, startHeartbeat]);

  const releaseLock = useCallback(async (): Promise<boolean> => {
    try {
      clearHeartbeatTimer();
      const response = await fetchWithAuth(`/api/articles/${articleId}/lock`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
        }),
      });

      const result = (await response.json()) as { data: ReleaseLockResponse };

      if (response.ok && result.data?.released) {
        setLockStatus((prev) =>
          prev ? { ...prev, isLockedByMe: false, isLocked: false } : null
        );
        setCurrentLock(null);
        setError(null);
        broadcastChannelRef.current?.postMessage({
          type: 'LOCK_RELEASED',
          articleId,
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('释放锁失败:', err);
      return false;
    }
  }, [articleId, clearHeartbeatTimer]);

  const stealLock = useCallback(async (): Promise<boolean> => {
    if (userRoleRef.current !== 'admin') {
      setError('只有管理员可以强制夺锁');
      return false;
    }

    try {
      const response = await fetchWithAuth(`/api/articles/${articleId}/lock/steal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
        }),
      });

      const result = (await response.json()) as {
        data: StealLockResponse;
        error?: string;
      };

      if (response.ok && result.data?.stolen && result.data.lock) {
        const newStatus: LockStatus = {
          isLocked: true,
          isLockedByMe: true,
          lock: result.data.lock,
          expiresAt: result.data.lock.expiresAt,
        };
        setLockStatus(newStatus);
        setCurrentLock(result.data.lock);
        setError(null);
        if (!heartbeatTimerRef.current) {
          startHeartbeat();
        }
        onLockAcquiredRef.current?.();
        broadcastChannelRef.current?.postMessage({
          type: 'LOCK_STOLEN',
          articleId,
          lock: result.data.lock,
        });
        message.success('已成功获取编辑权限');
        return true;
      } else {
        setError(result.error || result.data?.error || '夺锁失败');
        return false;
      }
    } catch (err) {
      console.error('夺锁失败:', err);
      setError('夺锁失败');
      return false;
    }
  }, [articleId, startHeartbeat]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionIdRef.current = getOrCreateSessionId();
    }
  }, []);

  useEffect(() => {
    if (!articleId || !userId) return;

    isUnmountingRef.current = false;
    hasAutoAcquiredRef.current = false;
    isFetchingRef.current = false;
    isAcquiringRef.current = false;
    currentArticleIdRef.current = articleId;
    setIsLoading(true);
    setLockStatus(null);
    setCurrentLock(null);
    setError(null);
    clearHeartbeatTimer();

    const initializeLock = async () => {
      const status = await fetchLockStatus();

      if (isUnmountingRef.current || currentArticleIdRef.current !== articleId) return;

      updateLockState(status);
      setIsLoading(false);

      if (autoAcquire && status && !status.isLocked && !hasAutoAcquiredRef.current) {
        hasAutoAcquiredRef.current = true;
        await acquireLock();
      }
    };

    initializeLock();

    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.articleId !== articleId) return;
        if (currentArticleIdRef.current !== articleId) return;

        switch (event.data.type) {
          case 'LOCK_ACQUIRED':
          case 'LOCK_STOLEN':
            if (event.data.lock?.userId !== userId) {
              message.warning(`${event.data.lock.user.name} 正在编辑此文章`);
              const newStatus: LockStatus = {
                isLocked: true,
                isLockedByMe: false,
                lock: event.data.lock,
                expiresAt: event.data.lock.expiresAt,
              };
              setLockStatus(newStatus);
              setCurrentLock(event.data.lock);
              clearHeartbeatTimer();
              onLockLostRef.current?.();
            }
            break;
          case 'LOCK_RELEASED':
            refreshLockStatus();
            break;
        }
      };
    }

    const handleBeforeUnload = () => {
      if (lockStatus?.isLockedByMe) {
        navigator.sendBeacon(
          `/api/articles/${articleId}/lock`,
          JSON.stringify({
            sessionId: sessionIdRef.current,
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isUnmountingRef.current = true;
      hasAutoAcquiredRef.current = false;
      clearHeartbeatTimer();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
    };
  }, [articleId, userId, autoAcquire, clearHeartbeatTimer, fetchLockStatus, updateLockState, acquireLock, refreshLockStatus]);

  const canEdit = !!lockStatus?.isLockedByMe;

  return {
    lockStatus,
    isLoading,
    error,
    canEdit,
    currentLock,
    acquireLock,
    releaseLock,
    stealLock,
    refreshLockStatus,
  };
}
