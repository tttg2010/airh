# 腾讯云 CloudBase 自动部署指南

本文档介绍如何配置 GitHub Actions 自动部署到腾讯云 CloudBase。

## 📋 前置条件

1. 已有 GitHub 仓库并推送到 GitHub
2. 已创建 CloudBase 环境（环境 ID：`ai-rh202602-4g44noj4b1870204`）
3. 已开通 CloudBase 的 HTTP 访问服务和静态网站托管

---

## 🔧 步骤一：获取腾讯云访问密钥

### 1. 登录腾讯云控制台
访问：https://console.cloud.tencent.com/cam/capi

### 2. 创建访问密钥
1. 点击 **"新建密钥"** 或使用现有密钥
2. 记录以下两个值：
   - **SecretId**（类似：AKIDxxxxxxxxxxxxxxxx）
   - **SecretKey**（类似：xxxxxxxxxxxxxxxx）

---

## 🔧 步骤二：配置 GitHub Secrets

### 1. 进入 GitHub 仓库设置
1. 打开您的 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**

### 2. 添加 Secrets
点击 **"New repository secret"**，添加以下两个密钥：

| Name | Value | 说明 |
|------|-------|------|
| `TCB_SECRET_ID` | 您的 SecretId | 腾讯云访问密钥 ID |
| `TCB_SECRET_KEY` | 您的 SecretKey | 腾讯云访问密钥 Key |

⚠️ **重要**：确保 SecretKey 已保密，不要泄露！

---

## 🔧 步骤三：推送代码到 GitHub

### 1. 初始化 Git 仓库（如果还未初始化）
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. 连接到 GitHub 仓库
```bash
# 添加远程仓库（替换为您的仓库地址）
git remote add origin https://github.com/your-username/your-repo.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 🚀 步骤四：自动部署触发

部署会在以下情况自动触发：

1. **代码推送到 main 分支**：每次 push 后自动部署
2. **手动触发**：在 GitHub Actions 页面手动运行工作流

### 查看部署进度
1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 查看最新的部署工作流日志

---

## 📊 部署成功后访问

部署完成后，访问地址：
```
https://ai-rh202602-4g44noj4b1870204.service.tcloudbase.com
```

---

## 🔄 更新部署

只需推送代码到 main 分支即可自动部署：

```bash
git add .
git commit -m "Update app"
git push origin main
```

---

## ⚠️ 常见问题

### 1. 部署失败：未登录
**错误信息**：`❌ 未登录 CloudBase`

**解决方法**：检查 GitHub Secrets 中是否正确配置了 `TCB_SECRET_ID` 和 `TCB_SECRET_KEY`

### 2. 部署失败：环境 ID 错误
**错误信息**：`Invalid envId`

**解决方法**：检查 `.github/workflows/cloudbase.yml` 中的 `ENV_ID` 是否正确

### 3. 构建失败
**错误信息**：`npm ERR!`

**解决方法**：本地运行 `npm run build` 确保代码可以正常构建

---

## 📝 工作流文件说明

`.github/workflows/cloudbase.yml` 文件定义了自动部署流程：

- **触发条件**：推送到 main 分支或手动触发
- **构建环境**：Ubuntu + Node.js 20
- **构建步骤**：安装依赖 → 构建项目 → 登录 CloudBase → 部署

---

## 🔐 安全建议

1. **不要在代码中硬编码密钥**
2. **定期轮换访问密钥**
3. **限制密钥权限**：仅授予 CloudBase 相关权限
4. **监控部署日志**：定期检查 Actions 日志

---

## 📞 获取帮助

- GitHub Actions 文档：https://docs.github.com/actions
- CloudBase 文档：https://docs.cloudbase.net
- 腾讯云控制台：https://console.cloud.tencent.com/tcb
