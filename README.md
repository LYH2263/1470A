# 文章管理系统

一个基于 Next.js 16（Pages Router）的现代化文章管理系统，提供完整的文章 CRUD 功能和 JWT 认证。

## 原始需求

> 文章管理功能需求文档 ## 一、概述 本需求旨在实现一个标准的后台文章管理功能，为运营或管理人员提供一个集文章列表展示、搜索、创建、编辑、查看详情及删除于一体的完整内容管理解决方案。 ## 二、页面关系 该功能由一个主页面（列表页）和三个子页面（创建页、编辑页、详情页）构成，页面跳转逻辑清晰，形成闭环操作： - 入口：用户首先进入“文章列表页”。 - 跳转流程： - 从列表页点击“新增”按钮，跳转至“文章创建页”。 - 从列表页点击某条数据对应的“编辑”按钮，跳转至“文章编辑页”，并携带该条数据信息。 - 从列表页点击某条数据对应的“详情”按钮，跳转至“文章详情页”。 - 返回流程： - 在“创建页”、“编辑页”或“详情页”中，可通过“返回”按钮或完成“保存”操作后，自动返回到“文章列表页”。 ## 三、主题色调 整体采用以科技蓝为主色调，搭配亮白色和浅灰色背景的设计，营造专业、简洁的视觉氛围。同时使用功能性颜色（如绿色、红色）进行操作提示。 ## 四、页面风格 采用现代化扁平设计风格，核心内容区域使用卡片式布局，信息层级分明。整体视觉密度中等，UI细节（如圆角、图标）保持高度一致性，确保了专业且友好的用户体验。 ## 五、页面布局 所有页面共享统一的“左侧菜单 + 顶部导航 + 主内容区”的经典后台布局。 - 文章列表页：主内容区顶部为“搜索筛选区”，中部为“数据表格”，底部为“分页控件”。 - 文章创建页/编辑页：主内容区为完整的“信息录入表单”，表单项采用栅格系统对齐，顶部提供“返回”和“保存”按钮。 - 文章详情页：主内容区为“只读信息面板”，以键值对形式清晰展示数据，顶部提供“返回”按钮。 ## 六、核心模块 ### 6.1 文章列表页 - 搜索与操作模块 该模块为用户提供数据筛选和批量操作的能力，是列表页的核心交互区域。核心功能包括：1. 支持按“标题”进行关键词搜索；2. 提供“查询”和“重置”按钮来执行或清除筛选条件；3. 提供“新增”入口，用于跳转到创建页面；4. 支持勾选数据后进行批量“删除”操作。主要组件包括输入框、查询按钮、重置按钮和新增/删除按钮。 - 数据表格模块 此模块用于结构化地展示数据集合，并提供针对单条数据的操作。核心功能包括：1. 以表格形式清晰展示序号、标题、作者、创建时间等关键字段；2. 支持通过复选框选择多行数据；3. 为每行数据提供独立的“编辑”、“详情”和“删除”操作入口；4. 在表格底部集成“分页”功能，支持用户浏览所有数据。关键组件为数据表格、复选框、操作按钮组和分页器。 ### 6.2 文章创建页/编辑页 - 信息录入表单模块 作为数据创建和编辑的核心载体，该模块提供了一套完整的字段录入界面。核心功能包括：1. 支持输入文本类型的“标题”；2. 支持通过下拉选择或输入方式确定“作者”和“重要性”；3. 提供日期时间选择器用于设置“创建时间”；4. 集成富文本编辑器，用于编辑包含格式和图片的“内容”字段。主要组件包括输入框、下拉选择器、日期时间选择器、数字输入框和富文本编辑器。 ### 6.3 文章详情页 - 只读信息展示模块 该模块用于清晰、完整地展示单条数据的全部信息，供用户查阅。核心功能包括：1. 以“字段-值”的对应形式，结构化展示标题、作者、创建时间等所有信息；2. 对特定字段（如“重要性”）使用标签等组件进行视觉突出；3. 能够正确渲染并展示富文本编辑器生成的复杂“内容”，包括图片和文本格式。主要组件为描述列表、标签和内容渲染容器。 ## 七、内容数据 - 核心数据类型：文章 - 关键数据字段：ID、标题、作者、创建时间、重要性等级、阅读数、内容（富文本）。 ## 八、交互特征 - 通用交互：支持标准的页面间导航跳转和表单提交反馈（成功提示/错误校验）。 - 核心交互：围绕文章的增删改查（CRUD）流程设计，用户可通过列表页的按钮触发创建、编辑、详情、删除等一系列操作，流程闭环，体验顺畅。 - 特定交互：列表页支持关键词搜索和分页浏览；创建/编辑页支持富文本编辑和日期选择等复杂表单交互。 ## 九、非功能性需求 - 响应性：页面布局需能适应主流桌面显示器分辨率，保证良好的可访问性。 - 性能：列表数据加载、搜索和分页操作应有快速响应，避免用户长时间等待。 - 易用性：交互流程应符合用户直觉，错误提示清晰明确，降低用户学习成本。其他要求：仅允许添加依赖项，禁止修改package.json中的scripts等非依赖字段。内容输出文件放在 ./src/pages/index.tsx。

