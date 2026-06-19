import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Space, Modal, message, Tag, Card } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import type { Article, ArticleListResponse } from '@/types/article';
import { formatDate, importanceMap } from '@/lib/utils';
import MainLayout from '@/components/layout/MainLayout';
import { fetchWithAuth } from '@/lib/api';
import type { TableProps } from 'antd';

export default function ArticlesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 获取文章列表
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(keyword && { keyword }),
      });

      const response = await fetchWithAuth(`/api/articles?${params}`);
      const result = await response.json();

      if (result.success) {
        const listData: ArticleListResponse = result.data;
        setData(listData.data);
        setTotal(listData.total);
      } else {
        message.error(result.error || '获取数据失败');
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  // 搜索
  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  // 重置
  const handleReset = () => {
    setSearchInput('');
    setKeyword('');
    setPage(1);
  };

  // 删除单条
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这篇文章吗？',
      onOk: async () => {
        try {
          const response = await fetchWithAuth('/api/articles', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: [id] }),
          });

          const result = await response.json();

          if (result.success) {
            message.success('删除成功');
            fetchArticles();
          } else {
            message.error(result.error || '删除失败');
          }
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文章');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 篇文章吗？`,
      onOk: async () => {
        try {
          const response = await fetchWithAuth('/api/articles', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: selectedRowKeys }),
          });

          const result = await response.json();

          if (result.success) {
            message.success('删除成功');
            setSelectedRowKeys([]);
            fetchArticles();
          } else {
            message.error(result.error || '删除失败');
          }
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      },
    });
  };

  // 表格列定义
  const columns: TableProps<Article>['columns'] = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => formatDate(text),
    },
    {
      title: '重要性',
      dataIndex: 'importance',
      key: 'importance',
      width: 100,
      render: (importance: 'low' | 'medium' | 'high') => {
        const config = importanceMap[importance];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '阅读数',
      dataIndex: 'views',
      key: 'views',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => router.push(`/articles/${record.id}`)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/articles/${record.id}/edit`)}
          >
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Space>
              <Input
                placeholder="搜索标题"
                allowClear
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 300 }}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Button type="primary" onClick={() => router.push('/articles/create')}>
                新增
              </Button>
              <Button danger onClick={handleBatchDelete} disabled={selectedRowKeys.length === 0}>
                批量删除
              </Button>
            </Space>
          </div>

          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
