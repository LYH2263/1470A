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

import type { QuillHighlightRange } from '@/types/sensitive-word';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  height?: number;
  highlightRanges?: QuillHighlightRange[];
  onEditorReady?: (api: RichTextEditorApi) => void;
}

export interface RichTextEditorApi {
  getQuill: () => any;
  getInnerHTML: () => string;
  setSensitiveHighlights: (ranges: QuillHighlightRange[]) => void;
  clearSensitiveHighlights: () => void;
  scrollToRange: (index: number, length: number) => void;
}

interface PendingImage {
  id: string;
  placeholderIndex: number;
}

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7kuIrvvIbljJbml6YjmsYTnoJTmsYTor73pgJrnmoTlpI3lj5HpgJrkuK3ljYc8L3RleHQ+PC9zdmc+';

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder,
  readOnly = false,
  height,
  highlightRanges = [],
  onEditorReady,
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [toolbarConfig, setToolbarConfig] = useState<any[]>(DEFAULT_TOOLBAR_CONFIG);
  const [showToolbarConfig, setShowToolbarConfig] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [showCodeBlockModal, setShowCodeBlockModal] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  const quillRef = useRef<any>(null);
  const quillInstanceRef = useRef<any>(null);
  const uploadQueueRef = useRef<UploadQueue | null>(null);
  const pendingImagesRef = useRef<Map<string, PendingImage>>(new Map());
  const hljsRef = useRef<any>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeRef = useRef(onChange);
  const onEditorReadyRef = useRef(onEditorReady);
  const appliedHighlightSpansRef = useRef<Array<{ id: string; range: any; format: any }>>([]);
  const quillFormatRegisteredRef = useRef(false);
  const handlePasteRef = useRef<(e: ClipboardEvent) => Promise<void>>(async () => {});

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

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
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const loadHighlightJs = useCallback(async () => {
    if (hljsRef.current) return hljsRef.current;
    try {
      const module = await import('highlight.js');
      hljsRef.current = module.default || module;
      return hljsRef.current;
    } catch (e) {
      console.error('加载 highlight.js 失败:', e);
      return null;
    }
  }, []);

  const highlightCodeBlocks = useCallback(() => {
    if (!quillInstanceRef.current) return;

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(async () => {
      const hljs = await loadHighlightJs();
      if (!hljs) return;

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
    }, 300);
  }, [loadHighlightJs]);

  const handleQuillReady = useCallback(() => {
    if (!quillRef.current || quillInstanceRef.current) return;

    const quill = quillRef.current.getEditor?.() || quillRef.current;
    if (!quill) return;

    quillInstanceRef.current = quill;

    if (!quillFormatRegisteredRef.current && typeof window !== 'undefined') {
      quillFormatRegisteredRef.current = true;
      import('quill').then(({ default: Quill }: any) => {
        const Inline = Quill.import('blots/inline');
        class SensitiveHlBlot extends Inline {
          static create(value: any) {
            const node = super.create();
            if (value?.level) {
              node.setAttribute('data-sensitive-level', value.level);
              node.setAttribute('data-sensitive-word', value.word || '');
              const colors: any = {
                high: { bg: '#ffebee', bd: '#ef5350' },
                medium: { bg: '#fff8e1', bd: '#ffa726' },
                low: { bg: '#e8f5e9', bd: '#66bb6a' },
              };
              const c = colors[value.level] || colors.low;
              node.style.backgroundColor = c.bg;
              node.style.border = `1px solid ${c.bd}`;
              node.style.borderRadius = '2px';
              node.style.padding = '0 2px';
            }
            return node;
          }
          static formats(node: any) {
            return {
              level: node.getAttribute('data-sensitive-level'),
              word: node.getAttribute('data-sensitive-word'),
            };
          }
          format(name: string, value: any) {
            if (name === 'sensitive-hl') {
              if (value === false) {
                if (this.domNode) {
                  this.domNode.removeAttribute('data-sensitive-level');
                  this.domNode.removeAttribute('data-sensitive-word');
                  this.domNode.style.backgroundColor = '';
                  this.domNode.style.border = '';
                  this.domNode.style.borderRadius = '';
                  this.domNode.style.padding = '';
                }
              } else if (value && this.domNode) {
                this.domNode.setAttribute('data-sensitive-level', value.level);
                this.domNode.setAttribute('data-sensitive-word', value.word || '');
                const colors: any = {
                  high: { bg: '#ffebee', bd: '#ef5350' },
                  medium: { bg: '#fff8e1', bd: '#ffa726' },
                  low: { bg: '#e8f5e9', bd: '#66bb6a' },
                };
                const c = colors[value.level] || colors.low;
                this.domNode.style.backgroundColor = c.bg;
                this.domNode.style.border = `1px solid ${c.bd}`;
                this.domNode.style.borderRadius = '2px';
                this.domNode.style.padding = '0 2px';
              }
            } else {
              super.format(name, value);
            }
          }
        }
        (SensitiveHlBlot as any).blotName = 'sensitive-hl';
        (SensitiveHlBlot as any).tagName = 'span';
        (SensitiveHlBlot as any).className = 'sensitive-word-highlight';
        try {
          Quill.register(SensitiveHlBlot, true);
        } catch (e) {
          // format already registered
        }
      }).catch(e => console.warn('Quill import failed for hl blot:', e));
    }

    quill.on('text-change', () => {
      highlightCodeBlocks();
      onChangeRef.current?.(quill.root.innerHTML);
    });

    quill.root.addEventListener('paste', (e: any) => handlePasteRef.current?.(e));

    if (onEditorReadyRef.current) {
      const api: RichTextEditorApi = {
        getQuill: () => quillInstanceRef.current,
        getInnerHTML: () => quillInstanceRef.current?.root?.innerHTML || '',
        setSensitiveHighlights: (ranges) => {
          applySensitiveHighlights(ranges);
        },
        clearSensitiveHighlights: () => {
          clearSensitiveHighlights();
        },
        scrollToRange: (index, length) => {
          const q = quillInstanceRef.current;
          if (!q) return;
          try {
            q.setSelection(index, length, 'silent');
            const leaf = q.getLeaf(index);
            if (leaf && leaf[0]) {
              const node = leaf[0].domNode;
              if (node && node.scrollIntoView) {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          } catch (e) { /* ignore */ }
        },
      };
      onEditorReadyRef.current(api);
    }
  }, [highlightCodeBlocks]);

  const clearSensitiveHighlights = useCallback(() => {
    const quill = quillInstanceRef.current;
    if (!quill) return;
    try {
      const delta = quill.getContents();
      const newOps: any[] = [];
      for (const op of delta.ops || []) {
        if (op.attributes && op.attributes['sensitive-hl']) {
          const { 'sensitive-hl': _hl, ...restAttrs } = op.attributes;
          const hasOther = Object.keys(restAttrs).length > 0;
          newOps.push({
            ...op,
            attributes: hasOther ? restAttrs : undefined,
          });
        } else {
          newOps.push(op);
        }
      }
      const sel = quill.getSelection();
      quill.setContents(newOps, 'silent');
      if (sel) {
        try { quill.setSelection(sel, 'silent'); } catch (e) {}
      }
    } catch (e) {
      console.warn('clearSensitiveHighlights failed:', e);
    }
    appliedHighlightSpansRef.current = [];
  }, []);

  const applySensitiveHighlights = useCallback((
    ranges: QuillHighlightRange[]
  ) => {
    const quill = quillInstanceRef.current;
    if (!quill) return;
    clearSensitiveHighlights();
    if (!ranges || ranges.length === 0) return;
    try {
      const sel = quill.getSelection();
      const sorted = [...ranges].sort((a, b) => b.index - a.index);
      for (const r of sorted) {
        if (r.index < 0 || r.length <= 0) continue;
        try {
          quill.formatText(
            r.index,
            r.length,
            'sensitive-hl',
            { level: r.level, word: r.word },
            'silent'
          );
        } catch (e) {
          console.warn('format range failed:', r, e);
        }
      }
      if (sel) {
        try { quill.setSelection(sel, 'silent'); } catch (e) {}
      }
    } catch (e) {
      console.warn('applySensitiveHighlights failed:', e);
    }
  }, [clearSensitiveHighlights]);

  useEffect(() => {
    if (quillInstanceRef.current && highlightRanges) {
      applySensitiveHighlights(highlightRanges);
    }
  }, [highlightRanges, applySensitiveHighlights]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (readOnly || !quillInstanceRef.current) return;

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
      uploadImages(imageFiles);
    }
  }, [readOnly]);

  useEffect(() => {
    handlePasteRef.current = handlePaste;
  }, [handlePaste]);

  const uploadImages = useCallback((files: File[]) => {
    if (!quillInstanceRef.current || !uploadQueueRef.current) return;

    const quill = quillInstanceRef.current;
    const range = quill.getSelection();
    let insertIndex = range?.index ?? quill.getLength();

    files.forEach((file, fileIndex) => {
      const currentIndex = insertIndex + fileIndex;
      
      quill.insertEmbed(currentIndex, 'image', PLACEHOLDER_IMAGE);

      const pendingId = `pending-${Date.now()}-${fileIndex}-${Math.random().toString(36).substr(2, 9)}`;
      
      pendingImagesRef.current.set(pendingId, {
        id: pendingId,
        placeholderIndex: currentIndex,
      });

      uploadQueueRef.current!.addTask({
        file,
        onComplete: (url) => {
          handleImageUploadComplete(pendingId, url);
        },
        onError: (error) => {
          handleImageUploadError(pendingId, error);
        },
      });
    });
  }, []);

  const handleImageUploadComplete = useCallback((pendingId: string, url: string) => {
    const pending = pendingImagesRef.current.get(pendingId);
    if (!pending || !quillInstanceRef.current) return;

    const quill = quillInstanceRef.current;
    const delta = quill.getContents();
    let found = false;
    let ops: any[] = [];
    let currentIndex = 0;

    for (const op of delta.ops || []) {
      if (!found && op.insert?.image === PLACEHOLDER_IMAGE) {
        if (currentIndex === pending.placeholderIndex) {
          ops.push({ insert: { image: url } });
          found = true;
          currentIndex += 1;
          continue;
        }
      }
      ops.push(op);
      if (op.insert) {
        currentIndex += typeof op.insert === 'string' ? op.insert.length : 1;
      }
    }

    if (found) {
      quill.setContents(ops);
    }

    pendingImagesRef.current.delete(pendingId);
  }, []);

  const handleImageUploadError = useCallback((pendingId: string, error: string) => {
    message.error(`图片上传失败: ${error}`);
    const pending = pendingImagesRef.current.get(pendingId);
    
    if (pending && quillInstanceRef.current) {
      const quill = quillInstanceRef.current;
      const delta = quill.getContents();
      let ops: any[] = [];
      let currentIndex = 0;
      let found = false;

      for (const op of delta.ops || []) {
        if (!found && op.insert?.image === PLACEHOLDER_IMAGE) {
          if (currentIndex === pending.placeholderIndex) {
            found = true;
            currentIndex += 1;
            continue;
          }
        }
        ops.push(op);
        if (op.insert) {
          currentIndex += typeof op.insert === 'string' ? op.insert.length : 1;
        }
      }

      if (found) {
        quill.setContents(ops);
      }
    }

    pendingImagesRef.current.delete(pendingId);
  }, []);

  const imageHandler = useCallback(function (this: any) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.setAttribute('multiple', 'multiple');
    input.click();

    input.onchange = () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      uploadImages(Array.from(files));
    };
  }, [uploadImages]);

  const videoHandler = useCallback(() => {
    setShowVideoModal(true);
  }, []);

  const handleVideoInsert = useCallback(() => {
    if (!videoUrl || !quillInstanceRef.current) return;

    if (!isVideoUrlAllowed(videoUrl)) {
      message.error('不支持的视频网站域名');
      return;
    }

    const embedUrl = convertToEmbedUrl(videoUrl);
    if (!embedUrl) {
      message.error('无法解析视频链接');
      return;
    }

    const quill = quillInstanceRef.current;
    const range = quill.getSelection();
    const index = range?.index ?? quill.getLength();

    quill.insertEmbed(index, 'video', embedUrl);
    setShowVideoModal(false);
    setVideoUrl('');
  }, [videoUrl]);

  const tableHandler = useCallback(() => {
    if (!quillInstanceRef.current) return;

    const quill = quillInstanceRef.current;
    const tableModule = quill.getModule('better-table');
    
    if (tableModule && typeof tableModule.insertTable === 'function') {
      tableModule.insertTable(3, 3);
    } else {
      const range = quill.getSelection();
      const index = range?.index ?? quill.getLength();
      
      let tableHtml = '<table class="ql-better-table" style="border-collapse: collapse; width: 100%; margin: 10px 0;">';
      for (let i = 0; i < 3; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < 3; j++) {
          const tag = i === 0 ? 'th' : 'td';
          tableHtml += `<${tag} style="border: 1px solid #d9d9d9; padding: 8px; min-width: 80px;">${i === 0 ? `标题${j + 1}` : `内容${i + 1}-${j + 1}`}</${tag}>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table><p><br></p>';

      quill.clipboard.dangerouslyPasteHTML(index, tableHtml);
    }
  }, []);

  const codeBlockHandler = useCallback(() => {
    setShowCodeBlockModal(true);
  }, []);

  const handleCodeBlockInsert = useCallback(async () => {
    if (!quillInstanceRef.current) return;

    const quill = quillInstanceRef.current;
    const range = quill.getSelection();
    const index = range?.index ?? quill.getLength();

    quill.format('code-block', true);
    quill.insertText(index, `// 在此输入 ${EDITOR_CONFIG.CODE_BLOCK_LANGUAGES.find(l => l.value === codeLanguage)?.label} 代码\n`);
    
    setTimeout(() => {
      const codeBlocks = document.querySelectorAll('.ql-code-block-container');
      const lastCodeBlock = codeBlocks[codeBlocks.length - 1];
      if (lastCodeBlock) {
        lastCodeBlock.setAttribute('data-language', codeLanguage);
        const codeElement = lastCodeBlock.querySelector('code');
        if (codeElement) {
          codeElement.classList.add(`language-${codeLanguage}`);
        }
      }
      highlightCodeBlocks();
    }, 50);

    setShowCodeBlockModal(false);
  }, [codeLanguage, highlightCodeBlocks]);

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

  const modules = useMemo(() => {
    const config: any = {
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
    };

    if (!readOnly && typeof window !== 'undefined') {
      config['better-table'] = {
        contextMenu: true,
        operationMenu: {
          insertColumnRight: { text: '右侧插入列' },
          insertColumnLeft: { text: '左侧插入列' },
          insertRowUp: { text: '上方插入行' },
          insertRowDown: { text: '下方插入行' },
          mergeCells: { text: '合并单元格' },
          unmergeCells: { text: '取消合并' },
          deleteColumn: { text: '删除列' },
          deleteRow: { text: '删除行' },
          deleteTable: { text: '删除表格' },
        },
        keyboard: true,
        tabsize: 4,
        resizable: true,
      };
    }

    return config;
  }, [imageHandler, videoHandler, tableHandler, codeBlockHandler, readOnly, toolbarConfig]);

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
      'better-table',
      'sensitive-hl',
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

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      const registerTableModule = async () => {
        try {
          const Quill = (await import('quill')).default || (await import('quill'));
          const QuillBetterTable = (await import('quill-better-table')).default || (await import('quill-better-table'));
          
          if (Quill && QuillBetterTable) {
            Quill.register({
              'modules/better-table': QuillBetterTable,
            }, true);
          }
        } catch (e) {
          console.warn('注册 quill-better-table 失败，将使用基础表格功能:', e);
        }
      };
      registerTableModule();
    }
  }, [mounted]);

  useEffect(() => {
    if (mounted && quillRef.current && !quillInstanceRef.current) {
      const timer = setTimeout(() => {
        handleQuillReady();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mounted, handleQuillReady]);

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

      <ReactQuill
        ref={(el: any) => {
          quillRef.current = el;
          if (el && !quillInstanceRef.current) {
            setTimeout(handleQuillReady, 50);
          }
        }}
        theme="snow"
        value={value}
        onChange={readOnly ? undefined : () => {}}
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
        
        .article-content table,
        .ql-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        
        .article-content th,
        .article-content td,
        .ql-editor th,
        .ql-editor td {
          border: 1px solid #d9d9d9;
          padding: 8px 12px;
          text-align: left;
        }
        
        .article-content th,
        .ql-editor th {
          background: #fafafa;
          font-weight: 600;
        }
        
        .article-content iframe,
        .ql-editor iframe {
          max-width: 100%;
          aspect-ratio: 16 / 9;
          border: none;
          border-radius: 4px;
        }
        
        .article-content pre,
        .ql-editor pre {
          background: #f6f8fa;
          border-radius: 4px;
          padding: 16px;
          overflow-x: auto;
        }
        
        .article-content code,
        .ql-editor code {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .ql-better-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ql-better-table td,
        .ql-better-table th {
          border: 1px solid #d9d9d9;
          padding: 8px;
          min-width: 50px;
        }

        .ql-better-table-selected-cell {
          background-color: #e6f7ff !important;
        }

        .ql-table-context-menu {
          position: absolute;
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 120px;
        }

        .ql-table-context-menu-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
        }

        .ql-table-context-menu-item:hover {
          background: #f5f5f5;
        }
      `}</style>
    </div>
  );
}