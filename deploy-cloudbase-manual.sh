#!/bin/bash

# 腾讯云 CloudBase 部署脚本 - 控制台上传方式

set -e

ENV_ID="ai-rh202602-4g44noj4b1870204"
PROJECT_DIR="/Users/zhang/CodeBuddy/20260219235529"

echo "🚀 腾讯云 CloudBase 部署指南"
echo "环境 ID: $ENV_ID"
echo ""

# 构建项目
echo "🔨 构建项目..."
cd "$PROJECT_DIR"
npm run build

echo ""
echo "✅ 构建完成！"
echo ""
echo "📦 构建产物位置："
echo "   $PROJECT_DIR/dist"
echo ""
echo "📝 下一步操作："
echo ""
echo "1. 打开 CloudBase 控制台："
echo "   https://console.cloud.tencent.com/tcb"
echo ""
echo "2. 选择环境：ai-rh202602"
echo ""
echo "3. 进入「HTTP 访问服务」→「文件管理」"
echo ""
echo "4. 上传以下文件/文件夹："
echo "   - dist/index.html"
echo "   - dist/assets/ (整个文件夹)"
echo ""
echo "5. 访问地址："
echo "   https://$ENV_ID.service.tcloudbase.com"
echo ""
echo "💡 提示："
echo "   - 可以将 dist 文件夹打包为 zip 后上传"
echo "   - 或使用「文件夹上传」功能直接上传 dist 文件夹"
