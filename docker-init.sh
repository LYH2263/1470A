#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 文章管理系统 Docker 初始化脚本 ===${NC}\n"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# 创建必要的目录
echo -e "${YELLOW}创建数据目录...${NC}"
mkdir -p data/prisma
mkdir -p data/uploads
mkdir -p nginx/ssl

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}创建 .env 文件...${NC}"
    cat > .env << EOF
# 数据库配置
DATABASE_URL="file:/app/prisma/production.db"

# JWT 密钥（生产环境请修改为强随机密钥）
JWT_SECRET="$(openssl rand -base64 32)"

# Node 环境
NODE_ENV=production
EOF
    echo -e "${GREEN}.env 文件已创建${NC}"
else
    echo -e "${GREEN}.env 文件已存在${NC}"
fi

# 构建镜像
echo -e "\n${YELLOW}构建 Docker 镜像...${NC}"
docker-compose build

if [ $? -ne 0 ]; then
    echo -e "${RED}镜像构建失败${NC}"
    exit 1
fi

echo -e "${GREEN}镜像构建成功${NC}"

# 启动容器
echo -e "\n${YELLOW}启动容器...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}容器启动失败${NC}"
    exit 1
fi

echo -e "${GREEN}容器启动成功${NC}"

# 等待应用启动
echo -e "\n${YELLOW}等待应用启动...${NC}"
sleep 5

# 运行数据库迁移
echo -e "\n${YELLOW}运行数据库迁移...${NC}"
docker-compose exec app npx prisma migrate deploy

# 创建初始管理员账号
echo -e "\n${YELLOW}创建初始管理员账号...${NC}"
docker-compose exec app npx tsx scripts/migrate-auth.ts

# 检查应用状态
echo -e "\n${YELLOW}检查应用状态...${NC}"
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}应用运行正常！${NC}"
    echo -e "\n${GREEN}=== 部署完成 ===${NC}"
    echo -e "访问地址: ${GREEN}http://localhost:3000${NC}"
    echo -e "初始账号: ${GREEN}admin / admin123${NC}"
    echo -e "\n查看日志: ${YELLOW}docker-compose logs -f${NC}"
    echo -e "停止服务: ${YELLOW}docker-compose down${NC}"
else
    echo -e "${RED}应用启动失败，请查看日志${NC}"
    echo -e "查看日志: ${YELLOW}docker-compose logs${NC}"
    exit 1
fi
