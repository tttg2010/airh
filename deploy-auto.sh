#!/bin/bash

# 腾讯云 CloudBase 自动部署脚本（带自动记录）
# 每次部署时自动记录部署信息并提交到git

set -e

# 配置
ENV_ID="ai-rh202602-4g44noj4b1870204"
DEPLOY_LOG_FILE="DEPLOYMENT_LOG.md"
GIT_COMMIT_MSG="feat: 自动部署 $(date '+%Y-%m-%d %H:%M:%S')"

echo "🚀 开始自动部署到腾讯云 CloudBase..."
echo ""

# 1. 从 src/main.jsx 提取版本号
echo "📝 提取版本信息..."
if [ -f "src/main.jsx" ]; then
    VERSION=$(grep "APP_VERSION" src/main.jsx | head -1 | sed "s/.*'\(v[0-9.]*\)'.*/\1/")
else
    VERSION="未知版本"
    echo "⚠️  无法找到 src/main.jsx，使用默认版本号"
fi

echo "版本: $VERSION"
echo ""

# 2. 记录部署信息到日志文件
echo "📊 记录部署日志..."
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DEPLOYMENT_URL="https://$ENV_ID-1259354505.tcloudbaseapp.com"
RANDOM_PARAM="?_refresh=$(date +%s)"

LOG_ENTRY="---
## 部署记录 - $TIMESTAMP

- **版本**: $VERSION
- **环境ID**: $ENV_ID
- **部署时间**: $TIMESTAMP
- **访问地址**: [$DEPLOYMENT_URL]($DEPLOYMENT_URL)
- **带随机参数**: [$DEPLOYMENT_URL$RANDOM_PARAM]($DEPLOYMENT_URL$RANDOM_PARAM)

**部署内容**:
- 前端应用构建
- 静态资源部署
- 自动化部署日志记录

"

# 如果日志文件不存在，创建它并添加标题
if [ ! -f "$DEPLOY_LOG_FILE" ]; then
    cat > "$DEPLOY_LOG_FILE" << 'EOF'
# 部署日志

本文件记录每次部署的详细信息。

EOF
fi

# 追加新的部署记录
echo "$LOG_ENTRY" >> "$DEPLOY_LOG_FILE"

echo "✓ 部署日志已更新"
echo ""

# 3. 检查是否已安装 CloudBase CLI
echo "🔍 检查 CloudBase CLI..."
if ! command -v cloudbase &> /dev/null; then
    echo "❌ 未安装 CloudBase CLI"
    echo ""
    echo "请先安装 CloudBase CLI："
    echo "  npm install -g @cloudbase/cli"
    echo ""
    exit 1
fi

echo "✓ CloudBase CLI 已安装"
echo ""

# 4. 检查是否已登录
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
echo ""

# 5. 构建项目
echo "🔨 构建项目..."
npm install
npm run build

echo "✓ 项目构建完成"
echo ""

# 6. 部署到 CloudBase
echo "☁️ 部署到 CloudBase..."
echo "环境 ID: $ENV_ID"
echo ""

cloudbase hosting:deploy ./dist -e "$ENV_ID"

echo ""
echo "✅ 部署完成！"
echo ""

# 7. 提交部署日志到 git
echo "📝 提交部署日志到 git..."
git add "$DEPLOY_LOG_FILE"
git commit -m "$GIT_COMMIT_MSG" || echo "⚠️  没有新的更改需要提交"

echo "✓ Git提交完成（如需要）"
echo ""

# 8. 显示部署信息
echo "📱 访问地址："
echo "  $DEPLOYMENT_URL"
echo "  $DEPLOYMENT_URL$RANDOM_PARAM"
echo ""
echo "📊 部署日志："
echo "  $DEPLOY_LOG_FILE"
echo ""
echo "🔄 更新部署："
echo "  ./deploy-auto.sh"
echo ""
echo "📊 管理控制台："
echo "  https://console.cloud.tencent.com/tcb"
echo ""
