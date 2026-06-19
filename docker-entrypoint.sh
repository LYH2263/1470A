#!/bin/sh
set -e

echo "Starting application..."

# 检查数据库文件是否存在
if [ ! -f "/app/data/production.db" ]; then
  echo "Database file not found, creating..."
  touch /app/data/production.db
fi

# 运行数据库迁移
echo "Running database migrations..."
cd /app
prisma migrate deploy || echo "Migration failed, continuing..."

# 启动应用
echo "Starting Next.js server..."
exec node server.js
