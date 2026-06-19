import { Form, Input, Select, DatePicker, message, Modal } from 'antd';
import { useRouter } from 'next/router';
import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import RichTextEditor from '@/components/common/RichTextEditor';
import type { Article, ArticleFormData, UpdateArticleWithOptimisticLock } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';

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
}

export default function ArticleForm({ initialValues, mode, formId, readOnly = false, onConflict }: ArticleFormProps) {
  const router = useRouter();
  const [form] = Form.useForm<ArticleFormValues>();
  const [submitting, setSubmitting] = useState(false);

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
            }
          : {
              importance: 'medium',
              createdAt: dayjs(),
            }
      }
      disabled={readOnly}
    >
      <Form.Item
        label="标题"
        name="title"
        rules={[
          { required: true, message: '请输入标题' },
          { max: 200, message: '标题不能超过200个字符' },
        ]}
      >
        <Input placeholder="请输入文章标题" />
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
        label="内容"
        name="content"
        rules={[{ required: true, message: '请输入内容' }]}
      >
        <RichTextEditor placeholder="请输入文章内容" readOnly={readOnly} />
      </Form.Item>
    </Form>
  );
}
