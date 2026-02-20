#!/bin/bash

# 腾讯云 CloudBase 部署脚本

set -e

echo "🚀 开始部署到腾讯云 CloudBase..."

# 检查是否已安装 CloudBase CLI
if ! command -v cloudbase &> /dev/null; then
    echo "❌ 未安装 CloudBase CLI"
    echo ""
    echo "请先安装 CloudBase CLI："
    echo "  npm install -g @cloudbase/cli"
    echo ""
    exit 1
fi

echo "✓ CloudBase CLI 已安装"

# 检查是否已登录
echo ""
echo "📝 检查登录状态..."
if ! cloudbase env:list &> /dev/null; then
    echo "❌ 未登录 CloudBase"
    echo ""
    echo "请先登录："
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

# 获取环境列表
echo ""
echo "🔍 获取 CloudBase 环境列表..."
cloudbase env:list

# 提示用户选择环境
echo ""
read -p "请输入环境 ID (env-id): " ENV_ID

if [ -z "$ENV_ID" ]; then
    echo "❌ 环境 ID 不能为空"
    exit 1
fi

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
echo ""
echo "🔄 更新部署："
echo "  npm run build && cloudbase hosting:deploy ./dist -e $ENV_ID"
