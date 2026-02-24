# 开发指南

## 端口规定

⚠️ **重要：本地预览统一使用端口 3000**

所有本地开发预览必须使用端口 3000，不得使用其他端口。

## 启动本地开发服务器

### 方法一：使用 Vite（推荐）

```bash
npm run dev
```

访问地址：http://localhost:3000

### 方法二：使用统一启动脚本

```bash
./start-dev.sh
```

这个脚本会：
- 确保使用端口 3000
- 启动 Vite 开发服务器
- 自动打开浏览器预览

## 部署

### 自动部署（推荐）

```bash
./deploy-auto.sh
```

功能：
- 自动提取版本号
- 自动记录部署日志
- 自动构建并部署
- 自动提交到 git

### 手动部署

```bash
npm run build
cloudbase hosting:deploy ./dist -e ai-rh202602-4g44noj4b1870204
```

## 线上访问地址

- **生产环境**: https://ai-rh202602-4g44noj4b1870204-1259354505.tcloudbaseapp.com
- **带缓存清除**: https://ai-rh202602-4g44noj4b1870204-1259354505.tcloudbaseapp.com/?_refresh=<timestamp>

## CloudBase 控制台

- **环境概览**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/overview
- **云函数**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/scf
- **云存储**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/storage
- **数据库**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/db/doc
- **身份认证**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/identity
- **静态托管**: https://tcb.cloud.tencent.com/dev?envId=ai-rh202602-4g44noj4b1870204#/hosting

## 版本管理

版本号定义在 `src/main.jsx` 的 `APP_VERSION` 常量中。

每次更新版本时：
1. 修改 `APP_VERSION` 值
2. 在 `getChangelog()` 函数中添加对应的更新日志
3. 运行 `./deploy-auto.sh` 部署
