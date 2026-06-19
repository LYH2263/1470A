#!/bin/bash

# Docker 配置验证脚本

echo "=== Docker 配置验证 ==="
echo ""

# 检查 Docker 文件
echo "1. 检查 Docker 配置文件..."
files=(
  "Dockerfile"
  ".dockerignore"
  "docker-compose.yml"
  "docker-compose.dev.yml"
  "nginx/nginx.conf"
  "docker-init.sh"
  ".env.example"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (缺失)"
  fi
done

# 检查 Next.js 配置
echo ""
echo "2. 检查 Next.js 配置..."
if grep -q "output: 'standalone'" next.config.ts; then
  echo "  ✅ Standalone 模式已启用"
else
  echo "  ❌ Standalone 模式未启用"
fi

# 检查 Docker 是否安装
echo ""
echo "3. 检查 Docker 环境..."
if command -v docker &> /dev/null; then
  echo "  ✅ Docker 已安装: $(docker --version)"
else
  echo "  ❌ Docker 未安装"
fi

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
  if command -v docker-compose &> /dev/null; then
    echo "  ✅ Docker Compose 已安装: $(docker-compose --version)"
  else
    echo "  ✅ Docker Compose 已安装: $(docker compose version)"
  fi
else
  echo "  ❌ Docker Compose 未安装"
fi

# 检查文档
echo ""
echo "4. 检查文档..."
docs=(
  "DOCKER_DEPLOYMENT.md"
  "DOCKER_CONFIGURATION_REPORT.md"
)

for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    echo "  ✅ $doc"
  else
    echo "  ❌ $doc (缺失)"
  fi
done

echo ""
echo "=== 验证完成 ==="
echo ""
echo "下一步："
echo "  1. 运行 ./docker-init.sh 进行一键部署"
echo "  2. 或查看 DOCKER_DEPLOYMENT.md 了解详细部署步骤"
