import type { NextApiResponse } from 'next';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import type { ApiResponse } from '@/types/article';
import { FILE_UPLOAD } from '@/lib/constants';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';

type AllowedMimeType = (typeof FILE_UPLOAD.ALLOWED_TYPES)[number];
function isAllowedMimeType(value: unknown): value is AllowedMimeType {
  return typeof value === 'string' && (FILE_UPLOAD.ALLOWED_TYPES as readonly string[]).includes(value);
}

type AllowedFileExtension = (typeof FILE_UPLOAD.ALLOWED_EXTENSIONS)[number];
function isAllowedFileExtension(value: unknown): value is AllowedFileExtension {
  return typeof value === 'string' && (FILE_UPLOAD.ALLOWED_EXTENSIONS as readonly string[]).includes(value);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default withAuth(async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const form = formidable({});
    const [, files] = await form.parse(req);

    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件',
      });
    }

    try {
      // 验证文件类型
      if (!isAllowedMimeType(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: '只支持上传 JPG、PNG、GIF、WebP 格式的图片',
        });
      }

      // 验证文件大小
      if (file.size > FILE_UPLOAD.MAX_SIZE) {
        return res.status(400).json({
          success: false,
          error: '文件大小不能超过 10MB',
        });
      }

      // 安全地获取文件扩展名（使用白名单验证）
      const originalExt = path.extname(file.originalFilename || '').toLowerCase();

      if (!isAllowedFileExtension(originalExt)) {
        return res.status(400).json({
          success: false,
          error: '不支持的文件扩展名',
        });
      }

      // 使用安全的文件名（不依赖用户输入）
      const filename = `${uuidv4()}${originalExt}`;

      // 创建上传目录（按日期分类）
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(year), month, day);

      await mkdir(uploadDir, { recursive: true });

      // 读取并保存文件
      const buffer = await readFile(file.filepath);
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, buffer);

      // 返回文件 URL
      const url = `/uploads/${year}/${month}/${day}/${filename}`;

      return res.status(200).json({
        success: true,
        data: { url },
      });
    } finally {
      // 清理 formidable 临时文件，避免积累占用磁盘
      await unlink(file.filepath).catch(() => undefined);
    }
  } catch (error) {
    console.error('上传文件失败:', error);
    return res.status(500).json({
      success: false,
      error: '上传文件失败',
    });
  }
});
