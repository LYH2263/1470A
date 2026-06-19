import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { EDITOR_CONFIG } from '@/lib/constants';
import { fetchWithAuth } from '@/lib/api';
import 'react-quill/dist/quill.snow.css';

// 动态导入 ReactQuill，禁用 SSR
// @ts-ignore - react-quill 类型定义问题
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value = '', onChange, placeholder }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 自定义图片上传处理
  const imageHandler = useCallback(function(this: any) {
    // 在 handler 中，this 指向 Quill 实例
    const editor = this.quill;
    if (!editor) return;

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetchWithAuth('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          const range = editor.getSelection();
          editor.insertEmbed(range?.index ?? 0, 'image', result.data.url);
        } else {
          alert(result.error || '上传失败');
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        alert('上传图片失败');
      }
    };
  }, []);

  // Quill 编辑器配置 - 使用 useMemo 避免每次渲染都重新创建
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: {
          image: imageHandler,
        },
      },
    }),
    [imageHandler]
  );

  const formats = useMemo(
    () => [
      'header',
      'bold',
      'italic',
      'underline',
      'strike',
      'list',
      'bullet',
      'color',
      'background',
      'align',
      'link',
      'image',
    ],
    []
  );

  // 在客户端挂载前不渲染编辑器
  if (!mounted) {
    return (
      <div
        style={{
          height: `${EDITOR_CONFIG.HEIGHT}px`,
          marginBottom: `${EDITOR_CONFIG.MARGIN_BOTTOM}px`,
          border: '1px solid #d9d9d9',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        加载编辑器...
      </div>
    );
  }

  return (
    <div className="rich-text-editor">
      {/* @ts-ignore - react-quill ref type issue */}
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{
          height: `${EDITOR_CONFIG.HEIGHT}px`,
          marginBottom: `${EDITOR_CONFIG.MARGIN_BOTTOM}px`,
        }}
      />
    </div>
  );
}
