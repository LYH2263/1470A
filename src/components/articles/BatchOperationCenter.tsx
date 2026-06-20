import { useState, useCallback } from 'react';
import {
  Modal,
  Tabs,
  Form,
  Input,
  Select,
  Button,
  Space,
  Switch,
  message,
  Spin,
  Alert,
  Tag,
} from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import type {
  BatchOperationType,
  BatchOperationParams,
  BatchPreviewResult,
  BatchExecuteResult,
  BatchOperationLog,
} from '@/types/article';
import { fetchWithAuth } from '@/lib/api';
import DiffPreview from './DiffPreview';
import { validateRegexPattern } from '@/lib/batch-utils';
import { formatDate } from '@/lib/utils';

interface BatchOperationCenterProps {
  open: boolean;
  selectedIds: React.Key[];
  defaultTab?: OperationTabKey;
  onClose: () => void;
  onSuccess: () => void;
}

type OperationTabKey = 'author' | 'importance' | 'footer' | 'replace';

export default function BatchOperationCenter({
  open,
  selectedIds,
  defaultTab = 'author',
  onClose,
  onSuccess,
}: BatchOperationCenterProps) {
  const [activeTab, setActiveTab] = useState<OperationTabKey>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<BatchPreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [lastOperation, setLastOperation] = useState<BatchOperationLog | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);

  const [authorForm] = Form.useForm();
  const [importanceForm] = Form.useForm();
  const [footerForm] = Form.useForm();
  const [replaceForm] = Form.useForm();

  const operationTypeMap: Record<OperationTabKey, BatchOperationType> = {
    author: 'batch_update_author',
    importance: 'batch_update_importance',
    footer: 'batch_append_footer',
    replace: 'batch_replace_content',
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as OperationTabKey);
    setPreviewResult(null);
    setShowPreview(false);
  };

  const getParams = useCallback((): BatchOperationParams | null => {
    switch (activeTab) {
      case 'author': {
        const values = authorForm.getFieldsValue();
        if (!values.author?.trim()) return null;
        return { author: values.author.trim() };
      }
      case 'importance': {
        const values = importanceForm.getFieldsValue();
        if (!values.importance) return null;
        return { importance: values.importance };
      }
      case 'footer': {
        const values = footerForm.getFieldsValue();
        if (!values.footerHtml?.trim()) return null;
        return { footerHtml: values.footerHtml };
      }
      case 'replace': {
        const values = replaceForm.getFieldsValue();
        if (!values.pattern) return null;
        return {
          pattern: values.pattern,
          replacement: values.replacement || '',
          isRegex: values.isRegex || false,
          caseSensitive: values.caseSensitive || false,
        };
      }
      default:
        return null;
    }
  }, [activeTab, authorForm, importanceForm, footerForm, replaceForm]);

  const handlePreview = async () => {
    const params = getParams();
    if (!params) {
      message.warning('请填写操作参数');
      return;
    }

    if (activeTab === 'replace') {
      const values = replaceForm.getFieldsValue();
      if (values.isRegex) {
        const validation = validateRegexPattern(values.pattern);
        if (!validation.valid) {
          message.error(`正则表达式无效: ${validation.error}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/batch/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleIds: selectedIds,
          operationType: operationTypeMap[activeTab],
          params,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPreviewResult(result.data);
        setShowPreview(true);
      } else {
        message.error(result.error || '预览失败');
      }
    } catch (error) {
      console.error('预览失败:', error);
      message.error('预览失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    const params = getParams();
    if (!params) {
      message.warning('请填写操作参数');
      return;
    }

    Modal.confirm({
      title: '确认执行批量操作',
      content: `即将对选中的 ${selectedIds.length} 篇文章执行操作，确定继续吗？`,
      okText: '确定执行',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const response = await fetchWithAuth('/api/batch/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              articleIds: selectedIds,
              operationType: operationTypeMap[activeTab],
              params,
            }),
          });

          const result = await response.json();
          if (result.success) {
            const data: BatchExecuteResult = result.data;
            if (data.status === 'success') {
              message.success(`成功处理 ${data.successCount} 篇文章`);
            } else if (data.status === 'partial_failure') {
              message.warning(
                `部分成功：${data.successCount} 篇成功，${data.failureCount} 篇失败`
              );
            }
            setPreviewResult(null);
            setShowPreview(false);
            onSuccess();
            fetchLatestOperation();
          } else {
            message.error(result.error || '执行失败');
          }
        } catch (error) {
          console.error('执行失败:', error);
          message.error('执行失败，请稍后重试');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const fetchLatestOperation = async () => {
    try {
      const response = await fetchWithAuth('/api/batch/latest');
      const result = await response.json();
      if (result.success) {
        setLastOperation(result.data);
      }
    } catch (error) {
      console.error('获取最近操作失败:', error);
    }
  };

  const handleUndo = async () => {
    if (!lastOperation) return;

    Modal.confirm({
      title: '确认撤销',
      content: `确定撤销最近一次批量操作吗？将恢复 ${lastOperation.articleCount} 篇文章的数据。`,
      okText: '确定撤销',
      onOk: async () => {
        setUndoLoading(true);
        try {
          const response = await fetchWithAuth('/api/batch/undo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationId: lastOperation.id }),
          });

          const result = await response.json();
          if (result.success) {
            message.success(`撤销成功，恢复了 ${result.data.restoredCount} 篇文章`);
            setLastOperation(null);
            onSuccess();
          } else {
            message.error(result.error || '撤销失败');
          }
        } catch (error) {
          console.error('撤销失败:', error);
          message.error('撤销失败，请稍后重试');
        } finally {
          setUndoLoading(false);
        }
      },
    });
  };

  const handleClose = () => {
    setPreviewResult(null);
    setShowPreview(false);
    onClose();
  };

  const tabItems = [
    {
      key: 'author',
      label: '改作者',
      children: (
        <Form form={authorForm} layout="vertical">
          <Form.Item
            name="author"
            label="新作者名称"
            rules={[{ required: true, message: '请输入作者名称' }]}
          >
            <Input placeholder="请输入新的作者名称" maxLength={50} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="此操作将批量更新选中文章的作者字段"
          />
        </Form>
      ),
    },
    {
      key: 'importance',
      label: '改重要性',
      children: (
        <Form form={importanceForm} layout="vertical">
          <Form.Item
            name="importance"
            label="重要性等级"
            rules={[{ required: true, message: '请选择重要性等级' }]}
          >
            <Select
              placeholder="请选择重要性等级"
              options={[
                { value: 'low', label: <Tag color="success">低</Tag> },
                { value: 'medium', label: <Tag color="warning">中</Tag> },
                { value: 'high', label: <Tag color="error">高</Tag> },
              ]}
            />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="此操作将批量更新选中文章的重要性等级"
          />
        </Form>
      ),
    },
    {
      key: 'footer',
      label: '追加页脚',
      children: (
        <Form form={footerForm} layout="vertical">
          <Form.Item
            name="footerHtml"
            label="页脚内容（支持 HTML）"
            rules={[{ required: true, message: '请输入页脚内容' }]}
          >
            <Input.TextArea
              placeholder="请输入要追加的页脚内容，支持 HTML 标签"
              rows={4}
              maxLength={2000}
            />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            message="注意：页脚内容会经过 XSS 过滤后追加到正文末尾"
          />
        </Form>
      ),
    },
    {
      key: 'replace',
      label: '替换正文',
      children: (
        <Form form={replaceForm} layout="vertical">
          <Form.Item
            name="pattern"
            label="查找内容"
            rules={[{ required: true, message: '请输入查找内容' }]}
          >
            <Input placeholder="请输入要查找的内容" />
          </Form.Item>
          <Form.Item name="replacement" label="替换为">
            <Input placeholder="请输入替换后的内容" />
          </Form.Item>
          <Space wrap>
            <Form.Item name="isRegex" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span>正则表达式模式</span>
            <Form.Item name="caseSensitive" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span>区分大小写</span>
          </Space>
          <Alert
            type="warning"
            showIcon
            message="警告：正则替换可能破坏 HTML 结构，操作前请务必预览并确认"
            style={{ marginTop: '12px' }}
          />
        </Form>
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <span>批量操作中心</span>
          <Tag color="blue">已选 {selectedIds.length} 篇</Tag>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={800}
      footer={null}
      destroyOnClose
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          setActiveTab(defaultTab);
          setPreviewResult(null);
          setShowPreview(false);
          fetchLatestOperation();
        }
      }}
    >
      <Spin spinning={loading}>
        {lastOperation && !lastOperation.reverted && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
            message={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>
                  最近一次操作：{formatDate(lastOperation.createdAt)} ·{' '}
                  {lastOperation.operationType.replace('batch_', '').replace(/_/g, ' ')} ·{' '}
                  {lastOperation.successCount}/{lastOperation.articleCount} 成功
                </span>
                <Button
                  type="link"
                  icon={<UndoOutlined />}
                  onClick={handleUndo}
                  loading={undoLoading}
                  size="small"
                >
                  撤销
                </Button>
              </Space>
            }
          />
        )}

        {showPreview && previewResult ? (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <Space>
                <Button onClick={() => setShowPreview(false)}>返回编辑</Button>
                <Button type="primary" danger onClick={handleExecute} disabled={previewResult.changedCount === 0}>
                  确认执行
                </Button>
              </Space>
              <span style={{ marginLeft: '12px', color: '#666' }}>
                共 {previewResult.articleCount} 篇文章，{previewResult.changedCount} 篇有变更
              </span>
            </div>
            <DiffPreview previews={previewResult.previews} warnings={previewResult.warnings} />
          </div>
        ) : (
          <div>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={tabItems}
            />
            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Space>
                <Button onClick={handleClose}>取消</Button>
                <Button type="primary" onClick={handlePreview}>
                  预览效果
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
}
