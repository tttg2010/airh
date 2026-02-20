#!/bin/bash

# 腾讯云 CloudBase 自动部署脚本（使用指定环境）

set -e

ENV_ID="ai-rh202602-4g44noj4b1870204"

echo "🚀 开始部署到腾讯云 CloudBase..."
echo "环境 ID: $ENV_ID"
echo ""

# 检查是否已安装 CloudBase CLI
if ! command -v cloudbase &> /dev/null; then
    echo "❌ 未安装 CloudBase CLI"
    echo ""
    echo "正在安装 CloudBase CLI..."
    npm install -g @cloudbase/cli
    echo "✓ CloudBase CLI 安装完成"
fi

echo "✓ CloudBase CLI 已安装"

# 检查是否已登录
echo ""
echo "📝 检查登录状态..."
if ! cloudbase env:list &> /dev/null; then
    echo "❌ 未登录 CloudBase"
    echo ""
    echo "请运行以下命令登录："
    echo "  cloudbase login"
    echo ""
    exit 1
fi

echo "✓ 已登录 CloudBase"

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
