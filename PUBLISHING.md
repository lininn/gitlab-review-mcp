# 📦 发布指南

## 🚀 发布前准备

### 1. 检查清单
- [ ] 所有功能已测试通过
- [ ] 文档已更新完成
- [ ] 版本号已更新
- [ ] CHANGELOG.md 已更新
- [ ] 代码已提交到 Git 仓库

### 2. 环境要求
- Node.js >= 18
- npm >= 8
- Git 已配置用户信息

### 3. 账户准备
- npm 账户已登录 (`npm login`)
- GitHub 仓库已创建
- 发布权限已确认

## 📋 发布步骤

### 方法一：使用发布脚本（推荐）

```bash
# 1. 确保在 main/master 分支
git checkout main

# 2. 运行发布脚本
./scripts/publish.sh

# 3. 按提示输入新版本号
# 脚本会自动完成所有发布步骤
```

### 方法二：手动发布

```bash
# 1. 更新版本号
npm version patch  # 或 minor, major

# 2. 构建项目
npm run build

# 3. 运行测试
npm test

# 4. 提交更改
git add .
git commit -m "chore: release v$(node -p "require('./package.json').version")"

# 5. 创建标签
git tag -a "v$(node -p "require('./package.json').version')" -m "Release v$(node -p "require('./package.json').version')"

# 6. 推送到远程仓库
git push origin main
git push origin --tags

# 7. 发布到 npm
npm publish
```

## 🔧 发布配置

### package.json 关键字段

```json
{
  "name": "gitlab-review-mcp",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bin": {
    "gitlab-review-mcp": "dist/index.js"
  },
  "files": [
    "dist/",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "env.example",
    "mcp-config.example.json"
  ],
  "scripts": {
    "prepublishOnly": "npm run clean && npm run build"
  }
}
```

### .npmignore 配置

确保以下文件不会被发布：
- 源代码 (`src/`)
- 开发依赖 (`node_modules/`)
- 测试文件 (`test-examples/`)
- 构建配置 (`tsconfig.json`)
- 开发脚本 (`scripts/`)

## 📊 发布后验证

### 1. 检查 npm 包
```bash
# 查看包信息
npm view gitlab-review-mcp

# 安装测试
npm install -g gitlab-review-mcp

# 测试功能
gitlab-review-mcp --help
```

### 2. 检查 GitHub 发布
- 确认标签已创建
- 确认 CHANGELOG.md 已更新
- 确认发布说明完整

### 3. 用户安装测试
```bash
# 用户安装命令
npm install -g gitlab-review-mcp

# 验证安装
gitlab-review-mcp --version
```

## 🚨 常见问题

### 发布失败
```bash
# 检查 npm 登录状态
npm whoami

# 重新登录
npm login

# 检查包名是否可用
npm search gitlab-review-mcp
```

### 版本冲突
```bash
# 检查当前版本
npm view gitlab-review-mcp version

# 强制发布（谨慎使用）
npm publish --force
```

### 权限问题
```bash
# 检查包所有者
npm owner ls gitlab-review-mcp

# 添加协作者
npm owner add username gitlab-review-mcp
```

## 📈 发布后推广

### 1. 更新文档
- 更新 README.md 中的安装说明
- 添加使用示例和最佳实践
- 更新故障排除指南

### 2. 社区推广
- 在相关技术社区分享
- 发布技术博客文章
- 参与开源项目讨论

### 3. 收集反馈
- 监控 GitHub Issues
- 收集用户使用反馈
- 持续改进功能

## 🔄 持续发布

### 版本号规范
- **patch**: 修复 bug (1.0.0 → 1.0.1)
- **minor**: 新功能 (1.0.0 → 1.1.0)
- **major**: 重大变更 (1.0.0 → 2.0.0)

### 发布频率
- **patch**: 随时发布（bug 修复）
- **minor**: 功能完成后发布
- **major**: 重大重构后发布

### 自动化建议
- 使用 GitHub Actions 自动发布
- 配置语义化版本提交
- 自动生成发布说明

## 📞 支持渠道

- **GitHub Issues**: 功能请求和 bug 报告
- **GitHub Discussions**: 使用讨论和问题
- **Email**: 直接联系维护者

---

🎉 恭喜！你的项目已经成功发布到 npm，现在其他开发者可以通过 `npm install -g gitlab-review-mcp` 来使用它了！
