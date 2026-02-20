# 自动部署指南

## 🚀 快速部署

### 方式一：本地 Docker 部署（推荐）

```bash
# 1. 赋予执行权限
chmod +x deploy.sh

# 2. 执行部署脚本
./deploy.sh
```

部署完成后访问：http://localhost:3000

---

### 方式二：GitHub Actions 自动部署

#### 步骤1：准备 GitHub 仓库

1. 将代码推送到 GitHub 仓库
2. 在仓库设置中配置 Secrets

#### 步骤2：配置 GitHub Secrets

进入仓库：Settings → Secrets and variables → Actions

**Docker Hub 部署需要的 Secrets：**
- `DOCKER_USERNAME`: Docker Hub 用户名
- `DOCKER_PASSWORD`: Docker Hub 密码（建议使用 Access Token）

**Google Cloud 部署需要的 Secrets：**
- `GCP_SERVICE_ACCOUNT_KEY`: GCP 服务账号密钥 JSON

#### 步骤3：触发部署

推送代码到 `main` 分支即可自动触发部署：

```bash
git add .
git commit -m "部署新版本"
git push origin main
```

或手动触发：GitHub → Actions → Deploy Text-to-Video App → Run workflow

---

## ☁️ 云平台部署

### Google Cloud Platform

```bash
# 1. 安装 Google Cloud SDK
# 访问 https://cloud.google.com/sdk/docs/install

# 2. 配置 gcloud
gcloud init

# 3. 运行部署脚本（替换 your-project-id）
chmod +x deploy-gcp.sh
./deploy-gcp.sh your-project-id
```

### CloudBase 腾讯云

1. 登录 CloudBase 控制台
2. 点击"云托管" → "新建应用"
3. 选择"从代码仓库导入"或"从本地代码上传"
4. 上传本项目的 Dockerfile
5. 配置端口：3000
6. 点击部署

---

## 📦 手动部署

### Docker 部署

```bash
# 1. 构建镜像
docker build -t text-to-video:latest .

# 2. 运行容器
docker run -d \
  --name text-to-video \
  -p 3000:3000 \
  --restart unless-stopped \
  text-to-video:latest
```

### VPS 服务器部署

```bash
# 1. 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 克隆项目
git clone <your-repo-url>
cd text-to-video-app

# 3. 安装依赖
npm install

# 4. 构建
npm run build

# 5. 安装 PM2（进程管理器）
npm install -g pm2

# 6. 使用 PM2 启动
pm2 start npm --name "text-to-video" -- start

# 7. 设置开机自启
pm2 startup
pm2 save
```

### 使用 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/text-to-video
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/text-to-video /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔧 配置域名和 HTTPS

### 使用 Certbot 自动配置 HTTPS

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 自动配置 HTTPS
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 📊 监控和维护

### Docker 容器监控

```bash
# 查看容器状态
docker ps

# 查看日志
docker logs -f text-to-video

# 重启容器
docker restart text-to-video

# 停止容器
docker stop text-to-video

# 删除容器
docker rm text-to-video
```

### PM2 监控

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs text-to-video

# 重启应用
pm2 restart text-to-video

# 停止应用
pm2 stop text-to-video

# 删除应用
pm2 delete text-to-video
```

---

## 🔄 更新部署

### Docker 方式

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker build -t text-to-video:latest .

# 3. 重启容器
docker stop text-to-video
docker rm text-to-video
docker run -d \
  --name text-to-video \
  -p 3000:3000 \
  --restart unless-stopped \
  text-to-video:latest
```

### GitHub Actions 方式

推送代码到 `main` 分支，自动部署将自动触发。

---

## 🛠️ 故障排查

### 端口被占用

```bash
# 查看占用端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>
```

### Docker 权限问题

```bash
# 将用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录
newgrp docker
```

### 查看应用日志

```bash
# Docker
docker logs text-to-video

# PM2
pm2 logs text-to-video
```

---

## 📞 支持

如有问题，请查看：
- Docker 文档：https://docs.docker.com
- GitHub Actions 文档：https://docs.github.com/actions
- Google Cloud 文档：https://cloud.google.com/docs
