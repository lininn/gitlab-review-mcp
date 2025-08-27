# 🚀 发布检查清单

## 📋 发布前检查

### 代码质量
- [ ] 所有测试通过 (`npm test`)
- [ ] 构建成功 (`npm run build`)
- [ ] TypeScript 类型检查通过
- [ ] 代码符合项目规范
- [ ] 无明显的 bug 或问题

### 文档完整性
- [ ] README.md 已更新
- [ ] README-zh.md 已更新
- [ ] CHANGELOG.md 已更新
- [ ] 所有新功能都有文档说明
- [ ] 示例代码正确运行

### 配置和依赖
- [ ] package.json 版本号正确
- [ ] 所有依赖版本合理
- [ ] .npmignore 配置正确
- [ ] 构建脚本工作正常
- [ ] 发布脚本可执行

## 🔧 发布步骤

### 1. 准备发布
```bash
# 确保在正确的分支
git checkout main

# 检查状态
git status

# 拉取最新更改
git pull origin main
```

### 2. 运行发布脚本
```bash
# 运行自动发布脚本
./scripts/publish.sh

# 按提示输入新版本号
# 脚本会自动完成所有步骤
```

### 3. 手动发布（备选方案）
```bash
# 更新版本号
npm version patch  # 或 minor, major

# 构建项目
npm run build

# 运行测试
npm test

# 提交更改
git add .
git commit -m "chore: release v$(node -p "require('./package.json').version')"

# 创建标签
git tag -a "v$(node -p "require('./package.json').version')" -m "Release v$(node -p "require('./package.json').version')"

# 推送到远程
git push origin main
git push origin --tags

# 发布到 npm
npm publish
```

## 📊 发布后验证

### npm 包验证
- [ ] 包已成功发布到 npm
- [ ] 包信息正确显示
- [ ] 安装命令工作正常
- [ ] 功能测试通过

### GitHub 发布验证
- [ ] 标签已创建
- [ ] 发布说明完整
- [ ] CHANGELOG.md 已更新
- [ ] 所有文件已提交

### 用户安装测试
```bash
# 测试全局安装
npm install -g gitlab-review-mcp

# 验证版本
gitlab-review-mcp --version

# 测试帮助命令
gitlab-review-mcp --help

# 测试基本功能
gitlab-review-mcp --api-base-url=https://api.github.com --api-token=test
```

## 🚨 常见问题处理

### 发布失败
- [ ] 检查 npm 登录状态 (`npm whoami`)
- [ ] 确认包名可用性
- [ ] 检查版本冲突
- [ ] 验证发布权限

### 功能异常
- [ ] 检查构建输出
- [ ] 验证依赖版本
- [ ] 测试关键功能
- [ ] 检查错误日志

### 文档问题
- [ ] 验证链接有效性
- [ ] 检查示例代码
- [ ] 确认格式正确
- [ ] 测试安装说明

## 📈 发布后推广

### 社区分享
- [ ] 在相关技术社区分享
- [ ] 发布技术博客文章
- [ ] 更新项目状态
- [ ] 参与开源讨论

### 用户支持
- [ ] 监控 GitHub Issues
- [ ] 回答用户问题
- [ ] 收集使用反馈
- [ ] 提供技术支持

### 持续改进
- [ ] 分析用户反馈
- [ ] 规划下一版本
- [ ] 改进文档和示例
- [ ] 优化用户体验

## 🎯 成功发布标志

✅ **发布成功** 当以下所有条件满足时：
- npm 包可正常安装和使用
- GitHub 发布页面完整
- 用户反馈积极
- 功能按预期工作
- 文档清晰完整

---

🎉 **恭喜！** 你的项目已成功发布，现在其他开发者可以享受你的劳动成果了！
