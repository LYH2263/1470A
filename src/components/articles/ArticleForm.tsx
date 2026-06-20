import { Form, Input, Select, DatePicker, message, Modal, Tag, Alert, Button, Tooltip } from 'antd';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { WarningOutlined, CheckCircleOutlined, AimOutlined } from '@ant-design/icons';
import RichTextEditor, { type RichTextEditorApi } from '@/components/common/RichTextEditor';
import type { Article, ArticleFormData, UpdateArticleWithOptimisticLock } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';
import { detectSensitiveWords, getLevelColor, getLevelLabel, getCategoryLabel, getStrategyLabel } from '@/lib/api-sensitive-word';
import type { SensitiveWordDetectionResult, SensitiveWordMatch, QuillHighlightRange } from '@/types/sensitive-word';
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
  const [showMatchList, setShowMatchList] = useState(true);
  const [editorApi, setEditorApi] = useState<RichTextEditorApi | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>('');
  const titleRef = useRef<string>('');

  const titleMatches = useMemo<SensitiveWordMatch[]>(() => {
    return detectionResult?.matches.filter(m => (m as any).inTitle) || [];
  }, [detectionResult]);

  const contentMatches = useMemo<SensitiveWordMatch[]>(() => {
    return detectionResult?.matches.filter(m => !(m as any).inTitle) || [];
  }, [detectionResult]);

  const contentHighlightRanges = useMemo<QuillHighlightRange[]>(() => {
    const ranges = detectionResult?.quillRanges;
    if (ranges && ranges.length > 0) {
      return ranges as QuillHighlightRange[];
    }
    // 兼容后端未返回的情况：这里只处理正文内容
    // 用 plain 索引，但实际高亮推荐用 quillRanges（detect API 会返回）
    const contentMatchesOnly = detectionResult?.matches.filter(m => !(m as any).inTitle) || [];
    return contentMatchesOnly.map(m => ({
      index: m.start,
      length: m.end - m.start,
      level: m.level,
      word: m.word,
    }));
  }, [detectionResult]);

  useEffect(() => {
    if (editorApi && contentHighlightRanges) {
      editorApi.setSensitiveHighlights(contentHighlightRanges as any);
    }
  }, [editorApi, contentHighlightRanges]);

  const jumpToMatch = useCallback((match: SensitiveWordMatch, inTitle: boolean) => {
    if (inTitle) {
      const el = document.querySelector<HTMLInputElement>('input#title_input');
      if (el) {
        el.focus();
        const start = match.start;
        const end = match.end;
        if (typeof el.setSelectionRange === 'function') {
          try { el.setSelectionRange(start, end); } catch (e) {}
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (!editorApi || !detectionResult?.quillRanges) {
      editorApi?.scrollToRange(match.start, match.end - match.start);
      return;
    }
    const idx = detectionResult.matches.findIndex(m => m === match || (m.start === match.start && m.end === match.end && m.word === match.word));
    if (idx >= 0 && detectionResult.quillRanges[idx]) {
      const r = detectionResult.quillRanges[idx];
      editorApi.scrollToRange(r.index, r.length);
    } else {
      editorApi.scrollToRange(match.start, match.end - match.start);
    }
  }, [editorApi, detectionResult]);

  const getStrategyColor = (strategy: string): string => {
    if (strategy === 'block') return 'red';
    if (strategy === 'replace') return 'orange';
    return 'blue';
  };

  const getLevelBgColor = (level: string): string => {
    if (level === 'high') return '#fff1f0';
    if (level === 'medium') return '#fffbe6';
    return '#f6ffed';
  };

  const renderTitleInputWithHighlight = () => {
    if (titleMatches.length === 0) {
      return (
        <Input
          id="title_input"
          placeholder="请输入文章标题"
          onChange={handleTitleChange}
        />
      );
    }
    return (
      <div style={{ position: 'relative' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '5px 11px',
            fontSize: '14px',
            lineHeight: '1.5715',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: 'transparent',
            pointerEvents: 'none',
            overflow: 'hidden',
            minHeight: '32px',
            zIndex: 1,
            boxSizing: 'border-box',
          }}
        >
          {renderHighlightedTitle()}
        </div>
        <Input
          id="title_input"
          placeholder="请输入文章标题"
          onChange={handleTitleChange}
          style={{
            position: 'relative',
            zIndex: 2,
            background: 'transparent',
            caretColor: '#000',
          }}
        />
      </div>
    );
  };

  const renderHighlightedTitle = () => {
    if (!titleMatches || titleMatches.length === 0) {
      return <span>{titleRef.current}</span>;
    }
    const title = titleRef.current;
    const sorted = [...titleMatches].sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let vi = 0;
    for (const m of sorted) {
      if (m.start < lastIdx) continue;
      if (m.start > lastIdx) {
        nodes.push(
          <span key={`text-${vi++}`}>{title.slice(lastIdx, m.start)}</span>
        );
      }
      nodes.push(
        <span
          key={`hl-${vi++}`}
          style={{
            backgroundColor: getLevelBgColor(m.level),
            border: `1px dashed ${getLevelColor(m.level) === 'error' ? '#f5222d' : getLevelColor(m.level) === 'warning' ? '#faad14' : '#8c8c8c'}`,
            borderRadius: '3px',
            padding: '0 2px',
          }}
        >
          {title.slice(m.start, m.end)}
        </span>
      );
      lastIdx = m.end;
    }
    if (lastIdx < title.length) {
      nodes.push(<span key={`text-${vi++}`}>{title.slice(lastIdx)}</span>);
    }
    return nodes;
  };

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

    const renderMatchItem = (match: SensitiveWordMatch, inTitle: boolean, idx: number) => (
      <div
        key={`${inTitle ? 't' : 'c'}-${idx}`}
        style={{
          padding: '8px 12px',
          background: '#fff',
          border: `1px solid ${getLevelColor(match.level) === 'error' ? '#f5222d' : getLevelColor(match.level) === 'warning' ? '#faad14' : '#8c8c8c'}`,
          borderRadius: '4px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '4px' }}>
            <Tag color={getLevelColor(match.level)}>
              {getLevelLabel(match.level)}
            </Tag>
            <Tag>{getCategoryLabel(match.category)}</Tag>
            <Tag color={getStrategyColor(match.strategy)}>{getStrategyLabel(match.strategy)}</Tag>
            {inTitle && <Tag color="geekblue">标题</Tag>}
          </div>
          <div>
            <span style={{
              fontWeight: 'bold',
              background: getLevelBgColor(match.level),
              padding: '2px 6px',
              borderRadius: '3px',
              border: `1px dashed ${getLevelColor(match.level) === 'error' ? '#f5222d' : getLevelColor(match.level) === 'warning' ? '#faad14' : '#8c8c8c'}`,
            }}>
              {match.originalText}
            </span>
            <span style={{ marginLeft: '8px', color: '#999', fontSize: '12px' }}>
              位置: {match.start}-{match.end}
            </span>
          </div>
        </div>
        <Tooltip title={inTitle ? '定位到标题' : '在编辑器中定位'}>
          <Button
            type="text"
            size="small"
            icon={<AimOutlined />}
            onClick={() => jumpToMatch(match, inTitle)}
          >
            定位
          </Button>
        </Tooltip>
      </div>
    );

    return (
      <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fafafa', borderRadius: '6px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          fontWeight: 600,
        }}>
          <span>
            <WarningOutlined style={{ color: '#faad14', marginRight: '8px' }} />
            敏感词命中详情（共 {detectionResult.stats.totalMatches} 个）
          </span>
          <Button size="small" type="link" onClick={() => setShowMatchList(false)}>收起</Button>
        </div>

        {titleMatches.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 500, marginBottom: '8px', color: '#262626' }}>
              标题命中 ({titleMatches.length})
            </div>
            {titleMatches.map((m, i) => renderMatchItem(m, true, i))}
          </div>
        )}

        {contentMatches.length > 0 && (
          <div>
            <div style={{ fontWeight: 500, marginBottom: '8px', color: '#262626' }}>
              正文命中 ({contentMatches.length})
              <span style={{ fontWeight: 400, marginLeft: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                （已在编辑器中高亮显示，点击「定位」可跳转）
              </span>
            </div>
            {contentMatches.map((m, i) => renderMatchItem(m, false, i))}
          </div>
        )}
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
        {renderTitleInputWithHighlight()}
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
          onEditorReady={(api) => setEditorApi(api)}
          highlightRanges={contentHighlightRanges as any}
        />
      </Form.Item>
    </Form>
  );
}
