import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Space, Modal, message, Tag, Card } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import type { Article, ArticleListResponse, SearchSuggestion } from '@/types/article';
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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const response = await fetchWithAuth(`/api/search/suggest?keyword=${encodeURIComponent(value.trim())}`);
      const result = await response.json();
      if (result.success && result.data) {
        setSuggestions(result.data);
        setShowSuggestions(result.data.length > 0);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions]);

  const handleSearch = () => {
    setKeyword(searchInput.trim());
    setPage(1);
    setShowSuggestions(false);
  };

  const handleReset = () => {
    setSearchInput('');
    setKeyword('');
    setPage(1);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setSearchInput(suggestion.title);
    setKeyword(suggestion.title);
    setPage(1);
    setShowSuggestions(false);
  };

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
      render: (text: string, record: Article) => {
        if (record.highlight?.title) {
          return <span dangerouslySetInnerHTML={{ __html: record.highlight.title }} />;
        }
        return text;
      },
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 120,
      render: (text: string, record: Article) => {
        if (record.highlight?.author) {
          return <span dangerouslySetInnerHTML={{ __html: record.highlight.author }} />;
        }
        return text;
      },
    },
    {
      title: '摘要',
      key: 'snippet',
      width: 250,
      ellipsis: true,
      render: (_: unknown, record: Article) => {
        if (record.highlight?.snippet) {
          return (
            <span
              className="text-gray-500 text-sm"
              dangerouslySetInnerHTML={{ __html: record.highlight.snippet }}
            />
          );
        }
        return <span className="text-gray-400 text-sm">-</span>;
      },
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
              <div style={{ position: 'relative', display: 'inline-block' }} ref={suggestionsRef}>
                <Input
                  placeholder="搜索标题、正文、作者"
                  allowClear
                  value={searchInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 300 }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 1000,
                      width: 300,
                      background: '#fff',
                      border: '1px solid #d9d9d9',
                      borderRadius: 4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {suggestions.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                        onMouseDown={() => handleSuggestionClick(s)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = '#fff';
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{s.author}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
