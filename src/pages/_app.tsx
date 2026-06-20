import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { Spin } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'react-quill/dist/quill.snow.css';
import '@/styles/globals.css';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SystemStatusProvider, useSystemStatus } from '@/contexts/SystemStatusContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { fetchWithAuth, getToken } from '@/lib/api';

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { maintenance, refreshStatus } = useSystemStatus();
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const adminCheckedRef = useRef(false);
  const isAdminRef = useRef(false);

  useEffect(() => {
    const checkMaintenance = async () => {
      if (router.pathname === '/maintenance' || router.pathname === '/login') {
        setChecking(false);
        return;
      }

      if (!maintenance) {
        setChecking(false);
        return;
      }

      if (maintenance.enabled) {
        if (!adminCheckedRef.current) {
          const token = getToken();
          let isAdmin = user?.role === 'admin';

          if (!isAdmin && token) {
            try {
              const meResponse = await fetchWithAuth('/api/auth/me');
              if (meResponse.ok) {
                const meResult = await meResponse.json();
                isAdmin = meResult.data?.role === 'admin';
              }
            } catch {
              isAdmin = false;
            }
          }

          isAdminRef.current = isAdmin;
          adminCheckedRef.current = true;
        }

        if (!isAdminRef.current) {
          router.replace('/maintenance');
          return;
        }
      } else {
        adminCheckedRef.current = false;
        isAdminRef.current = false;
      }

      setChecking(false);
    };

    checkMaintenance();
  }, [maintenance, router, user, refreshStatus]);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppContent(props: AppProps) {
  const { Component, pageProps } = props;
  const router = useRouter();
  const isPublicPage = router.pathname === '/login' || router.pathname === '/maintenance';

  return (
    <MaintenanceGuard>
      {isPublicPage ? (
        <Component {...pageProps} />
      ) : (
        <ProtectedRoute>
          <Component {...pageProps} />
        </ProtectedRoute>
      )}
    </MaintenanceGuard>
  );
}

export default function App(props: AppProps) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <AuthProvider>
          <SystemStatusProvider>
            <AppContent {...props} />
          </SystemStatusProvider>
        </AuthProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
