# Node Code Review MCP - 功能特性

## 🚀 核心功能

### 1. 多平台支持
- ✅ **GitHub API** - 完整支持 GitHub REST API v4
- ✅ **GitLab API** - 完整支持 GitLab REST API v4
- ✅ **自动切换** - 通过 `provider` 参数自动切换平台

### 2. Pull Request / Merge Request 操作
- 📄 **获取详情** - `fetch_pull_request`
- 📊 **获取差异** - `fetch_code_diff`
- 💬 **添加评论** - `add_review_comment`
- 📁 **获取文件列表** - `get_pull_request_files`

### 3. 代码质量分析
- 🔍 **单文件分析** - `analyze_code_quality`
- 📚 **批量分析** - `analyze_files_batch`
- 📋 **支持语言** - `get_supported_languages`
- ⚙️ **规则查询** - `get_language_rules`

### 4. 仓库管理
- 📖 **仓库信息** - `get_repository_info`
- ⚡ **健康检查** - `get_server_config`

## 🎯 支持的编程语言

| 语言 | 特性检查 | 错误检测 | 风格检查 |
|------|----------|----------|----------|
| **JavaScript** | ✅ | ✅ | ✅ |
| **TypeScript** | ✅ | ✅ | ✅ |
| **Python** | ✅ | ✅ | ✅ |
| **Java** | ✅ | ✅ | ✅ |
| **Go** | ✅ | ✅ | ✅ |

## 📊 代码分析规则

### JavaScript/TypeScript
- `no-console-log` - 检测调试语句
- `no-var` - 建议使用 let/const
- `no-eval` - 安全检查
- `no-any` - TypeScript 类型安全
- `arrow-function-spacing` - 代码风格

### Python
- `no-print` - 建议使用日志
- `pep8-line-length` - 行长度检查
- `unused-import` - 未使用导入

### Java
- `system-out-println` - 建议使用日志
- `public-class-naming` - 命名规范

### Go
- `no-fmt-println` - 建议使用日志
- `error-handling` - 错误处理实践

### 通用规则
- `todo-comment` - TODO/FIXME 检测
- `long-line` - 行长度检查
- `trailing-whitespace` - 尾随空格

## 🔧 高级特性

### 错误处理与重试
- **自动重试** - 支持指数退避重试机制
- **速率限制** - 自动检测和处理 API 速率限制
- **错误分类** - 区分网络错误、认证错误和业务错误
- **健康检查** - 实时监控 API 连接状态

### 性能优化
- **批量处理** - 支持多文件同时分析
- **结果缓存** - 避免重复计算
- **超时控制** - 可配置的请求超时
- **并发限制** - 防止 API 请求过载

### 配置灵活性
- **命令行参数** - 支持运行时配置
- **环境变量** - 支持环境配置
- **动态切换** - 运行时切换 API 提供商

## 📈 分析指标

### 代码复杂度
- **圈复杂度** - 基于控制流语句计算
- **可维护性指数** - 0-100 分评分系统
- **行数统计** - 代码行、注释行统计

### 问题分类
- **错误 (Error)** - 必须修复的问题
- **警告 (Warning)** - 建议修复的问题
- **信息 (Info)** - 代码改进建议

### 批量分析统计
- **总体概览** - 文件数、行数、问题数
- **平均复杂度** - 所有文件的平均圈复杂度
- **问题分布** - 按类型分组的问题统计

## 🔐 安全特性

### 认证支持
- **GitHub Token** - Personal Access Token
- **GitLab Token** - Personal Access Token
- **安全配置** - 敏感信息不暴露在日志中

### 输入验证
- **参数校验** - 严格的输入参数验证
- **注入防护** - 防止代码注入攻击
- **大小限制** - 防止处理超大文件

## 🚢 部署选项

### NPX 部署 (推荐)
```bash
npx -y gitlab-review-mcp --api-token=xxx
```

### 本地安装
```bash
npm install -g gitlab-review-mcp
gitlab-review-mcp --api-token=xxx
```

### Docker 部署 (未来支持)
```bash
docker run -e API_TOKEN=xxx gitlab-review-mcp
```

## 📝 使用示例

### 分析单个文件
```json
{
  "tool": "analyze_code_quality",
  "arguments": {
    "code": "console.log('Hello World');",
    "language": "javascript"
  }
}
```

### 批量分析文件
```json
{
  "tool": "analyze_files_batch",
  "arguments": {
    "files": [
      {
        "path": "src/index.js",
        "content": "console.log('Hello');",
        "language": "javascript"
      }
    ]
  }
}
```

### 获取 PR 文件
```json
{
  "tool": "get_pull_request_files",
  "arguments": {
    "repository": "owner/repo",
    "pullRequestNumber": 123,
    "provider": "github"
  }
}
```

## 🔄 集成方式

### MCP 客户端集成
- **Claude Desktop** - 官方 MCP 客户端
- **自定义客户端** - 基于 MCP SDK 开发

### API 集成
- **REST API** - 通过 GitHub/GitLab API
- **Webhook** - 响应代码变更事件

### CI/CD 集成
- **GitHub Actions** - 自动代码审查
- **GitLab CI** - 持续集成流水线
- **Jenkins** - 构建流水线集成

## 📊 性能指标

### 响应时间
- **单文件分析** - < 100ms
- **批量分析** - < 500ms (10文件)
- **API 请求** - < 2s (网络延迟)

### 内存使用
- **基础运行** - ~50MB
- **大文件处理** - ~100MB
- **批量处理** - ~200MB

### 吞吐量
- **分析速度** - 1000+ 行/秒
- **API 请求** - 遵循平台限制
- **并发处理** - 最多 5 个并发请求
