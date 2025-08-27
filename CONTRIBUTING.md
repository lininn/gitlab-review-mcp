# 🤝 贡献指南

感谢你考虑为 Node Code Review MCP 项目做出贡献！

## 🚀 快速开始

### 1. Fork 项目
1. 访问 [GitHub 项目页面](https://github.com/lininn/gitlab-review-mcp)
2. 点击右上角的 "Fork" 按钮
3. 选择你的 GitHub 账户

### 2. 克隆你的 Fork
```bash
git clone https://github.com/lininn/gitlab-review-mcp.git
cd gitlab-review-mcp
```

### 3. 添加上游仓库
```bash
git remote add upstream https://github.com/original-username/gitlab-review-mcp.git
```

### 4. 安装依赖
```bash
npm install
```

## 🔧 开发环境

### 构建项目
```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 清理构建文件
npm run clean
```

### 运行测试
```bash
# 运行测试
npm test

# 运行测试服务器
node test-examples/test-server.js
```

### 代码质量
```bash
# 检查 TypeScript 类型
npm run build

# 运行测试
npm test
```

## 📝 贡献类型

### 🐛 Bug 修复
1. 创建 issue 描述问题
2. Fork 项目并创建修复分支
3. 编写修复代码和测试
4. 提交 Pull Request

### ✨ 新功能
1. 创建 issue 描述功能需求
2. 讨论实现方案
3. 实现功能并添加测试
4. 更新文档
5. 提交 Pull Request

### 📚 文档改进
1. 识别需要改进的文档
2. 创建 issue 描述改进内容
3. 提交文档更新

### 🧪 测试改进
1. 添加新的测试用例
2. 改进测试覆盖率
3. 优化测试性能

## 📋 Pull Request 指南

### 分支命名
- `fix/` - Bug 修复
- `feature/` - 新功能
- `docs/` - 文档更新
- `test/` - 测试改进
- `refactor/` - 代码重构

### 提交信息规范
```
type(scope): description

[optional body]

[optional footer]
```

**类型 (type):**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例:**
```
feat(analyzer): add support for Rust language

- Add Rust syntax rules
- Implement Rust-specific analysis
- Add tests for Rust code

Closes #123
```

### PR 检查清单
- [ ] 代码符合项目规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 通过了所有测试
- [ ] 提交信息清晰明确
- [ ] 分支名称符合规范

## 🏗️ 项目结构

```
src/
├── index.ts          # 主服务器文件
├── code-analyzer.ts  # 代码分析器
├── api-client.ts     # API 客户端
└── types.ts          # 类型定义

test-examples/        # 测试示例
docs/                 # 文档
scripts/              # 构建和发布脚本
```

## 🔍 代码规范

### TypeScript
- 使用严格的类型检查
- 避免 `any` 类型
- 使用接口定义数据结构
- 添加 JSDoc 注释

### 代码风格
- 使用 2 空格缩进
- 行长度限制在 120 字符
- 使用单引号
- 使用分号结尾

### 错误处理
- 使用适当的错误类型
- 提供有意义的错误信息
- 记录详细的错误日志

## 🧪 测试指南

### 单元测试
- 测试所有公共方法
- 测试边界条件
- 测试错误情况
- 保持测试覆盖率 > 80%

### 集成测试
- 测试 MCP 协议交互
- 测试 API 客户端
- 测试错误处理流程

### 测试数据
- 使用真实的代码示例
- 包含各种编程语言
- 覆盖不同的代码质量场景

## 📚 文档规范

### README 文件
- 清晰的项目描述
- 详细的安装说明
- 完整的使用示例
- 故障排除指南

### API 文档
- 详细的参数说明
- 返回值描述
- 使用示例
- 错误处理说明

### 代码注释
- 函数和类的 JSDoc 注释
- 复杂逻辑的行内注释
- 示例代码注释

## 🚨 报告问题

### Bug 报告
1. 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md)
2. 提供详细的复现步骤
3. 包含环境信息
4. 添加错误日志

### 功能请求
1. 使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.md)
2. 描述使用场景
3. 提供示例代码
4. 讨论实现方案

## 🎯 开发路线图

### 短期目标 (1-2 个月)
- [ ] 支持更多编程语言
- [ ] 改进代码分析规则
- [ ] 优化性能
- [ ] 完善错误处理

### 中期目标 (3-6 个月)
- [ ] 添加更多 MCP 工具
- [ ] 支持企业版 GitHub/GitLab
- [ ] 添加插件系统
- [ ] 改进用户界面

### 长期目标 (6+ 个月)
- [ ] 支持更多代码托管平台
- [ ] 机器学习代码分析
- [ ] 团队协作功能
- [ ] 企业级功能

## 📞 获取帮助

### 讨论
- [GitHub Discussions](https://github.com/lininn/gitlab-review-mcp/discussions)
- [GitHub Issues](https://github.com/lininn/gitlab-review-mcp/issues)

### 联系维护者
- 通过 GitHub Issues 联系
- 参与项目讨论

## 🙏 致谢

感谢所有为项目做出贡献的开发者！

---

🎉 再次感谢你的贡献！让我们一起让这个项目变得更好！
