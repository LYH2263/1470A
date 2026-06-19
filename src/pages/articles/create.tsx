import { Card, Button, Space } from 'antd';
import { useRouter } from 'next/router';
import ArticleForm from '@/components/articles/ArticleForm';
import MainLayout from '@/components/layout/MainLayout';

export default function CreateArticlePage() {
  const router = useRouter();

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card
          title="创建文章"
          extra={
            <Space>
              <Button type="primary" form="article-form" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => router.back()}>返回</Button>
            </Space>
          }
        >
          <ArticleForm mode="create" formId="article-form" />
        </Card>
      </div>
    </MainLayout>
  );
}
