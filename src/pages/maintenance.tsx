import React, { useEffect, useState } from 'react';
import { Result, Button, Spin } from 'antd';
import { useRouter } from 'next/router';
import { fetchWithAuth, getToken } from '@/lib/api';
import type { MaintenanceMode } from '@/types/announcement';

export default function MaintenancePage() {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState<MaintenanceMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const token = getToken();
        if (token) {
          const meResponse = await fetchWithAuth('/api/auth/me');
          if (meResponse.ok) {
            const meResult = await meResponse.json();
            setIsAdmin(meResult.data?.role === 'admin');
          }
        }

        const response = await fetch('/api/system/status');
        if (response.ok) {
          const result = await response.json();
          const mode = result.data?.maintenance;

          if (!mode?.enabled && !isAdmin) {
            router.replace('/');
            return;
          }

          setMaintenance(mode);
        }
      } catch (error) {
        console.error('检查维护模式失败:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [router, isAdmin]);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleGotoAdmin = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 20,
    }}>
      <Result
        status="warning"
        title="系统维护中"
        subTitle={maintenance?.message || '系统正在维护升级中，请稍后访问。'}
        extra={
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button type="primary" onClick={handleGoHome}>
              返回首页
            </Button>
            {isAdmin && (
              <Button onClick={handleGotoAdmin}>
                进入管理后台
              </Button>
            )}
          </div>
        }
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 48,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: 500,
          width: '100%',
        }}
      />
      {maintenance?.startTime && (
        <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
          维护开始时间：{new Date(maintenance.startTime).toLocaleString('zh-CN')}
          {maintenance.endTime && `，预计结束时间：${new Date(maintenance.endTime).toLocaleString('zh-CN')}`}
        </div>
      )}
    </div>
  );
}
