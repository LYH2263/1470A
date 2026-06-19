import { useEffect, useState } from 'react';
import { Card, Spin, message, Button, Space } from 'antd';
import { useRouter } from 'next/router';
import ArticleForm from '@/components/articles/ArticleForm';
import MainLayout from '@/components/layout/MainLayout';
import type { Article } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';

export default function EditArticlePage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        const response = await fetchWithAuth(`/api/articles/${id}`);
        const result = await response.json();

        if (result.success) {
          setArticle(result.data);
        } else {
          message.error(result.error || '获取文章失败');
        }
      } catch (error) {
        console.error('获取文章失败:', error);
        message.error('获取文章失败');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

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

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card
          title="编辑文章"
          extra={
            <Space>
              <Button type="primary" form="article-form" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => router.back()}>返回</Button>
            </Space>
          }
        >
          <ArticleForm mode="edit" initialValues={article} formId="article-form" />
        </Card>
      </div>
    </MainLayout>
  );
}
