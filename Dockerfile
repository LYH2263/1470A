# 多阶段构建 - 依赖安装阶段
FROM node:20-slim AS deps
WORKDIR /app

# 安装 OpenSSL 和其他必要的依赖
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 生成 Prisma Client
RUN pnpm prisma generate

# 构建阶段
FROM node:20-slim AS builder
WORKDIR /app

# 安装 OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建应用
RUN pnpm build

# 生产运行阶段
FROM node:20-slim AS runner
WORKDIR /app

# 安装 OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# 复制 Prisma 文件
COPY --from=builder /app/prisma ./prisma

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制数据迁移脚本
COPY --from=builder /app/scripts ./scripts

# 复制启动脚本
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# 安装 pnpm（用于运行脚本）
RUN corepack enable && corepack prepare pnpm@10 --activate

# 安装 Prisma CLI（用于运行迁移）- 使用与项目相同的版本
RUN npm install -g prisma@5.22.0

# 创建数据目录
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

# 设置 Prisma 目录权限
RUN chown -R nextjs:nodejs /app/prisma

# 设置启动脚本权限
RUN chmod +x /app/docker-entrypoint.sh

# 给 Prisma engines 目录写入权限
RUN chmod -R 777 /usr/local/lib/node_modules/prisma/node_modules/@prisma/engines || true

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用启动脚本
CMD ["/app/docker-entrypoint.sh"]
