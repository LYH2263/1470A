import { Form, Input, Select, DatePicker, message, Modal, Tag, Alert, Button } from 'antd';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import RichTextEditor from '@/components/common/RichTextEditor';
import type { Article, ArticleFormData, UpdateArticleWithOptimisticLock } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';
import { detectSensitiveWords, getLevelColor, getLevelLabel, getCategoryLabel, getStrategyLabel } from '@/lib/api-sensitive-word';
import type { SensitiveWordDetectionResult } from '@/types/sensitive-word';
import { getAllCategories } from '@/lib/api-category';
import type { Category } from '@/types/category';

interface ArticleFormProps {
  initialValues?: Article;
  mode: 'create' | 'edit';
  formId?: string;
  readOnly?: boolean;
  onConflict?: (currentArticle: Article) => void;
}

interface ArticleFormValues {
  title: string;
  author: string;
  createdAt: Dayjs;
  importance: ArticleFormData['importance'];
  content: string;
  status: 'draft' | 'published';
  categoryId: string;
}

export default function ArticleForm({ initialValues, mode, formId, readOnly = false, onConflict }: ArticleFormProps) {
  const router = useRouter();
  const [form] = Form.useForm<ArticleFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [detectionResult, setDetectionResult] = useState<SensitiveWordDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showMatchList, setShowMatchList] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>('');
  const titleRef = useRef<string>('');

  const showConflictModal = (currentArticle: Article) => {
    Modal.confirm({
      title: '版本冲突',
      content: '文章已被其他用户修改。您可以选择：\n1. 取消并保留您的修改\n2. 放弃您的修改并查看最新版本',
      okText: '查看最新版本',
      cancelText: '保留修改',
      okButtonProps: { danger: true },
      onOk: () => {
        onConflict?.(currentArticle);
        router.reload();
      },
    });
  };

  const performDetection = useCallback(async () => {
    if (readOnly) return;
    
    const content = contentRef.current;
    const title = titleRef.current;
    
    if (!content && !title) {
      setDetectionResult(null);
      return;
    }

    try {
      setIsDetecting(true);
      const result = await detectSensitiveWords({
        content: content || '',
        checkTitle: true,
        title: title || '',
      });
      setDetectionResult(result);
    } catch (error) {
      console.error('敏感词检测失败:', error);
    } finally {
      setIsDetecting(false);
    }
  }, [readOnly]);

  const debouncedDetection = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performDetection();
    }, 500);
  }, [performDetection]);

  const handleContentChange = useCallback((value: string) => {
    contentRef.current = value;
    debouncedDetection();
  }, [debouncedDetection]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    titleRef.current = e.target.value;
    debouncedDetection();
  }, [debouncedDetection]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        console.error('获取分类列表失败:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (initialValues) {
      contentRef.current = initialValues.content || '';
      titleRef.current = initialValues.title || '';
      performDetection();
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [initialValues, performDetection]);

  const renderDetectionAlert = () => {
    if (!detectionResult || detectionResult.stats.totalMatches === 0) {
      if (detectionResult) {
        return (
          <Alert
            icon={<CheckCircleOutlined />}
            message="内容安全检测通过"
            type="success"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        );
      }
      return null;
    }

    const { stats, shouldBlock } = detectionResult;
    const alertType = shouldBlock ? 'error' : stats.highLevelCount > 0 ? 'error' : stats.mediumLevelCount > 0 ? 'warning' : 'info';

    const alertMessage = shouldBlock
      ? `内容包含 ${stats.totalMatches} 个敏感词，其中 ${stats.highLevelCount} 个为高危，禁止发布`
      : `检测到 ${stats.totalMatches} 个敏感词：高危 ${stats.highLevelCount} 个，中危 ${stats.mediumLevelCount} 个，低危 ${stats.lowLevelCount} 个`;

    return (
      <Alert
        icon={<WarningOutlined />}
        message={alertMessage}
        type={alertType}
        showIcon
        closable
        style={{ marginBottom: '16px' }}
        action={
          <Button size="small" type={shouldBlock ? 'primary' : 'default'} onClick={() => setShowMatchList(!showMatchList)}>
            {showMatchList ? '隐藏详情' : '查看详情'}
          </Button>
        }
      />
    );
  };

  const renderMatchList = () => {
    if (!showMatchList || !detectionResult || detectionResult.matches.length === 0) {
      return null;
    }

    return (
      <div style={{ marginBottom: '16px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>敏感词命中详情：</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {detectionResult.matches.map((match, index) => (
            <Tag
              key={index}
              color={getLevelColor(match.level)}
              style={{ padding: '4px 8px' }}
            >
              <span style={{ fontWeight: 'bold' }}>{match.originalText}</span>
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                [{getLevelLabel(match.level)}] [{getCategoryLabel(match.category)}] [{getStrategyLabel(match.strategy)}]
              </span>
            </Tag>
          ))}
        </div>
      </div>
    );
  };

  const onFinish = async (values: ArticleFormValues) => {
    if (readOnly || submitting) return;

    setSubmitting(true);
    try {
      const formData: ArticleFormData = {
        title: values.title,
        author: values.author,
        createdAt: values.createdAt.toDate().toISOString(),
        importance: values.importance,
        content: values.content,
        status: values.status,
        categoryId: values.categoryId,
      };

      let requestBody: object;
      if (mode === 'edit' && initialValues?.updatedAt) {
        requestBody = {
          ...formData,
          lastUpdatedAt: initialValues.updatedAt,
        } as UpdateArticleWithOptimisticLock;
      } else {
        requestBody = formData;
      }

      const url = mode === 'create'
        ? '/api/articles'
        : `/api/articles/${initialValues?.id}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        message.success(mode === 'create' ? '创建成功' : '更新成功');
        router.push('/');
      } else {
        if (response.status === 409 && result.data?.conflict && result.data?.currentArticle) {
          showConflictModal(result.data.currentArticle);
        } else {
          message.error(result.error || '操作失败');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      id={formId}
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={
        initialValues
          ? {
              ...initialValues,
              createdAt: dayjs(initialValues.createdAt),
              status: initialValues.status || 'published',
              categoryId: initialValues.categoryId || undefined,
            }
          : {
              importance: 'medium',
              status: 'published',
              createdAt: dayjs(),
            }
      }
      disabled={readOnly}
    >
      {renderDetectionAlert()}
      {renderMatchList()}

      <Form.Item
        label="标题"
        name="title"
        rules={[
          { required: true, message: '请输入标题' },
          { max: 200, message: '标题不能超过200个字符' },
        ]}
      >
        <Input placeholder="请输入文章标题" onChange={handleTitleChange} />
      </Form.Item>

      <Form.Item
        label="作者"
        name="author"
        rules={[
          { required: true, message: '请输入作者' },
          { max: 50, message: '作者不能超过50个字符' },
        ]}
      >
        <Input placeholder="请输入作者名称" />
      </Form.Item>

      <Form.Item
        label="创建时间"
        name="createdAt"
        rules={[{ required: true, message: '请选择创建时间' }]}
      >
        <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="重要性"
        name="importance"
        rules={[{ required: true, message: '请选择重要性' }]}
      >
        <Select
          options={[
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="状态"
        name="status"
        rules={[{ required: true, message: '请选择状态' }]}
      >
        <Select
          options={[
            { value: 'draft', label: '草稿' },
            { value: 'published', label: '已发布' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="分类"
        name="categoryId"
        rules={[{ required: true, message: '请选择分类' }]}
      >
        <Select
          loading={categoriesLoading}
          placeholder="请选择分类"
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
          }))}
        />
      </Form.Item>

      <Form.Item
        label="内容"
        name="content"
        rules={[{ required: true, message: '请输入内容' }]}
      >
        <RichTextEditor 
          placeholder="请输入文章内容" 
          readOnly={readOnly} 
          onChange={handleContentChange}
        />
      </Form.Item>
    </Form>
  );
}
