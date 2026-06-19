// 文件上传配置
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const,
} as const;

// 富文本编辑器配置
export const EDITOR_CONFIG = {
  HEIGHT: 400,
  MARGIN_BOTTOM: 50,
  CODE_BLOCK_LANGUAGES: [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'sql', label: 'SQL' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'bash', label: 'Bash/Shell' },
  ],
  UPLOAD_CONCURRENCY: 3,
  UPLOAD_RETRY_COUNT: 3,
} as const;

// 视频嵌入白名单域名
export const VIDEO_EMBED_WHITELIST = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'bilibili.com',
  'www.bilibili.com',
  'player.bilibili.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'youku.com',
  'www.youku.com',
  'player.youku.com',
  'iqiyi.com',
  'www.iqiyi.com',
  'player.iqiyi.com',
  'qq.com',
  'v.qq.com',
  'dailymotion.com',
  'www.dailymotion.com',
  'dai.ly',
] as const;

// 工具栏默认配置
export const DEFAULT_TOOLBAR_CONFIG: any[] = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ['code-block', 'code'],
  ['link', 'image', 'video'],
  ['table'],
  ['clean'],
];

// DOMPurify 白名单扩展配置
export const DOMPURIFY_ADDONS = {
  ALLOWED_TAGS: [
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup',
    'caption', 'video', 'source', 'iframe', 'pre', 'code', 'span', 'div',
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'src', 'href', 'target', 'rel', 'width', 'height',
    'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'align',
    'frameborder', 'allow', 'allowfullscreen', 'controls', 'autoplay',
    'loop', 'muted', 'poster', 'type', 'data-language',
  ],
  ALLOW_DATA_ATTR: true,
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;

// 搜索配置
export const SEARCH = {
  MAX_KEYWORD_LENGTH: 100,
  SNIPPET_LENGTH: 200,
  HIGHLIGHT_PRE_TAG: '<mark>',
  HIGHLIGHT_POST_TAG: '</mark>',
  SUGGESTION_LIMIT: 5,
  MIN_QUERY_LENGTH: 1,
} as const;