## 技术栈

- **前端框架**: Next.js 16 (Pages Router)
- **UI 库**: React 19
- **组件库**: Ant Design 6
- **富文本编辑器**: React-Quill
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite + Prisma 5
- **认证**: JWT (jsonwebtoken + bcryptjs)
- **数据验证**: Zod
- **包管理器**: pnpm
- **容器化**: Docker + Docker Compose

## 功能特性

### 核心功能

- ✅ 统一的后台布局（左侧菜单 + 顶部导航 + 主内容区）
- ✅ 文章列表展示（表格、分页）
- ✅ 文章搜索（按标题关键词）
- ✅ 文章创建（富文本编辑）
- ✅ 文章编辑（数据预填充）
- ✅ 文章详情查看（只读展示）
- ✅ 文章删除（单条删除、批量删除）
- ✅ 图片上传（富文本编辑器内）
- ✅ 数据持久化（SQLite 数据库）

### 认证系统

- ✅ JWT 用户认证
- ✅ 登录/登出功能
- ✅ 路由保护（未登录自动跳转）
- ✅ API 认证中间件
- ✅ 密码加密（bcrypt）
- ✅ Token 自动刷新
- ✅ 防暴力破解（5次失败锁定15分钟）

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 一键部署
./docker-init.sh
```

访问 [http://localhost:3000](http://localhost:3000)

**初始账号**: admin / admin123

### 方式二：本地开发

#### 1. 安装依赖

```bash
pnpm install
```

#### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置 JWT_SECRET
```

#### 3. 初始化数据库

```bash
# 运行数据库迁移
npx prisma migrate dev

# 创建初始管理员账号
npx tsx scripts/migrate-auth.ts
```

#### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

#### 5. 构建生产版本

```bash
pnpm build
pnpm start
```

## 代码架构

### 整体架构

