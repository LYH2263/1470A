import { useState, useEffect, useRef } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  message,
  Tag,
  Popconfirm,
  Upload,
  InputNumber,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ImportOutlined,
  ExportOutlined,
  EditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import {
  getSensitiveWordList,
  createSensitiveWord,
  updateSensitiveWord,
  deleteSensitiveWord,
  deleteSensitiveWords,
  importSensitiveWords,
  exportSensitiveWords,
  getLevelColor,
  getLevelLabel,
  getCategoryLabel,
  getStrategyLabel,
} from '@/lib/api-sensitive-word';
import type {
  SensitiveWord,
  SensitiveWordCreateInput,
  SensitiveWordUpdateInput,
  SensitiveWordCategory,
  SensitiveWordLevel,
  SensitiveWordStrategy,
} from '@/types/sensitive-word';
import {
  SENSITIVE_WORD_CATEGORIES,
  SENSITIVE_WORD_LEVELS,
  SENSITIVE_WORD_STRATEGIES,
} from '@/types/sensitive-word';

function SensitiveWordsPage() {
  const [words, setWords] = useState<SensitiveWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<SensitiveWordCategory | undefined>();
  const [filterLevel, setFilterLevel] = useState<SensitiveWordLevel | undefined>();
  const [filterEnabled, setFilterEnabled] = useState<boolean | undefined>();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingWord, setEditingWord] = useState<SensitiveWord | null>(null);
  const [form] = Form.useForm<SensitiveWordCreateInput>();

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFile, setImportFile] = useState<UploadFile | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await getSensitiveWordList({
        page,
        pageSize,
        keyword: searchKeyword || undefined,
        category: filterCategory,
        level: filterLevel,
        enabled: filterEnabled,
      });
      setWords(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '获取敏感词列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setSearchKeyword('');
    setFilterCategory(undefined);
    setFilterLevel(undefined);
    setFilterEnabled(undefined);
    setPage(1);
    setTimeout(fetchData, 0);
  };

  const handleCreate = () => {
    setEditingWord(null);
    form.resetFields();
    form.setFieldsValue({
      category: 'other',
      level: 'medium',
      strategy: 'block',
      enabled: true,
    });
    setModalVisible(true);
  };

  const handleEdit = (word: SensitiveWord) => {
    setEditingWord(word);
    form.setFieldsValue({
      word: word.word,
      category: word.category,
      level: word.level,
      strategy: word.strategy,
      enabled: word.enabled,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingWord) {
        await updateSensitiveWord(editingWord.id, values as SensitiveWordUpdateInput);
        message.success('更新成功');
      } else {
        await createSensitiveWord(values as SensitiveWordCreateInput);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSensitiveWord(id);
      message.success('删除成功');
      fetchData();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的敏感词');
      return;
    }
    try {
      const result = await deleteSensitiveWords(selectedRowKeys as string[]);
      message.success(`成功删除 ${result.deletedCount} 条敏感词`);
      setSelectedRowKeys([]);
      fetchData();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      message.warning('请选择要导入的文件');
      return;
    }

    try {
      const file = importFile.originFileObj || importFile;
      const text = await (file as File).text();
      let data;
      
      if (importFile.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (importFile.name.endsWith('.csv')) {
        const lines = text.split('\n').filter((l: string) => l.trim());
        const header = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
        data = lines.slice(1).map((line: string) => {
          const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const obj: any = {};
          header.forEach((h: string, i: number) => {
            let val = values[i]?.replace(/"/g, '').trim() || '';
            if (val === 'true') val = 'true';
            if (val === 'false') val = 'false';
            obj[h] = val;
          });
          return obj;
        });
      } else {
        throw new Error('不支持的文件格式，请上传 .json 或 .csv 文件');
      }

      const result = await importSensitiveWords(data);
      setImportResult(result);
      
      if (result.errors.length > 0) {
        message.warning(`导入完成，但有 ${result.errors.length} 条错误`);
      } else {
        message.success(`导入成功：新增 ${result.created} 条，更新 ${result.updated} 条`);
      }
      
      fetchData();
    } catch (error: any) {
      message.error(error.message || '导入失败');
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    exportSensitiveWords({
      keyword: searchKeyword || undefined,
      category: filterCategory,
      level: filterLevel,
      enabled: filterEnabled,
      format,
    });
    message.success('导出成功');
  };

  const columns: ColumnsType<SensitiveWord> = [
    {
      title: '敏感词',
      dataIndex: 'word',
      key: 'word',
      width: 200,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: SensitiveWordCategory) => getCategoryLabel(category),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: SensitiveWordLevel) => (
        <Tag color={getLevelColor(level)}>{getLevelLabel(level)}</Tag>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (strategy: SensitiveWordStrategy) => getStrategyLabel(strategy),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个敏感词吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        <h1 style={{ marginBottom: '24px' }}>敏感词管理</h1>
      <div style={{ marginBottom: '16px' }}>
        <Space wrap style={{ marginBottom: '16px' }}>
          <Input
            placeholder="搜索敏感词"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="分类"
            value={filterCategory}
            onChange={(val) => setFilterCategory(val)}
            style={{ width: 150 }}
            allowClear
          >
            {SENSITIVE_WORD_CATEGORIES.map((cat) => (
              <Select.Option key={cat.value} value={cat.value}>
                {cat.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="级别"
            value={filterLevel}
            onChange={(val) => setFilterLevel(val)}
            style={{ width: 120 }}
            allowClear
          >
            {SENSITIVE_WORD_LEVELS.map((level) => (
              <Select.Option key={level.value} value={level.value}>
                {level.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            value={filterEnabled !== undefined ? String(filterEnabled) : undefined}
            onChange={(val) => setFilterEnabled(val === 'true' ? true : val === 'false' ? false : undefined)}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="true">启用</Select.Option>
            <Select.Option value="false">禁用</Select.Option>
          </Select>
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增敏感词
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setImportModalVisible(true);
            }}
          >
            导入
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
            导出 JSON
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
            导出 CSV
          </Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 条敏感词吗？`}
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={words}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editingWord ? '编辑敏感词' : '新增敏感词'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="word"
            label="敏感词"
            rules={[
              { required: true, message: '请输入敏感词' },
              { max: 100, message: '敏感词不能超过100个字符' },
            ]}
          >
            <Input placeholder="请输入敏感词" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select>
              {SENSITIVE_WORD_CATEGORIES.map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="level"
            label="级别"
            rules={[{ required: true, message: '请选择级别' }]}
          >
            <Select>
              {SENSITIVE_WORD_LEVELS.map((level) => (
                <Select.Option key={level.value} value={level.value}>
                  {level.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="strategy"
            label="处理策略"
            rules={[{ required: true, message: '请选择处理策略' }]}
          >
            <Select>
              {SENSITIVE_WORD_STRATEGIES.map((strategy) => (
                <Select.Option key={strategy.value} value={strategy.value}>
                  {strategy.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入敏感词"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => setImportModalVisible(false)}
        okText="导入"
        cancelText="取消"
        width={600}
      >
        <Alert
          message="导入说明"
          description="支持 JSON 和 CSV 格式。JSON 格式为数组，CSV 格式需包含 word,category,level,strategy,enabled 列。"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        <Upload
          accept=".json,.csv"
          beforeUpload={() => false}
          maxCount={1}
          onChange={(info) => {
            setImportFile(info.fileList[0] || null);
          }}
          onRemove={() => setImportFile(null)}
          fileList={importFile ? [importFile] : []}
        >
          <Button icon={<ImportOutlined />}>选择文件</Button>
        </Upload>
        {importResult && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>导入结果：</div>
            <div>新增：{importResult.created} 条</div>
            <div>更新：{importResult.updated} 条</div>
            <div>跳过：{importResult.skipped} 条</div>
            {importResult.errors.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ color: '#ff4d4f', marginBottom: '4px' }}>错误详情：</div>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#ff4d4f' }}>
                  {importResult.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>... 还有 {importResult.errors.length - 10} 条错误</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
      </div>
    </MainLayout>
  );
}

export default function SensitiveWordsPageWithAuth() {
  return (
    <ProtectedRoute>
      <SensitiveWordsPage />
    </ProtectedRoute>
  );
}
