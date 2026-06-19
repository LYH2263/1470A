import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Modal, Input, Select, Button, message, Dropdown, MenuProps } from 'antd';
import { EDITOR_CONFIG, DEFAULT_TOOLBAR_CONFIG } from '@/lib/constants';
import { fetchWithAuth } from '@/lib/api';
import {
  isVideoUrlAllowed,
  convertToEmbedUrl,
  getToolbarConfig,
  saveToolbarConfig,
  UploadQueue,
} from '@/lib/utils';
import 'react-quill/dist/quill.snow.css';
import 'highlight.js/styles/github.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: number;
}

interface PendingImage {
  id: string;
  index: number;
  length: number;
}

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder,
  readOnly = false,
  height,
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [quillInstance, setQuillInstance] = useState<any>(null);
  const [toolbarConfig, setToolbarConfig] = useState<any[]>(DEFAULT_TOOLBAR_CONFIG);
  const [showToolbarConfig, setShowToolbarConfig] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [showCodeBlockModal, setShowCodeBlockModal] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  const quillRef = useRef<any>(null);
  const uploadQueueRef = useRef<UploadQueue | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      uploadQueueRef.current = new UploadQueue(
        EDITOR_CONFIG.UPLOAD_CONCURRENCY,
        EDITOR_CONFIG.UPLOAD_RETRY_COUNT
      );

      const savedConfig = getToolbarConfig();
      if (savedConfig) {
        setToolbarConfig(savedConfig);
      }
    }

    return () => {
      uploadQueueRef.current?.clear();
    };
  }, []);

  const handleQuillReady = useCallback(() => {
    if (quillRef.current) {
      // @ts-ignore
      const quill = quillRef.current.getEditor();
      setQuillInstance(quill);

      if (typeof window !== 'undefined') {
        import('highlight.js').then((module) => {
          const hljs = module.default || module;
          quill?.on('text-change', () => {
            const codeBlocks = document.querySelectorAll('.ql-code-block-container');
            codeBlocks.forEach((block) => {
              const codeElement = block.querySelector('code');
              if (codeElement && !codeElement.classList.contains('hljs')) {
                try {
                  if (typeof hljs.highlightElement === 'function') {
                    hljs.highlightElement(codeElement as HTMLElement);
                  } else if (typeof hljs.highlightBlock === 'function') {
                    hljs.highlightBlock(codeElement as HTMLElement);
                  }
                } catch (e) {
                  // 忽略高亮错误
                }
              }
            });
          });
        });
      }

      quill?.root?.addEventListener('paste', handlePaste);
    }
  }, []);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (readOnly || !quillInstance) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await uploadPastedImages(imageFiles);
    }
  }, [readOnly, quillInstance]);

  const uploadPastedImages = async (files: File[]) => {
    if (!quillInstance || !uploadQueueRef.current) return;

    const range = quillInstance.getSelection();
    const startIndex = range?.index ?? quillInstance.getLength();

    files.forEach((file, fileIndex) => {
      const insertIndex = startIndex + fileIndex;
      
      quillInstance.insertEmbed(insertIndex, 'image', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7kuIrvvIbljJbml6YjmsYTnoJTmsYTor73pgJrnmoTlpI3lj5HpgJrkuK3ljYc8L3RleHQ+PC9zdmc+');

      const pendingImage: PendingImage = {
        id: `pending-${Date.now()}-${fileIndex}`,
        index: insertIndex,
        length: 1,
      };
      pendingImagesRef.current.push(pendingImage);

      uploadQueueRef.current!.addTask({
        file,
        onComplete: (url) => {
          handleImageUploadComplete(pendingImage.id, url);
        },
        onError: (error) => {
          handleImageUploadError(pendingImage.id, error);
        },
      });
    });
  };

  const handleImageUploadComplete = (pendingId: string, url: string) => {
    if (!quillInstance) return;

    const pendingIndex = pendingImagesRef.current.findIndex(p => p.id === pendingId);
    if (pendingIndex === -1) return;

    const pending = pendingImagesRef.current[pendingIndex];
    
    const delta = quillInstance.getContents();
    let currentOffset = 0;
    let foundIndex = -1;

    delta.ops?.forEach((op: any, idx: number) => {
      if (foundIndex !== -1) return;
      if (op.insert?.image === 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7kuIrvvIbljJbml6YjmsYTnoJTmsYTor73pgJrnmoTlpI3lj5HpgJrkuK3ljYc8L3RleHQ+PC9zdmc+') {
        if (currentOffset === pending.index) {
          foundIndex = idx;
        }
      }
      if (op.insert) {
        currentOffset += typeof op.insert === 'string' ? op.insert.length : 1;
      }
    });

    if (foundIndex !== -1) {
      const newDelta = delta.compose(new (quillInstance.constructor as any).Delta()
        .retain(foundIndex)
        .delete(1)
        .insert({ image: url }));
      
      quillInstance.setContents(newDelta);
    }

    pendingImagesRef.current.splice(pendingIndex, 1);
    onChange?.(quillInstance.root.innerHTML);
  };

  const handleImageUploadError = (pendingId: string, error: string) => {
    message.error(`图片上传失败: ${error}`);
    const pendingIndex = pendingImagesRef.current.findIndex(p => p.id === pendingId);
    if (pendingIndex !== -1) {
      pendingImagesRef.current.splice(pendingIndex, 1);
    }
  };

  const imageHandler = useCallback(function (this: any) {
    const editor = this.quill;
    if (!editor) return;

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.setAttribute('multiple', 'multiple');
    input.click();

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;

      await uploadPastedImages(Array.from(files));
    };
  }, []);

  const videoHandler = useCallback(() => {
    setShowVideoModal(true);
  }, []);

  const handleVideoInsert = useCallback(() => {
    if (!videoUrl || !quillInstance) return;

    if (!isVideoUrlAllowed(videoUrl)) {
      message.error('不支持的视频网站域名');
      return;
    }

    const embedUrl = convertToEmbedUrl(videoUrl);
    if (!embedUrl) {
      message.error('无法解析视频链接');
      return;
    }

    const range = quillInstance.getSelection();
    const index = range?.index ?? quillInstance.getLength();

    const videoHtml = `<iframe 
      src="${embedUrl}" 
      width="640" 
      height="360" 
      frameborder="0" 
      class="ql-video-embed"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen
    ></iframe>`;

    quillInstance.insertEmbed(index, 'video', embedUrl);
    setShowVideoModal(false);
    setVideoUrl('');
    onChange?.(quillInstance.root.innerHTML);
  }, [videoUrl, quillInstance, onChange]);

  const tableHandler = useCallback(() => {
    if (!quillInstance) return;
    
    const tableModule = quillInstance.getModule('better-table');
    if (tableModule) {
      tableModule.insertTable(3, 3);
    } else {
      const range = quillInstance.getSelection();
      const index = range?.index ?? quillInstance.getLength();
      
      let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
      for (let i = 0; i < 3; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < 3; j++) {
          const tag = i === 0 ? 'th' : 'td';
          tableHtml += `<${tag} style="border: 1px solid #d9d9d9; padding: 8px; min-width: 80px;">${i === 0 ? `标题${j + 1}` : `内容${i + 1}-${j + 1}`}</${tag}>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';

      quillInstance.clipboard.dangerouslyPasteHTML(index, tableHtml);
    }
    onChange?.(quillInstance.root.innerHTML);
  }, [quillInstance, onChange]);

  const codeBlockHandler = useCallback(() => {
    setShowCodeBlockModal(true);
  }, []);

  const handleCodeBlockInsert = useCallback(() => {
    if (!quillInstance) return;

    const range = quillInstance.getSelection();
    const index = range?.index ?? quillInstance.getLength();

    quillInstance.format('code-block', true);
    quillInstance.insertText(index, `// 在此输入 ${EDITOR_CONFIG.CODE_BLOCK_LANGUAGES.find(l => l.value === codeLanguage)?.label} 代码\n`);
    
    const codeBlockContainer = document.querySelector('.ql-code-block-container:last-of-type');
    if (codeBlockContainer) {
      codeBlockContainer.setAttribute('data-language', codeLanguage);
      const codeElement = codeBlockContainer.querySelector('code');
      if (codeElement) {
        codeElement.classList.add(`language-${codeLanguage}`);
        import('highlight.js').then((module) => {
          const hljs = module.default || module;
          try {
            if (typeof hljs.highlightElement === 'function') {
              hljs.highlightElement(codeElement as HTMLElement);
            } else if (typeof hljs.highlightBlock === 'function') {
              hljs.highlightBlock(codeElement as HTMLElement);
            }
          } catch (e) {
            // 忽略高亮错误
          }
        });
      }
    }

    setShowCodeBlockModal(false);
    onChange?.(quillInstance.root.innerHTML);
  }, [quillInstance, codeLanguage, onChange]);

  const handleToolbarConfigSave = useCallback(() => {
    saveToolbarConfig(toolbarConfig);
    setShowToolbarConfig(false);
    message.success('工具栏配置已保存');
  }, [toolbarConfig]);

  const resetToolbarConfig = useCallback(() => {
    setToolbarConfig(DEFAULT_TOOLBAR_CONFIG);
    saveToolbarConfig(DEFAULT_TOOLBAR_CONFIG);
    message.success('工具栏配置已重置为默认');
  }, []);

  const toggleToolbarItem = useCallback((item: any, index: number) => {
    const newConfig = [...toolbarConfig];
    if (Array.isArray(item)) {
      const groupIndex = newConfig.findIndex((group, idx) => 
        idx === index && Array.isArray(group) && JSON.stringify(group) === JSON.stringify(item)
      );
      if (groupIndex !== -1) {
        newConfig.splice(groupIndex, 1);
      } else {
        newConfig.splice(index, 0, item);
      }
    } else {
      const itemIndex = newConfig.findIndex((group, idx) => 
        idx === index && group === item
      );
      if (itemIndex !== -1) {
        newConfig.splice(itemIndex, 1);
      } else {
        newConfig.splice(index, 0, item);
      }
    }
    setToolbarConfig(newConfig);
  }, [toolbarConfig]);

  const modules = useMemo(
    () => ({
      toolbar: readOnly
        ? false
        : {
            container: toolbarConfig,
            handlers: {
              image: imageHandler,
              video: videoHandler,
              table: tableHandler,
              'code-block': codeBlockHandler,
            },
          },
      clipboard: {
        matchVisual: false,
      },
    }),
    [imageHandler, videoHandler, tableHandler, codeBlockHandler, readOnly, toolbarConfig]
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
      'video',
      'code-block',
      'code',
      'table',
      'table-row',
      'table-cell',
    ],
    []
  );

  const toolbarMenuItems: MenuProps['items'] = [
    {
      key: 'config',
      label: '自定义工具栏',
      onClick: () => setShowToolbarConfig(true),
    },
    {
      key: 'reset',
      label: '重置为默认',
      onClick: resetToolbarConfig,
    },
  ];

  const editorHeight = height ?? EDITOR_CONFIG.HEIGHT;

  if (!mounted) {
    return (
      <div
        style={{
          height: `${editorHeight}px`,
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
      {!readOnly && (
        <div style={{ marginBottom: '8px', textAlign: 'right' }}>
          <Dropdown menu={{ items: toolbarMenuItems }}>
            <Button size="small">工具栏设置</Button>
          </Dropdown>
        </div>
      )}

      {/* @ts-ignore - react-quill ref type issue */}
      <ReactQuill
        ref={(el: any) => {
          quillRef.current = el;
          if (el && !quillInstance) {
            setTimeout(handleQuillReady, 100);
          }
        }}
        theme="snow"
        value={value}
        onChange={readOnly ? undefined : onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          height: `${editorHeight}px`,
          marginBottom: `${EDITOR_CONFIG.MARGIN_BOTTOM}px`,
        }}
      />

      <Modal
        title="插入视频"
        open={showVideoModal}
        onOk={handleVideoInsert}
        onCancel={() => {
          setShowVideoModal(false);
          setVideoUrl('');
        }}
        okText="插入"
        cancelText="取消"
      >
        <p style={{ color: '#666', marginBottom: '12px' }}>
          支持的视频平台：YouTube、Bilibili、Vimeo、优酷、爱奇艺、腾讯视频等
        </p>
        <Input
          placeholder="请输入视频链接，例如：https://www.youtube.com/watch?v=xxx"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </Modal>

      <Modal
        title="插入代码块"
        open={showCodeBlockModal}
        onOk={handleCodeBlockInsert}
        onCancel={() => setShowCodeBlockModal(false)}
        okText="插入"
        cancelText="取消"
      >
        <Select
          style={{ width: '100%' }}
          value={codeLanguage}
          onChange={setCodeLanguage}
          options={EDITOR_CONFIG.CODE_BLOCK_LANGUAGES.map((lang) => ({
            value: lang.value,
            label: lang.label,
          }))}
        />
      </Modal>

      <Modal
        title="自定义工具栏"
        open={showToolbarConfig}
        onOk={handleToolbarConfigSave}
        onCancel={() => setShowToolbarConfig(false)}
        okText="保存配置"
        cancelText="取消"
        width={600}
      >
        <p style={{ color: '#666', marginBottom: '16px' }}>
          选择要显示的工具栏按钮，配置将自动保存到您的偏好设置中。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {DEFAULT_TOOLBAR_CONFIG.map((item, index) => {
            const isSelected = toolbarConfig.some(
              (tc) => JSON.stringify(tc) === JSON.stringify(item)
            );
            let label = '';
            if (Array.isArray(item) && item.length > 0) {
              if (typeof item[0] === 'object' && item[0] !== null) {
                label = Object.keys(item[0])[0] || String(item);
              } else {
                label = item.join(', ');
              }
            } else {
              label = String(item);
            }
            return (
              <Button
                key={index}
                type={isSelected ? 'primary' : 'default'}
                onClick={() => toggleToolbarItem(item, index)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </Modal>

      <style jsx global>{`
        .ql-video-embed {
          max-width: 100%;
          aspect-ratio: 16 / 9;
        }
        
        .ql-code-block-container {
          position: relative;
          background: #f6f8fa;
          border-radius: 4px;
          margin: 10px 0;
          padding: 16px;
          overflow-x: auto;
        }
        
        .ql-code-block-container::before {
          content: attr(data-language);
          position: absolute;
          top: 4px;
          right: 8px;
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
        }
        
        .ql-code-block-container pre {
          margin: 0;
          background: transparent;
        }
        
        .ql-code-block-container code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .article-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        
        .article-content th,
        .article-content td {
          border: 1px solid #d9d9d9;
          padding: 8px 12px;
          text-align: left;
        }
        
        .article-content th {
          background: #fafafa;
          font-weight: 600;
        }
        
        .article-content iframe {
          max-width: 100%;
          aspect-ratio: 16 / 9;
          border: none;
          border-radius: 4px;
        }
        
        .article-content pre {
          background: #f6f8fa;
          border-radius: 4px;
          padding: 16px;
          overflow-x: auto;
        }
        
        .article-content code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
      `}</style>
    </div>
  );
}