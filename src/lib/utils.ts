import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import DOMPurify from 'isomorphic-dompurify';
import { VIDEO_EMBED_WHITELIST, DOMPURIFY_ADDONS, DEFAULT_TOOLBAR_CONFIG } from './constants';

// 合并 Tailwind CSS 类名
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化日期
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 重要性等级映射
export const importanceMap = {
  low: { label: '低', color: 'success' },
  medium: { label: '中', color: 'warning' },
  high: { label: '高', color: 'error' },
} as const;

// 验证视频URL是否在白名单内
export function isVideoUrlAllowed(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    return VIDEO_EMBED_WHITELIST.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// 将视频URL转换为嵌入URL
export function convertToEmbedUrl(url: string): string | null {
  if (!isVideoUrlAllowed(url)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname;
    const searchParams = parsedUrl.searchParams;

    // YouTube
    if (hostname.includes('youtube.com') || hostname === 'youtu.be') {
      let videoId = '';
      if (hostname === 'youtu.be') {
        videoId = pathname.slice(1);
      } else if (searchParams.has('v')) {
        videoId = searchParams.get('v') || '';
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // Bilibili
    if (hostname.includes('bilibili.com')) {
      const bvMatch = pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      if (bvMatch) {
        return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}`;
      }
    }

    // Vimeo
    if (hostname.includes('vimeo.com')) {
      const vimeoMatch = pathname.match(/\/(\d+)/);
      if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }

    return url;
  } catch {
    return null;
  }
}

// 创建视频嵌入HTML
export function createVideoEmbedHtml(url: string, width = 640, height = 360): string | null {
  const embedUrl = convertToEmbedUrl(url);
  if (!embedUrl) return null;

  return `<iframe 
    src="${embedUrl}" 
    width="${width}" 
    height="${height}" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen
  ></iframe>`;
}

// 配置DOMPurify，添加表格和视频白名单
export function configureDOMPurify(): void {
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const src = (node as HTMLElement).getAttribute('src');
      if (src && isVideoUrlAllowed(src)) {
        return;
      }
    }
  });

  DOMPurify.setConfig({
    ADD_TAGS: [...DOMPURIFY_ADDONS.ALLOWED_TAGS],
    ADD_ATTR: [...DOMPURIFY_ADDONS.ALLOWED_ATTR],
    ALLOW_DATA_ATTR: DOMPURIFY_ADDONS.ALLOW_DATA_ATTR,
  });
}

// 清理富文本内容（用于详情页渲染）
export function sanitizeRichContent(content: string): string {
  configureDOMPurify();
  return DOMPurify.sanitize(content);
}

// 用户偏好存储键
const USER_PREFERENCE_KEY = 'user_preferences';

interface UserPreferences {
  toolbarConfig?: any[];
  codeBlockDefaultLanguage?: string;
  editorTheme?: string;
  [key: string]: unknown;
}

// 获取用户偏好
export function getUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(USER_PREFERENCE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// 保存用户偏好
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(USER_PREFERENCE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('保存用户偏好失败:', error);
  }
}

// 获取工具栏配置
export function getToolbarConfig() {
  if (typeof window === 'undefined') {
    return null;
  }
  const prefs = getUserPreferences();
  return prefs.toolbarConfig || null;
}

// 保存工具栏配置
export function saveToolbarConfig(config: any[]): void {
  saveUserPreferences({ toolbarConfig: config });
}

// 并发上传队列
export interface UploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  url?: string;
  error?: string;
  onProgress?: (progress: number) => void;
  onComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export class UploadQueue {
  private queue: UploadTask[] = [];
  private activeUploads = 0;
  private concurrency: number;
  private maxRetries: number;

  constructor(concurrency = 3, maxRetries = 3) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  addTask(task: Omit<UploadTask, 'id' | 'status' | 'progress'>): string {
    const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: UploadTask = {
      ...task,
      id: taskId,
      status: 'pending',
      progress: 0,
    };
    this.queue.push(newTask);
    this.processQueue();
    return taskId;
  }

  private async processQueue(): Promise<void> {
    while (this.activeUploads < this.concurrency && this.queue.length > 0) {
      const task = this.queue.find(t => t.status === 'pending');
      if (!task) break;

      task.status = 'uploading';
      this.activeUploads++;

      this.uploadWithRetry(task)
        .finally(() => {
          this.activeUploads--;
          this.processQueue();
        });
    }
  }

  private async uploadWithRetry(task: UploadTask, retryCount = 0): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', task.file);

      const token = typeof window !== 'undefined' 
        ? localStorage.getItem('auth_token') 
        : null;

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        task.status = 'completed';
        task.progress = 100;
        task.url = result.data.url;
        task.onProgress?.(100);
        task.onComplete?.(result.data.url);
      } else {
        throw new Error(result.error || '上传失败');
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.uploadWithRetry(task, retryCount + 1);
      }

      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '上传失败';
      task.onError?.(task.error);
    }
  }

  getTask(taskId: string): UploadTask | undefined {
    return this.queue.find(t => t.id === taskId);
  }

  cancelTask(taskId: string): void {
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.queue.splice(taskIndex, 1);
    }
  }

  clear(): void {
    this.queue = [];
  }
}
