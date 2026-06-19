import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'react-quill/dist/quill.snow.css';
import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPublicPage = router.pathname === '/login';

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
          {isPublicPage ? (
            <Component {...pageProps} />
          ) : (
            <ProtectedRoute>
              <Component {...pageProps} />
            </ProtectedRoute>
          )}
        </AuthProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
