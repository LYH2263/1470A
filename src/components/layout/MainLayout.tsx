import { Layout } from 'antd';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import AnnouncementBar from '@/components/announcements/AnnouncementBar';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AnnouncementBar />
      <TopNav />
      <Layout>
        <Sidebar />
        <Layout style={{ padding: '0' }}>
          <Content
            style={{
              background: '#f0f2f5',
              minHeight: 280,
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
