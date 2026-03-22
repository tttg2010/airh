#!/bin/bash

# 统一开发服务器启动脚本
# 强制使用端口 3000

echo "🚀 启动本地开发服务器..."
echo "📌 端口: 8080"
echo ""

# 检查端口 3000 是否被占用
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 8080 已被占用"
    echo ""
    lsof -i :8080
    echo ""
    read -p "是否终止占用端口的进程？(y/n): " KILL_PROCESS
    if [ "$KILL_PROCESS" = "y" ]; then
        PID=$(lsof -ti :8080)
        kill -9 $PID
        echo "✓ 进程 $PID 已终止"
        echo ""
    else
        echo "❌ 无法启动，请先释放端口 8080"
        exit 1
    fi
fi

# 启动开发服务器
echo "启动 Vite 开发服务器..."
npm run dev
