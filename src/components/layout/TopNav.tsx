import { Layout, Dropdown } from 'antd';
import { UserOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

const { Header } = Layout;

export default function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Header
      style={{
        background: '#1890ff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
        文章管理系统
      </div>
      <Dropdown menu={{ items: menuItems }} placement="bottomRight">
        <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <UserOutlined />
          <span>{user?.name || '用户'}</span>
          <DownOutlined style={{ fontSize: '12px' }} />
        </div>
      </Dropdown>
    </Header>
  );
}
