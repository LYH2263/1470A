import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Spin, message, Button, Space, Alert, Tag, Modal, Tooltip, Skeleton } from 'antd';
import { LockOutlined, UnlockOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import ArticleForm from '@/components/articles/ArticleForm';
import MainLayout from '@/components/layout/MainLayout';
import type { Article } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useEditLock } from '@/hooks/useEditLock';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export default function EditArticlePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [showStealConfirm, setShowStealConfirm] = useState(false);
  const hasReleasedLockRef = useRef(false);

  const {
    lockStatus,
    isLoading: lockLoading,
    error: lockError,
    canEdit,
    currentLock,
    releaseLock,
    stealLock,
    refreshLockStatus,
  } = useEditLock({
    articleId: id as string,
    userId: user?.id || '',
    userRole: user?.role || '',
    autoAcquire: true,
    onLockLost: () => {
      message.warning('您的编辑权限已丢失');
    },
    onLockAcquired: () => {
      message.success('已获得编辑权限');
    },
  });

  const isAdmin = user?.role === 'admin';
  const isLockedByOther = lockStatus?.isLocked && !lockStatus?.isLockedByMe;

  const handleBack = useCallback(async () => {
    if (canEdit && article && !hasReleasedLockRef.current) {
      hasReleasedLockRef.current = true;
      await releaseLock();
    }
    router.back();
  }, [canEdit, article, releaseLock, router]);

  const handleStealLock = useCallback(async () => {
    setShowStealConfirm(false);
    await stealLock();
  }, [stealLock]);

  const handleConflict = useCallback((currentArticle: Article) => {
    console.log('检测到版本冲突，最新文章:', currentArticle);
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchArticle = async () => {
      try {
        const response = await fetchWithAuth(`/api/articles/${id}`);
        const result = await response.json();

        if (cancelled) return;

        if (result.success) {
          setArticle(result.data);
        } else {
          message.error(result.error || '获取文章失败');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('获取文章失败:', error);
        message.error('获取文章失败');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchArticle();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const handleRouteChange = () => {
      if (canEdit && !hasReleasedLockRef.current) {
        hasReleasedLockRef.current = true;
        releaseLock();
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [canEdit, releaseLock, router.events]);

  if (loading) {
    return (
      <MainLayout>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  if (!article) {
    return (
      <MainLayout>
        <div style={{ padding: '24px' }}>
          <Card>文章不存在</Card>
        </div>
      </MainLayout>
    );
  }

  const renderLockStatus = () => {
    if (lockLoading || !lockStatus) {
      return (
        <Tag color="default">
          <Spin size="small" style={{ marginRight: 8 }} />
          加载中
        </Tag>
      );
    }

    if (lockStatus.isLockedByMe) {
      return (
        <Tag color="green" icon={<UnlockOutlined />}>
          您正在编辑
        </Tag>
      );
    }

    if (isLockedByOther && currentLock) {
      return (
        <Space>
          <Tag color="red" icon={<LockOutlined />}>
            {currentLock.user.name} 正在编辑
          </Tag>
          <Tooltip
            title={`自 ${dayjs(currentLock.lastHeartbeat).format('HH:mm:ss')} 开始，将在 ${dayjs(currentLock.expiresAt).format('HH:mm:ss')} 过期`}
          >
            <Tag icon={<WarningOutlined />}>
              {dayjs(currentLock.expiresAt).fromNow()} 过期
            </Tag>
          </Tooltip>
        </Space>
      );
    }

    return (
      <Tag color="default" icon={<UnlockOutlined />}>
        可编辑
      </Tag>
    );
  };

  const renderLockAlert = () => {
    if (!isLockedByOther || !currentLock) return null;

    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: '16px' }}
        message={
          <Space>
            <UserOutlined />
            <span>
              <strong>{currentLock.user.name}</strong> ({currentLock.user.username}) 正在编辑此文章
            </span>
            {isAdmin && (
              <Button
                type="primary"
                danger
                size="small"
                onClick={() => setShowStealConfirm(true)}
              >
                强制夺锁
              </Button>
            )}
          </Space>
        }
        description={
          <div>
            <p>您当前处于只读模式，无法保存修改。</p>
            <p>
              该锁将在 <strong>{dayjs(currentLock.expiresAt).format('YYYY-MM-DD HH:mm:ss')}</strong> 自动过期
              （{dayjs(currentLock.expiresAt).fromNow()}）。
            </p>
          </div>
        }
      />
    );
  };

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {lockError && (
          <Alert
            type="error"
            message={lockError}
            showIcon
            style={{ marginBottom: '16px' }}
            action={
              <Button size="small" onClick={refreshLockStatus}>
                重试
              </Button>
            }
          />
        )}

        {renderLockAlert()}

        <Card
          title={
            <Space>
              <span>编辑文章</span>
              {renderLockStatus()}
            </Space>
          }
          extra={
            <Space>
              {lockLoading ? (
                <Skeleton.Button active size="small" style={{ width: 64 }} />
              ) : canEdit ? (
                <Button type="primary" form="article-form" htmlType="submit">
                  保存
                </Button>
              ) : isLockedByOther && isAdmin ? (
                <Button type="primary" danger onClick={() => setShowStealConfirm(true)}>
                  强制夺锁
                </Button>
              ) : null}
              <Button onClick={handleBack}>返回</Button>
            </Space>
          }
        >
          {lockLoading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <ArticleForm
              mode="edit"
              initialValues={article}
              formId="article-form"
              readOnly={!canEdit}
              onConflict={handleConflict}
            />
          )}
        </Card>

        <Modal
          title="确认夺锁"
          open={showStealConfirm}
          onOk={handleStealLock}
          onCancel={() => setShowStealConfirm(false)}
          okText="确认夺锁"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <p>您确定要强制夺锁吗？</p>
          <p>
            此操作将导致 <strong>{currentLock?.user.name}</strong> 失去编辑权限，
            他们未保存的修改可能会丢失。
          </p>
        </Modal>
      </div>
    </MainLayout>
  );
}
