#!/bin/bash

# Google Cloud Platform 自动部署脚本

set -e

# 配置变量
PROJECT_ID="${1:-your-project-id}"
ZONE="us-central1-a"
INSTANCE_NAME="text-to-video-app"

echo "🌟 Google Cloud Platform 部署脚本"
echo ""

# 检查是否已安装 gcloud
if ! command -v gcloud &> /dev/null; then
    echo "❌ 未安装 Google Cloud SDK"
    echo "请访问 https://cloud.google.com/sdk/docs/install 安装"
    exit 1
fi

# 配置项目
echo "⚙️ 配置项目: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# 构建Docker镜像
echo "📦 构建Docker镜像..."
docker build -t gcr.io/$PROJECT_ID/text-to-video:latest .

# 推送到 Google Container Registry
echo "📤 推送镜像到 Google Container Registry..."
gcloud auth configure-docker
docker push gcr.io/$PROJECT_ID/text-to-video:latest

# 检查实例是否存在
echo "🔍 检查实例..."
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &> /dev/null; then
    echo "🔄 更新现有实例..."
    gcloud compute instances update-container $INSTANCE_NAME \
        --container-image=gcr.io/$PROJECT_ID/text-to-video:latest \
        --zone=$ZONE
else
    echo "🆕 创建新实例..."
    gcloud compute instances create-with-container $INSTANCE_NAME \
        --zone=$ZONE \
        --machine-type=e2-medium \
        --container-image=gcr.io/$PROJECT_ID/text-to-video:latest \
        --container-ports=3000 \
        --tags=http-server \
        --boot-disk-size=10GB \
        --boot-disk-type=pd-balanced
fi

# 创建防火墙规则（如果不存在）
echo "🔥 配置防火墙规则..."
if ! gcloud compute firewall-rules describe allow-http --format="value(name)" &> /dev/null; then
    gcloud compute firewall-rules create allow-http \
        --allow tcp:80 \
        --source-ranges 0.0.0.0/0 \
        --description "Allow HTTP traffic"
fi

# 获取外部IP
echo "⏳ 等待实例启动..."
sleep 10

EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
    --zone=$ZONE \
    --format="get(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo "✅ 部署完成！"
echo "📱 应用已部署到: http://$EXTERNAL_IP:3000"
echo ""
echo "查看实例状态："
echo "  gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "查看日志："
echo "  gcloud compute instances get-serial-port-output $INSTANCE_NAME --zone=$ZONE --port=1"
echo ""
echo "SSH连接："
echo "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
