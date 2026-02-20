# 腾讯云 CloudBase 自动部署完整指南

本文档提供多种方式实现自动部署到腾讯云 CloudBase。

---

## 🔧 方式一：本地脚本自动部署（推荐用于快速测试）

### 1. 获取腾讯云访问密钥

访问：https://console.cloud.tencent.com/cam/capi

获取：
- **SecretId**（类似：AKIDxxxxxxxxxxxxxxxx）
- **SecretKey**（类似：xxxxxxxxxxxxxxxx）

### 2. 设置环境变量

```bash
export TENCENT_SECRET_ID='您的SecretId'
export TENCENT_SECRET_KEY='您的SecretKey'
```

### 3. 运行部署脚本

```bash
./deploy-cloudbase-env.sh
```

### 4. 持久化环境变量（可选）

在 `~/.zshrc` 或 `~/.bash_profile` 中添加：

```bash
export TENCENT_SECRET_ID='您的SecretId'
export TENCENT_SECRET_KEY='您的SecretKey'
export CLOUDBASE_ENV_ID='ai-rh202602-4g44noj4b1870204'
```

然后执行：
```bash
source ~/.zshrc  # 或 source ~/.bash_profile
```

---

## 🚀 方式二：GitHub Actions 自动部署（推荐用于生产环境）

### 1. 配置 GitHub Secrets

进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**

添加以下 Secrets：

| Name | Value |
|------|-------|
| `TCB_SECRET_ID` | 您的 SecretId |
| `TCB_SECRET_KEY` | 您的 SecretKey |

### 2. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<您的用户名>/<您的仓库名>.git
git push -u origin main
```

### 3. 自动触发部署

每次推送到 `main` 分支后，GitHub Actions 会自动：
- 构建项目
- 登录 CloudBase
- 部署到 CloudBase

### 4. 查看部署状态

访问：`https://github.com/<您的用户名>/<您的仓库名>/actions`

---

## 🔄 方式三：Git Hook 自动部署（本地推送后自动部署）

### 1. 创建 Git Hook 文件

```bash
# 创建 post-commit hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
echo "🚀 触发自动部署..."
./deploy-cloudbase-env.sh
EOF

chmod +x .git/hooks/post-commit
```

### 2. 创建 post-push hook

```bash
# 创建 post-push hook
cat > .git/hooks/post-push << 'EOF'
#!/bin/bash
echo "🚀 推送完成，开始部署..."
./deploy-cloudbase-env.sh
EOF

chmod +x .git/hooks/post-push
```

### 3. 手动触发 push hook

```bash
git push origin main && .git/hooks/post-push
```

---

## 🤖 方式四：使用 npm scripts 自动部署

### 1. 在 package.json 中添加脚本

```json
{
  "scripts": {
    "deploy": "npm run build && ./deploy-cloudbase-env.sh",
    "deploy:cloudbase": "./deploy-cloudbase-env.sh"
  }
}
```

### 2. 一键部署

```bash
npm run deploy
```

---

## ⚡ 方式五：使用 Watchman 监听文件变化自动部署

### 1. 安装 Watchman

```bash
# macOS
brew install watchman

# Linux
sudo apt-get install watchman
```

### 2. 创建监听脚本

```bash
cat > watch-and-deploy.sh << 'EOF'
#!/bin/bash

echo "👀 监听文件变化，自动部署..."

watchman watch-project $(pwd)

watchman -- trigger $(pwd) deploy 'src/**' '*.jsx' '*.css' '*.json' -- ./deploy-cloudbase-env.sh
EOF

chmod +x watch-and-deploy.sh
```

### 3. 启动监听

```bash
./watch-and-deploy.sh
```

---

## 📝 方式六：使用 CI/CD 工具自动部署

### GitLab CI/CD

创建 `.gitlab-ci.yml`：

```yaml
deploy:cloudbase:
  image: node:20
  script:
    - npm install
    - npm run build
    - npm install -g @cloudbase/cli
    - cloudbase login --apiKey $TCB_SECRET_ID $TCB_SECRET_KEY
    - cloudbase hosting:deploy dist -e ai-rh202602-4g44noj4b1870204
  only:
    - main
```

### Jenkins

创建 `Jenkinsfile`：

```groovy
pipeline {
    agent any
    
    environment {
        TCB_SECRET_ID = credentials('tcb-secret-id')
        TCB_SECRET_KEY = credentials('tcb-secret-key')
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }
        
        stage('Deploy') {
            steps {
                sh '''
                    npm install -g @cloudbase/cli
                    cloudbase login --apiKey $TCB_SECRET_ID $TCB_SECRET_KEY
                    cloudbase hosting:deploy dist -e ai-rh202602-4g44noj4b1870204
                '''
            }
        }
    }
}
```

---

## 🔑 安全建议

1. **不要在代码中硬编码密钥**
   - 使用环境变量
   - 使用 Secrets 管理
   - 使用配置文件（添加到 .gitignore）

2. **定期轮换密钥**
   - 每 30-90 天更换一次
   - 在腾讯云控制台管理密钥

3. **限制密钥权限**
   - 仅授予 CloudBase 所需权限
   - 使用子账号代替主账号

4. **监控部署日志**
   - 定期检查部署日志
   - 设置异常告警

---

## 📊 部署后验证

### 1. 访问应用

```
https://ai-rh202602-4g44noj4b1870204.service.tcloudbase.com
```

### 2. 检查控制台

访问：https://console.cloud.tencent.com/tcb

查看：
- 部署状态
- 访问统计
- 错误日志

---

## ❓ 常见问题

### Q1: 部署失败，提示密钥无效

**解决方法**：
1. 检查 SecretId 和 SecretKey 是否正确
2. 确认密钥是否已激活
3. 尝试重新生成密钥

### Q2: 构建成功但部署失败

**解决方法**：
1. 检查 `dist` 文件夹是否存在
2. 确认环境 ID 是否正确
3. 查看详细错误日志

### Q3: 部署成功但无法访问

**解决方法**：
1. 确认 HTTP 访问服务已开通
2. 检查域名关联资源配置
3. 等待 CDN 缓存刷新（1-5 分钟）

---

## 📞 获取帮助

- CloudBase 文档：https://docs.cloudbase.net
- GitHub Actions 文档：https://docs.github.com/actions
- 腾讯云控制台：https://console.cloud.tencent.com/tcb
