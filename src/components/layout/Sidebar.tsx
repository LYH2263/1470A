import { Layout, Menu } from 'antd';
import {
  FileTextOutlined,
  DashboardOutlined,
  SafetyOutlined,
  CloudServerOutlined,
  NotificationOutlined,
  ToolOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

export default function Sidebar() {
  const router = useRouter();
  const pathname = router.pathname;

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '控制台',
    },
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: '文章管理',
    },
    {
      key: '/categories',
      icon: <AppstoreOutlined />,
      label: '分类管理',
    },
    {
      key: '/sensitive-words',
      icon: <SafetyOutlined />,
      label: '敏感词管理',
    },
    {
      key: '/backup',
      icon: <CloudServerOutlined />,
      label: '备份恢复',
    },
    {
      key: '/announcements',
      icon: <NotificationOutlined />,
      label: '公告管理',
    },
    {
      key: '/maintenance-settings',
      icon: <ToolOutlined />,
      label: '维护模式',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    router.push(e.key);
  };

  // 确定当前选中的菜单项
  const selectedKey = pathname.startsWith('/articles') || pathname === '/' ? '/' : pathname;

  return (
    <Sider
      width={200}
      style={{
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={handleMenuClick}
        items={menuItems}
        style={{ height: '100%', borderRight: 0 }}
      />
    </Sider>
  );
}
