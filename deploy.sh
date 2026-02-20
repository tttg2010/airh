#!/bin/bash

# 文生视频应用自动部署脚本
# 适用于 Docker 容器部署

set -e

echo "🚀 开始部署文生视频应用..."

# 构建Docker镜像
echo "📦 构建Docker镜像..."
docker build -t text-to-video:latest .

# 停止并删除旧容器（如果存在）
echo "🛑 停止旧容器..."
if [ "$(docker ps -q -f name=text-to-video)" ]; then
    docker stop text-to-video
    docker rm text-to-video
fi

# 运行新容器
echo "🚀 启动新容器..."
docker run -d \
    --name text-to-video \
    -p 3000:3000 \
    --restart unless-stopped \
    text-to-video:latest

echo "✅ 部署完成！"
echo "📱 应用已运行在 http://localhost:3000"
echo ""
echo "查看日志："
echo "  docker logs text-to-video"
echo ""
echo "停止应用："
echo "  docker stop text-to-video"