本项目采用经典的三层架构设计：

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  (Pages + Components + UI Logic)                        │
├─────────────────────────────────────────────────────────┤
│                    Business Layer                        │
│  (API Routes + Validation + Authentication)             │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
│  (Prisma ORM + SQLite Database)                         │
└─────────────────────────────────────────────────────────┘
```

### 技术架构图

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  React 19 Components (TypeScript)                  │     │
│  │  ├─ Pages (Next.js Pages Router)                   │     │
│  │  ├─ Layout Components (MainLayout, TopNav, Sidebar)│     │
│  │  ├─ Feature Components (ArticleForm, RichTextEditor)│    │
│  │  └─ Ant Design UI Components                       │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↕ HTTP/JSON                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  AuthContext (JWT Token Management)                │     │
│  │  fetchWithAuth (Auto Token Injection)              │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Server (Node.js)                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Routes (/api/*)                               │     │
│  │  ├─ Authentication Middleware (withAuth)           │     │
│  │  ├─ Request Validation (Zod Schemas)               │     │
│  │  ├─ Business Logic (CRUD Operations)               │     │
│  │  └─ Response Formatting (ApiResponse)              │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↕                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Data Access Layer (storage.ts)                    │     │
│  │  └─ Prisma Client (Type-safe ORM)                  │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│                    SQLite Database                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Tables: User, Article                             │     │
│  │  Indexes: username, title, createdAt, authorId     │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 认证流程

```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ Browser │         │  Server  │         │Database │
└────┬────┘         └────┬─────┘         └────┬────┘
     │                   │                     │
     │ POST /api/auth/login                   │
     │ {username, password}                   │
     ├──────────────────>│                     │
     │                   │ Query user          │
     │                   ├────────────────────>│
     │                   │<────────────────────┤
     │                   │ Verify password     │
     │                   │ (bcrypt.compare)    │
     │                   │                     │
     │                   │ Generate JWT        │
     │                   │ (jsonwebtoken.sign) │
     │                   │                     │
     │ {token, user}     │                     │
     │<──────────────────┤                     │
     │                   │                     │
     │ Store token in    │                     │
     │ localStorage      │                     │
     │                   │                     │
     │ GET /api/articles │                     │
     │ Authorization: Bearer <token>           │
     ├──────────────────>│                     │
     │                   │ Verify JWT          │
     │                   │ (jsonwebtoken.verify)│
     │                   │                     │
     │                   │ Extract userId      │
     │                   │                     │
     │                   │ Query articles      │
     │                   ├────────────────────>│
     │                   │<────────────────────┤
     │ {articles}        │                     │
     │<──────────────────┤                     │
     │                   │                     │
```

### 数据流

```
User Action → Component Event Handler → API Call (fetchWithAuth)
                                              ↓
                                    Add Authorization Header
                                              ↓
                                    Next.js API Route
                                              ↓
                                    Authentication Middleware
                                              ↓
                                    Request Validation (Zod)
                                              ↓
                                    Business Logic
                                              ↓
                                    Data Access Layer (storage.ts)
                                              ↓
                                    Prisma Client
                                              ↓
                                    SQLite Database
                                              ↓
                                    Response ← ← ← ← ← ← ← ←
                                              ↓
                                    Component State Update
                                              ↓
                                    UI Re-render
