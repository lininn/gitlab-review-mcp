#!/bin/bash

# Node Code Review MCP 发布脚本

set -e

echo "🚀 开始发布 Node Code Review MCP..."

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 有未提交的更改，请先提交或暂存"
    git status --porcelain
    exit 1
fi

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "❌ 当前不在主分支，请在 main 或 master 分支上发布"
    exit 1
fi

# 获取当前版本
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本: $CURRENT_VERSION"

# 询问新版本
read -p "请输入新版本号 (例如: 1.0.1): " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo "❌ 版本号不能为空"
    exit 1
fi

# 验证版本号格式
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ 版本号格式不正确，请使用 x.y.z 格式"
    exit 1
fi

echo "🔄 更新版本号到 $NEW_VERSION..."

# 更新 package.json 版本
npm version $NEW_VERSION --no-git-tag-version

# 更新 CHANGELOG.md
echo "📝 更新 CHANGELOG.md..."
cat > CHANGELOG.md << EOF
# 更新日志

## [$NEW_VERSION] - $(date +%Y-%m-%d)

### 🆕 新功能
- 初始版本发布
- 支持 GitHub 和 GitLab API
- 10 个 MCP 工具
- 5 种编程语言支持
- 智能代码质量分析
- 批量文件处理
- 错误处理和重试机制

### 🔧 改进
- 完整的 TypeScript 支持
- 模块化架构设计
- 丰富的配置选项

### 📚 文档
- 完整的中英文文档
- 快速开始指南
- 功能对比分析
- 详细的使用示例

---

## [1.0.0] - $(date +%Y-%m-%d)

- 初始版本
EOF

# 构建项目
echo "🔨 构建项目..."
npm run build

# 运行测试
echo "🧪 运行测试..."
npm test

# 提交更改
echo "💾 提交更改..."
git add .
git commit -m "chore: release v$NEW_VERSION

- 更新版本号到 $NEW_VERSION
- 更新 CHANGELOG.md
- 构建项目并运行测试"

# 创建标签
echo "🏷️ 创建标签 v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 推送到远程仓库
echo "📤 推送到远程仓库..."
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

# 发布到 npm
echo "📦 发布到 npm..."
npm publish

echo "✅ 发布完成！"
echo "🎉 版本 $NEW_VERSION 已成功发布到 npm"
echo "🔗 用户现在可以使用: npm install -g gitlab-review-mcp"
echo "📖 文档: https://github.com/lininn/gitlab-review-mcp"
