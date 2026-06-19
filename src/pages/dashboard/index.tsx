import { Button, Card, Space, Typography } from 'antd';
import { useRouter } from 'next/router';
import MainLayout from '@/components/layout/MainLayout';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card title="控制台">
          <Typography.Paragraph>
            这是一个示例控制台页面。你可以在这里扩展统计信息、快捷入口等内容。
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={() => router.push('/')}>
              前往文章管理
            </Button>
            <Button onClick={() => router.push('/articles/create')}>创建新文章</Button>
          </Space>
        </Card>
      </div>
    </MainLayout>
  );
}