```

## 项目结构

```
article-management-system/
├── src/
│   ├── pages/                    # Next.js Pages Router
│   │   ├── index.tsx             # 文章列表页（主页面）
│   │   ├── login.tsx             # 登录页
│   │   ├── articles/             # 文章模块
│   │   │   ├── create.tsx        # 创建页
│   │   │   └── [id]/             # 动态路由
│   │   │       ├── index.tsx     # 详情页
│   │   │       └── edit.tsx      # 编辑页
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             # 认证 API
│   │   │   │   ├── login.ts      # 登录
│   │   │   │   ├── logout.ts     # 登出
│   │   │   │   └── me.ts         # 获取当前用户
│   │   │   ├── articles/         # 文章 API
│   │   │   │   ├── index.ts      # 列表、创建、批量删除
│   │   │   │   └── [id].ts       # 详情、更新、删除
│   │   │   └── upload.ts         # 图片上传 API
│   │   ├── _app.tsx              # 应用入口（AuthProvider + ProtectedRoute）
│   │   └── _document.tsx         # 文档结构
│   ├── components/               # React 组件
│   │   ├── auth/                 # 认证组件
│   │   │   └── ProtectedRoute.tsx # 路由保护
│   │   ├── layout/               # 布局组件
│   │   │   ├── MainLayout.tsx    # 主布局
│   │   │   ├── TopNav.tsx        # 顶部导航（用户信息 + 登出）
│   │   │   └── Sidebar.tsx       # 左侧菜单
│   │   ├── articles/             # 文章相关组件
│   │   │   └── ArticleForm.tsx   # 文章表单
│   │   └── common/               # 通用组件
│   │       └── RichTextEditor.tsx # 富文本编辑器（Quill）
│   ├── contexts/                 # React Context
│   │   └── AuthContext.tsx       # 认证上下文（全局状态管理）
│   ├── lib/                      # 工具库
│   │   ├── auth.ts               # 认证工具（JWT + bcrypt）
│   │   ├── middleware.ts         # 认证中间件（withAuth HOF）
│   │   ├── api.ts                # API 请求工具（fetchWithAuth）
│   │   ├── prisma.ts             # Prisma 客户端单例
│   │   ├── storage.ts            # 数据存储层（Prisma 操作封装）
│   │   ├── validation.ts         # 数据验证（Zod Schema）
│   │   ├── constants.ts          # 常量配置
│   │   └── utils.ts              # 通用工具函数
│   ├── types/                    # TypeScript 类型定义
│   │   └── article.ts            # 文章类型 + API 响应类型
│   └── styles/                   # 样式文件
│       └── globals.css           # 全局样式（Tailwind + 自定义）
├── prisma/                       # Prisma 配置
│   ├── schema.prisma             # 数据模型（User + Article）
│   ├── dev.db                    # SQLite 数据库文件
│   └── migrations/               # 数据库迁移历史
│       ├── 20260202124006_init/  # 初始迁移
│       └── migration_lock.toml   # 迁移锁文件
├── scripts/                      # 脚本工具
│   ├── migrate.ts                # 数据迁移脚本
│   └── migrate-auth.ts           # 认证数据迁移（创建管理员）
├── public/                       # 静态资源
│   └── uploads/                  # 上传的图片存储目录
├── e2e/                          # E2E 测试
│   ├── article-crud.spec.ts      # 文章 CRUD 测试
│   ├── article-management.spec.ts # 文章管理测试
│   └── helpers.ts                # 测试辅助函数
├── src/__tests__/                # 单元测试 + 集成测试
│   ├── pages/api/                # API 测试
│   └── lib/                      # 工具库测试
├── .github/workflows/            # GitHub Actions CI/CD
│   ├── test.yml                  # 测试工作流
│   └── quick-check.yml           # 快速检查工作流
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 镜像构建
├── docker-init.sh                # Docker 一键部署脚本
├── package.json                  # 依赖配置
├── tsconfig.json                 # TypeScript 配置
├── next.config.ts                # Next.js 配置
├── vitest.config.ts              # Vitest 测试配置
├── playwright.config.ts          # Playwright E2E 配置
└── README.md                     # 项目文档
```

## 技术细节

### 1. 认证系统实现

#### JWT Token 生成与验证

```typescript
// src/lib/auth.ts
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// 生成 JWT Token（7天有效期）
export function generateToken(userId: string): string {
	return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

// 验证 JWT Token
export function verifyToken(token: string): { userId: string } | null {
	try {
		return jwt.verify(token, JWT_SECRET) as { userId: string }
	} catch {
		return null
	}
}

// 密码加密（bcrypt 10轮）
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10)
}

// 密码验证
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash)
}
```

#### 认证中间件

```typescript
// src/lib/middleware.ts
export function withAuth(handler: AuthenticatedHandler) {
	return async (req: NextApiRequest, res: NextApiResponse) => {
		// 1. 提取 Authorization header
		const token = req.headers.authorization?.replace('Bearer ', '')

		// 2. 验证 token
		const payload = verifyToken(token)
		if (!payload) {
			return res.status(401).json({ success: false, error: '未授权' })
		}

		// 3. 附加用户信息到 req
		;(req as AuthenticatedRequest).user = { userId: payload.userId }

		// 4. 调用原始 handler
		return handler(req as AuthenticatedRequest, res)
	}
}
```

#### 客户端认证管理

```typescript
// src/contexts/AuthContext.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 登录
  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json();

    if (result.success) {
      setToken(result.data.token);
      setUser(result.data.user);
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }
  };

  // 登出
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 2. 数据库设计

#### Prisma Schema

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String   // bcrypt 加密
  name      String   // 显示名称
  role      String   @default("admin")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  articles  Article[]

  @@index([username])
}

