#!/bin/bash

# 腾讯云 CloudBase 自动部署脚本（使用本地环境变量）

set -e

# 从环境变量读取配置
ENV_ID="${CLOUDBASE_ENV_ID:-ai-rh202602-4g44noj4b1870204}"
SECRET_ID="${TENCENT_SECRET_ID:-}"
SECRET_KEY="${TENCENT_SECRET_KEY:-}"

echo "🚀 开始部署到腾讯云 CloudBase..."
echo "环境 ID: $ENV_ID"
echo ""

# 检查是否设置了密钥
if [ -z "$SECRET_ID" ] || [ -z "$SECRET_KEY" ]; then
    echo "❌ 未设置访问密钥"
    echo ""
    echo "请设置环境变量："
    echo "  export TENCENT_SECRET_ID='您的SecretId'"
    echo "  export TENCENT_SECRET_KEY='您的SecretKey'"
    echo ""
    echo "或者在脚本开头直接设置密钥"
    exit 1
fi

# 检查是否已安装 CloudBase CLI
if ! command -v cloudbase &> /dev/null; then
    echo "📦 安装 CloudBase CLI..."
    npm install -g @cloudbase/cli
fi

echo "✓ CloudBase CLI 已安装"

# 登录 CloudBase
echo ""
echo "🔐 登录 CloudBase..."
cloudbase login --apiKey "$SECRET_ID" "$SECRET_KEY"
echo "✓ 登录成功"

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 构建项目
echo ""
echo "🔨 构建项目..."
npm install
npm run build

echo "✓ 项目构建完成"

# 部署到 CloudBase
echo ""
echo "☁️ 部署到 CloudBase..."
echo "环境 ID: $ENV_ID"
echo ""

cloudbase hosting:deploy ./dist -e "$ENV_ID"

echo ""
echo "✅ 部署完成！"
echo ""
echo "📱 访问地址："
echo "  https://$ENV_ID.service.tcloudbase.com"
echo ""
echo "📊 管理控制台："
echo "  https://console.cloud.tencent.com/tcb"
