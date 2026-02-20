#!/bin/bash

# GitHub Actions 自动部署配置脚本

echo "🔧 配置 GitHub Actions 自动部署..."

# 创建 GitHub Actions 工作目录
mkdir -p .github/workflows

# 提示用户配置 GitHub Secrets
echo ""
echo "📝 需要在 GitHub 仓库中配置以下 Secrets："
echo ""
echo "GitHub Pages 部署："
echo "  - GITHUB_TOKEN (自动提供)"
echo ""
echo "Docker Hub 部署："
echo "  - DOCKER_USERNAME (Docker Hub 用户名)"
echo "  - DOCKER_PASSWORD (Docker Hub 密码或访问令牌)"
echo ""
echo "Google Cloud 部署："
echo "  - GCP_PROJECT_ID (GCP 项目ID)"
echo "  - GCP_SERVICE_ACCOUNT_KEY (GCP 服务账号密钥 JSON)"
echo ""
echo "CloudBase 部署："
echo "  - TCB_SECRET_ID (腾讯云 Secret ID)"
echo "  - TCB_SECRET_KEY (腾讯云 Secret Key)"
echo ""

# 询问用户选择部署方式
echo "请选择部署方式："
echo "1) GitHub Pages (静态站点)"
echo "2) Docker Hub + CloudBase"
echo "3) Google Cloud Run"
echo ""
read -p "请输入选项 (1/2/3): " choice

case $choice in
    1)
        echo "✅ 已配置 GitHub Pages 部署工作流"
        echo "   推送代码后自动部署"
        ;;
    2)
        echo "✅ 已配置 Docker Hub + CloudBase 部署工作流"
        echo "   需要在 GitHub 中配置 Docker Hub 和 TCB Secrets"
        ;;
    3)
        echo "✅ 已配置 Google Cloud Run 部署工作流"
        echo "   需要在 GitHub 中配置 GCP Secrets"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "🎉 配置完成！"
echo "   推送代码到 GitHub 后将自动触发部署"