model Article {
  id         String   @id @default(uuid())
  title      String
  authorId   String   // 外键关联 User
  author     User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  importance String   // 'low' | 'medium' | 'high'
  views      Int      @default(0)
  content    String   // 富文本 HTML
  updatedAt  DateTime @updatedAt

  @@index([title])
  @@index([createdAt])
  @@index([authorId])
}
```

#### 数据访问层

```typescript
// src/lib/storage.ts
import { prisma } from './prisma'

// 获取文章列表（分页 + 搜索）
export async function getArticles(params: { page: number; pageSize: number; keyword?: string }) {
	const where = params.keyword ? { title: { contains: params.keyword } } : {}

	const [data, total] = await Promise.all([
		prisma.article.findMany({
			where,
			skip: (params.page - 1) * params.pageSize,
			take: params.pageSize,
			orderBy: { createdAt: 'desc' },
			include: { author: { select: { id: true, name: true, username: true } } },
		}),
		prisma.article.count({ where }),
	])

	return { data, total }
}

// 创建文章
export async function createArticle(data: CreateArticleInput) {
	return prisma.article.create({
		data: {
			title: data.title,
			authorId: data.authorId,
			importance: data.importance,
			content: data.content,
		},
	})
}
```

### 3. 数据验证

```typescript
// src/lib/validation.ts
import { z } from 'zod'

// 文章验证 Schema
export const ArticleSchema = z.object({
	title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200字符'),
	authorId: z.string().uuid('无效的作者ID'),
	importance: z.enum(['low', 'medium', 'high'], {
		errorMap: () => ({ message: '重要性必须是 low、medium 或 high' }),
	}),
	content: z.string().min(1, '内容不能为空'),
})

// 登录验证 Schema
export const LoginSchema = z.object({
	username: z.string().min(3, '用户名至少3个字符').max(50, '用户名不能超过50字符'),
	password: z.string().min(6, '密码至少6个字符').max(100, '密码不能超过100字符'),
})
```

### 4. API 响应格式

```typescript
// 统一响应格式
interface ApiResponse<T = any> {
	success: boolean
	data?: T
	error?: string
}

// 成功响应
res.status(200).json({
	success: true,
	data: { articles, total },
})

// 错误响应
res.status(400).json({
	success: false,
	error: '参数验证失败',
})
```

### 5. 富文本编辑器

```typescript
// src/components/common/RichTextEditor.tsx
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// 动态导入（禁用 SSR）
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

// 自定义图片上传
const imageHandler = useCallback(function (this: any) {
	const editor = this.quill
	const input = document.createElement('input')
	input.setAttribute('type', 'file')
	input.setAttribute('accept', 'image/*')

	input.onchange = async () => {
		const file = input.files?.[0]
		const formData = new FormData()
		formData.append('file', file)

		// 使用认证请求上传
		const response = await fetchWithAuth('/api/upload', {
			method: 'POST',
			body: formData,
		})

		const result = await response.json()
		if (result.success) {
			const range = editor.getSelection()
			editor.insertEmbed(range?.index ?? 0, 'image', result.data.url)
		}
	}

	input.click()
}, [])

// Quill 配置
const modules = {
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
		handlers: { image: imageHandler },
	},
}
```

### 6. 路由保护

```typescript
// src/components/auth/ProtectedRoute.tsx
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return <Spin />;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}

