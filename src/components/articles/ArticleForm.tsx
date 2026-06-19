import { Form, Input, Select, DatePicker, message } from 'antd';
import { useRouter } from 'next/router';
import dayjs, { type Dayjs } from 'dayjs';
import RichTextEditor from '@/components/common/RichTextEditor';
import type { Article, ArticleFormData } from '@/types/article';
import { fetchWithAuth } from '@/lib/api';

interface ArticleFormProps {
  initialValues?: Article;
  mode: 'create' | 'edit';
  formId?: string;
}

interface ArticleFormValues {
  title: string;
  author: string;
  createdAt: Dayjs;
  importance: ArticleFormData['importance'];
  content: string;
}

export default function ArticleForm({ initialValues, mode, formId }: ArticleFormProps) {
  const router = useRouter();
  const [form] = Form.useForm<ArticleFormValues>();

  const onFinish = async (values: ArticleFormValues) => {
    try {
      const formData: ArticleFormData = {
        title: values.title,
        author: values.author,
        createdAt: values.createdAt.toDate().toISOString(),
        importance: values.importance,
        content: values.content,
      };

      const url = mode === 'create'
        ? '/api/articles'
        : `/api/articles/${initialValues?.id}`;

      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        message.success(mode === 'create' ? '创建成功' : '更新成功');
        router.push('/');
      } else {
        message.error(result.error || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      message.error('操作失败');
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
        <RichTextEditor placeholder="请输入文章内容" />
      </Form.Item>
    </Form>
  );
}
