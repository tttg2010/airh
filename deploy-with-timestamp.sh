#!/bin/bash

# 自动更新部署时间并部署到 CloudBase

# 获取当前时间
YEAR=$(date +"%Y")
MONTH=$(date +"%-m")
DAY=$(date +"%-d")
HOUR=$(date +"%-H")
MINUTE=$(date +"%-M")

# 格式化时间：2026-02-20 21:30
DATE="${YEAR}-$(printf '%02d' ${MONTH})-$(printf '%02d' ${DAY})"
TIME="$(printf '%02d' ${HOUR}):$(printf '%02d' ${MINUTE})"
TIMESTAMP="${DATE} ${TIME}"

echo "======================================"
echo "部署时间: ${TIMESTAMP}"
echo "======================================"

# 更新 main.jsx 中的部署时间
sed -i.tmp "s/const LAST_DEPLOY_TIME = '.*';/const LAST_DEPLOY_TIME = '${TIMESTAMP}';/" src/main.jsx

# 删除临时文件
rm -f src/main.jsx.tmp

echo "✓ 已更新部署时间"

# 构建
echo "开始构建..."
npm run build

if [ $? -ne 0 ]; then
  echo "✗ 构建失败"
  exit 1
fi

echo "✓ 构建成功"

# 部署
echo "开始部署到 CloudBase..."
tcb hosting:deploy ./dist -e ai-rh202602-4g44noj4b1870204

if [ $? -ne 0 ]; then
  echo "✗ 部署失败"
  exit 1
fi

echo "======================================"
echo "✓ 部署成功！"
echo "✓ 部署时间: ${TIMESTAMP}"
echo "======================================"