// src/pages/_app.tsx
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPublicPage = router.pathname === '/login';

  return (
    <AuthProvider>
      {isPublicPage ? (
        <Component {...pageProps} />
      ) : (
        <ProtectedRoute>
          <Component {...pageProps} />
        </ProtectedRoute>
      )}
    </AuthProvider>
  );
}
```

### 7. 性能优化

- **代码分割**: 使用 `dynamic()` 动态导入 Quill 编辑器，减少首屏加载
- **数据库索引**: 在 `username`、`title`、`createdAt`、`authorId` 字段上建立索引
- **分页查询**: 使用 `skip` 和 `take` 实现高效分页
- **并发查询**: 使用 `Promise.all` 并行执行数据查询和计数
- **Prisma 连接池**: 使用单例模式管理 Prisma Client，避免连接泄漏

### 8. 安全措施

- **密码加密**: 使用 bcrypt 加密存储（10轮）
- **JWT 签名**: 使用强密钥签名 token（至少32字符）
- **防暴力破解**: 5次失败锁定15分钟（内存计数器）
- **XSS 防护**: React 自动转义 + DOMPurify 清理富文本
- **CSRF 防护**: JWT 存储在 localStorage，使用 Authorization header
- **SQL 注入防护**: Prisma ORM 参数化查询
- **文件上传限制**: 仅允许图片格式，限制文件大小

## API 端点

### 文章 API

| 方法   | 端点                                           | 描述                           |
| ------ | ---------------------------------------------- | ------------------------------ |
| GET    | `/api/articles?page=1&pageSize=10&keyword=xxx` | 获取文章列表（支持分页和搜索） |
| GET    | `/api/articles/:id`                            | 获取单篇文章详情               |
| POST   | `/api/articles`                                | 创建新文章                     |
| PUT    | `/api/articles/:id`                            | 更新文章                       |
| DELETE | `/api/articles/:id`                            | 删除单篇文章                   |
| DELETE | `/api/articles`                                | 批量删除文章                   |

### 上传 API

| 方法 | 端点          | 描述     |
| ---- | ------------- | -------- |
| POST | `/api/upload` | 上传图片 |

## 数据模型

```typescript
interface Article {
	id: string // 唯一标识符（UUID）
	title: string // 标题
	author: string // 作者
	createdAt: string // 创建时间（ISO 8601 格式）
	importance: 'low' | 'medium' | 'high' // 重要性等级
	views: number // 阅读数
	content: string // 富文本内容（HTML）
}
```

## 测试

本项目拥有全面的测试覆盖，包括单元测试、集成测试和 E2E 测试。

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test -- --coverage

# 运行测试并查看 UI
pnpm test -- --ui

# 监听模式（开发时使用）
pnpm test -- --watch

# 运行特定测试文件
pnpm test src/lib/__tests__/validation.test.ts
```

### 测试覆盖情况

| 测试类型     | 测试数量 | 状态            |
| ------------ | -------- | --------------- |
| 单元测试     | 65       | ✅ 全部通过     |
| API 集成测试 | 45       | ✅ 全部通过     |
| 组件测试     | 11       | ✅ 全部通过     |
| E2E 测试     | 9        | ✅ 全部通过     |
| **总计**     | **130**  | **✅ 全部通过** |

## 开发指南

### 添加新功能

1. 在 `src/types/` 中定义类型
2. 在 `src/lib/` 中实现业务逻辑
3. 在 `src/pages/api/` 中创建 API 端点
4. 在 `src/components/` 中创建 UI 组件
5. 在 `src/pages/` 中创建页面
6. 为新功能编写测试

### 数据存储

当前使用 SQLite + Prisma（由 `.env` 中 `DATABASE_URL` 指定数据库文件路径）。

`data/articles.json` 用于初始化/迁移示例数据，可通过 `scripts/migrate.ts` 导入到数据库。

### 代码规范

- 使用 TypeScript 进行类型检查
- 使用 ESLint 进行代码检查
- 组件使用 PascalCase 命名
- 文件使用 kebab-case 命名
- 函数使用 camelCase 命名
- 为所有新功能编写测试

## 常见问题

### 1. 端口被占用

如果 3000 端口被占用，可以指定其他端口：

```bash
PORT=3001 pnpm dev
```

### 2. 图片上传失败

确保 `public/uploads/` 目录有写入权限。

### 3. 数据丢失

数据存储在 SQLite 数据库文件中（默认 `prisma/dev.db`，以 `.env` 中 `DATABASE_URL` 为准），请定期备份该文件。

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置构建命令：`pnpm build`
4. 配置输出目录：`.next`
5. 点击部署

注意：Vercel 的 Serverless 环境不支持持久化文件写入（SQLite 数据库文件、上传目录等），生产环境建议使用托管数据库 + 对象存储。

### Docker 部署

```bash
# 构建镜像
docker build -t article-management-system .

# 运行容器
docker run -p 3000:3000 article-management-system
```
