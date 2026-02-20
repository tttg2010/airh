# 腾讯云 CloudBase 部署指南

## 🚀 快速部署

### 方法一：使用 CloudBase CLI（推荐）

#### 1. 安装 CloudBase CLI

```bash
# 使用 npm 安装
npm install -g @cloudbase/cli

# 验证安装
cloudbase -v
```

#### 2. 登录 CloudBase

```bash
# 扫码登录
cloudbase login

# 或使用密钥登录
cloudbase login --apiKey <secretId> <secretKey>
```

#### 3. 初始化项目

```bash
cd /Users/zhang/CodeBuddy/20260219235529

# 初始化 CloudBase 项目
cloudbase init
```

选择：
- **是否需要云函数**: 否
- **项目模板**: 静态网站托管

#### 4. 部署

```bash
# 部署到 CloudBase
cloudbase hosting deploy
```

#### 5. 访问应用

部署成功后，CloudBase 会提供一个访问地址，格式：
```
https://<env-id>.service.tcloudbase.com
```

---

### 方法二：通过 CloudBase 控制台部署

#### 步骤 1: 创建环境

1. 访问 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 登录腾讯云账号
3. 点击"新建环境"
4. 选择"免费版"或按需套餐
5. 环境名称：text-to-video-app
6. 点击"立即创建"

#### 步骤 2: 启用静态网站托管

1. 在环境详情页，左侧菜单找到"静态网站托管"
2. 点击"开通"
3. 选择"免费版"或付费版

#### 步骤 3: 上传文件

**方式 A: 控制台上传**
1. 在"静态网站托管"页面
2. 点击"文件管理"
3. 上传 `dist` 文件夹中的所有文件：
   - `index.html`
   - `assets/` 文件夹

**方式 B: 使用命令行**
```bash
# 先构建
npm run build

# 部署
cloudbase hosting:deploy dist -e <env-id>
```

#### 步骤 4: 访问应用

在"静态网站托管"页面会显示访问地址。

---

### 方法三：使用 CloudBase 托管静态网站

#### 1. 安装依赖并构建

```bash
npm install
npm run build
```

#### 2. 使用 CloudBase CLI

```bash
# 安装 CLI
npm install -g @cloudbase/cli

# 登录
cloudbase login

# 部署
cloudbase hosting:deploy ./dist
```

#### 3. 配置自定义域名（可选）

在 CloudBase 控制台：
1. 静态网站托管 → 域名管理
2. 添加自定义域名
3. 配置 DNS 解析

---

## 🔧 配置文件

### cloudbaserc.json

创建 `cloudbaserc.json` 文件：

```json
{
  "envId": "<your-env-id>",
  "version": "2.0",
  "$schema": "https://framework-1258016615.tcloudbaseapp.com/schema/latest.json",
  "framework": {
    "name": "text-to-video-app",
    "plugins": {}
  }
}
```

---

## 📋 部署脚本

### deploy-cloudbase.sh

```bash
#!/bin/bash

echo "🚀 开始部署到腾讯云 CloudBase..."

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建项目
echo "🔨 构建项目..."
npm run build

# 部署到 CloudBase
echo "☁️ 部署到 CloudBase..."
cloudbase hosting:deploy ./dist

echo "✅ 部署完成！"
echo ""
echo "请在 CloudBase 控制台查看访问地址："
echo "https://console.cloud.tencent.com/tcb"
```

---

## ⚠️ 注意事项

1. **CORS 问题**: CloudBase 静态托管会自动处理 CORS，无需额外配置
2. **HTTPS**: CloudBase 自动提供 HTTPS 访问
3. **CDN**: CloudBase 提供全球 CDN 加速
4. **免费额度**: 免费版有一定流量限制，生产环境建议使用付费版

---

## 🌐 自定义域名配置

### 1. 在 CloudBase 控制台添加域名

- 静态网站托管 → 域名管理 → 添加域名
- 输入你的域名，如 `app.yourdomain.com`

### 2. 配置 DNS 解析

在你的域名 DNS 管理中添加 CNAME 记录：

```
类型: CNAME
主机记录: app
记录值: <env-id>.service.tcloudbase.com
```

### 3. 等待生效

DNS 生效通常需要 10 分钟 - 24 小时

---

## 🔄 更新部署

### 方式 1: 重新部署整个项目

```bash
npm run build
cloudbase hosting:deploy ./dist
```

### 方式 2: 仅部署修改的文件

```bash
cloudbase hosting:deploy ./dist -e <env-id>
```

---

## 📊 监控和日志

在 CloudBase 控制台可以查看：
- 访问统计
- 流量统计
- 错误日志
- 性能监控

---

## 💰 费用说明

CloudBase 免费版包括：
- 资源使用量：2GB
- 流量：5GB/月
- 请求次数：100万次/月

超过免费额度后按量付费，价格：
- 资源量：0.008 元/GB/天
- 流量：0.8 元/GB
- 请求次数：1 元/100万次

---

## 🛠️ 故障排查

### 部署失败

```bash
# 查看 CloudBase CLI 日志
cloudbase hosting:deploy ./dist --verbose

# 检查环境 ID 是否正确
cloudbase env:list
```

### 无法访问

1. 检查环境是否已开通静态网站托管
2. 确认 dist 文件夹包含 index.html
3. 检查防火墙和 CDN 配置

---

## 📞 获取帮助

- CloudBase 文档: https://docs.cloudbase.net
- 腾讯云技术支持: https://cloud.tencent.com/document/product
- 社区论坛: https://cloud.tencent.com/developer
