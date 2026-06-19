import { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Spin, Tag, message, Space } from 'antd';
import { useRouter } from 'next/router';
import DOMPurify from 'isomorphic-dompurify';
import MainLayout from '@/components/layout/MainLayout';
import type { Article } from '@/types/article';
import { formatDate, importanceMap } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';

export default function ArticleDetailPage() {
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
          <Card>
            <p>文章不存在</p>
            <Button onClick={() => router.back()}>返回</Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const importanceConfig = importanceMap[article.importance];

  // 使用 DOMPurify 清理 HTML 内容，防止 XSS 攻击
  const sanitizedContent = DOMPurify.sanitize(article.content);

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card
          title="文章详情"
          extra={
            <Space>
              <Button onClick={() => router.push(`/articles/${id}/edit`)}>编辑</Button>
              <Button onClick={() => router.back()}>返回</Button>
            </Space>
          }
        >
          <Descriptions bordered column={2}>
            <Descriptions.Item label="标题" span={2}>
              {article.title}
            </Descriptions.Item>
            <Descriptions.Item label="作者">
              {article.author}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDate(article.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="重要性">
              <Tag color={importanceConfig.color}>{importanceConfig.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="阅读数">{article.views}</Descriptions.Item>
            <Descriptions.Item label="内容" span={2}>
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </MainLayout>
  );
}
