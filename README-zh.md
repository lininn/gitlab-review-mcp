# Node 代码审查 MCP

一个基于 Node.js 的模型上下文协议 (MCP) 服务器，用于代码审查操作，支持 GitHub 和 GitLab 平台。

## 功能特性

- 🔍 获取拉取请求/合并请求详情
- 📄 获取代码差异文件
- 💬 添加审查评论
- 🔍 基础代码质量分析
- 🔧 支持命令行参数配置
- 🌐 同时支持 GitHub 和 GitLab API

## 安装方式

### 通过 NPM 安装（发布后）
```bash
npm install -g gitlab-review-mcp
```

### 本地开发
```bash
git clone <仓库地址>
cd gitlab-review-mcp
npm install
npm run build
```

## 配置

### 环境变量
复制 `env.example` 为 `.env` 并配置：

```bash
# API 配置
API_BASE_URL=https://api.github.com
API_TOKEN=你的_github_token

# 对于 GitLab，使用：
# API_BASE_URL=https://gitlab.com/api/v4
# API_TOKEN=你的_gitlab_token

# 服务器配置
TIMEOUT=30000
MAX_RETRIES=3
```

### 命令行参数
```bash
gitlab-review-mcp \
  --api-base-url https://api.github.com \
  --api-token 你的_token \
  --timeout 30000 \
  --max-retries 3
```

## MCP 配置

添加到你的 MCP 客户端配置中（如 Claude Desktop）：

### 使用 NPX（推荐）
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "gitlab-review-mcp",
        "--api-base-url=https://api.github.com",
        "--api-token=你的_github_token"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_repository_info",
        "analyze_files_batch",
        "get_pull_request_files",
        "get_supported_languages",
        "get_language_rules",
        "get_server_config"
      ]
    }
  }
}
```

### 使用本地安装
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "node",
      "args": [
        "/path/to/gitlab-review-mcp/dist/index.js",
        "--api-base-url=https://api.github.com",
        "--api-token=你的_github_token"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_repository_info",
        "analyze_files_batch",
        "get_pull_request_files",
        "get_supported_languages",
        "get_language_rules",
        "get_server_config"
      ]
    }
  }
}
```

### GitLab 配置
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "gitlab-review-mcp",
        "--api-base-url=https://gitlab.com/api/v4",
        "--api-token=你的_gitlab_token"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_repository_info",
        "analyze_files_batch",
        "get_pull_request_files",
        "get_supported_languages",
        "get_language_rules",
        "get_server_config"
      ]
    }
  }
}
```

## 可用工具

### `fetch_pull_request`
获取拉取请求/合并请求详情。

**参数：**
- `repository` (字符串): 仓库格式 "owner/repo"，或 GitLab 项目路径如 "group/project"（也可使用 `projectId`、`project_path`）
- `pullRequestNumber` (数字): 拉取请求编号
- `provider` (字符串，可选): "github" 或 "gitlab"（默认："gitlab"）

**示例：**
```json
{
  "repository": "microsoft/vscode",
  "pullRequestNumber": 123,
  "provider": "github"
}
```

### `fetch_code_diff`
获取拉取请求或提交的代码差异。

**参数：**
- `repository` (字符串): 仓库格式 "owner/repo"，或 GitLab 项目路径如 "group/project"
- `pullRequestNumber` (数字，可选): 拉取请求编号
- `commitSha` (字符串，可选): 提交 SHA
- `filePath` (字符串，可选): 特定文件路径
- `provider` (字符串，可选): "github" 或 "gitlab"（默认："gitlab"）

**示例：**
```json
{
  "repository": "microsoft/vscode",
  "pullRequestNumber": 123,
  "filePath": "src/index.js",
  "provider": "github"
}
```

### `add_review_comment`
为拉取请求添加审查评论。

**参数：**
- `repository` (字符串): 仓库格式 "owner/repo"，或 GitLab 项目路径如 "group/project"
- `pullRequestNumber` (数字): 拉取请求编号
- `body` (字符串): 评论内容
- `filePath` (字符串，可选): 行评论的文件路径
- `line` (数字，可选): 行评论的行号
- `provider` (字符串，可选): "github" 或 "gitlab"（默认："gitlab"）

**示例：**
```json
{
  "repository": "microsoft/vscode",
  "pullRequestNumber": 123,
  "body": "这个函数需要添加错误处理",
  "filePath": "src/index.js",
  "line": 42,
  "provider": "github"
}
```

### `analyze_code_quality`
分析代码质量并提供详细的改进建议。

**参数：**
- `code` (字符串): 要分析的代码内容
- `language` (字符串): 编程语言（javascript、typescript、python、java、go 等）
- `rules` (数组，可选): 特定的检查规则

**示例：**
```json
{
  "code": "console.log('Hello World');",
  "language": "javascript",
  "rules": ["no-console-log", "no-var"]
}
```

### `get_repository_info`
获取仓库信息。

**参数：**
- `repository` (字符串): 仓库格式 "owner/repo"，或 GitLab 项目路径如 "group/project"
- `provider` (字符串，可选): "github" 或 "gitlab"（默认："gitlab"）

**示例：**
```json
{
  "repository": "microsoft/vscode",
  "provider": "github"
}
```

### `analyze_files_batch`
批量分析多个文件的代码质量问题。

**参数：**
- `files` (数组): 文件对象数组，包含 `path`、`content` 和 `language` 属性
- `rules` (数组，可选): 应用于所有文件的特定规则

**示例：**
```json
{
  "files": [
    {
      "path": "src/index.js",
      "content": "console.log('Hello');",
      "language": "javascript"
    },
    {
      "path": "src/utils.py",
      "content": "print('World')",
      "language": "python"
    }
  ],
  "rules": ["no-console-log", "no-print"]
}
```

### `get_pull_request_files`
获取拉取请求中已更改的文件列表。

**参数：**
- `repository` (字符串): 仓库格式 "owner/repo"，或 GitLab 项目路径如 "group/project"
- `pullRequestNumber` (数字): 拉取请求编号
- `provider` (字符串，可选): "github" 或 "gitlab"（默认："gitlab"）

**示例：**
```json
{
  "repository": "microsoft/vscode",
  "pullRequestNumber": 123,
  "provider": "github"
}
```

### `get_supported_languages`
获取代码分析支持的编程语言列表。

**示例：**
```json
{}
```

### `get_language_rules`
获取特定语言的可用分析规则。

**参数：**
- `language` (字符串): 编程语言

**示例：**
```json
{
  "language": "javascript"
}
```

### `get_server_config`
获取当前服务器配置和健康状态。

**示例：**
```json
{}
```

## API Token 设置

### GitHub
1. 前往 GitHub 设置 > 开发者设置 > 个人访问令牌
2. 生成新令牌并分配适当权限：
   - 私有仓库需要 `repo` 权限
   - 公开仓库仅需要 `public_repo` 权限

### GitLab
1. 前往 GitLab 用户设置 > 访问令牌
2. 创建个人访问令牌并分配权限：
   - 完整 API 访问需要 `api` 权限
   - 只读访问需要 `read_api` 权限

## 支持的编程语言

| 语言 | 规则检查 | 特定规则 |
|------|----------|----------|
| **JavaScript** | ✅ | no-console-log, no-var, no-eval, arrow-function-spacing |
| **TypeScript** | ✅ | JavaScript 规则 + no-any, explicit-return-type |
| **Python** | ✅ | no-print, pep8-line-length, unused-import |
| **Java** | ✅ | system-out-println, public-class-naming |
| **Go** | ✅ | no-fmt-println, error-handling |

### 通用规则（适用于所有语言）
- `todo-comment` - 检测 TODO/FIXME 注释
- `long-line` - 行长度检查（超过 120 字符）
- `trailing-whitespace` - 检测尾随空格

## 代码分析功能

### 分析指标
- **圈复杂度** - 基于控制流语句计算
- **可维护性指数** - 0-100 分评分系统
- **问题统计** - 按严重程度分类

### 问题类型
- **错误 (Error)** - 必须修复的问题
- **警告 (Warning)** - 建议修复的问题  
- **信息 (Info)** - 代码改进建议

### 批量分析统计
- 总文件数、总行数、总问题数
- 平均复杂度计算
- 按类型分组的问题分布

## 使用示例

### 分析 JavaScript 代码
```javascript
// 使用 MCP 客户端调用
{
  "tool": "analyze_code_quality",
  "arguments": {
    "code": "var x = 1; console.log(x); eval('dangerous');",
    "language": "javascript"
  }
}
```

**返回结果：**
```json
{
  "language": "javascript",
  "codeLength": 45,
  "lineCount": 1,
  "issues": [
    {
      "line": 1,
      "column": 1,
      "type": "best-practice",
      "message": "Use let or const instead of var",
      "severity": "warning",
      "rule": "no-var"
    },
    {
      "line": 1,
      "column": 8,
      "type": "debug",
      "message": "Console.log statement found",
      "severity": "warning",
      "rule": "no-console-log"
    },
    {
      "line": 1,
      "column": 23,
      "type": "security",
      "message": "eval() is dangerous and should be avoided",
      "severity": "error",
      "rule": "no-eval"
    }
  ],
  "suggestions": [
    "Replace console.log with proper logging framework"
  ],
  "metrics": {
    "cyclomaticComplexity": 1,
    "maintainabilityIndex": 65,
    "issueCount": {
      "error": 1,
      "warning": 2,
      "info": 0
    }
  }
}
```

### 批量分析多文件
```javascript
{
  "tool": "analyze_files_batch",
  "arguments": {
    "files": [
      {
        "path": "src/index.js",
        "content": "console.log('Hello World');",
        "language": "javascript"
      },
      {
        "path": "src/utils.py", 
        "content": "print('Hello Python')",
        "language": "python"
      }
    ]
  }
}
```

### 获取 PR 文件变更
```javascript
{
  "tool": "get_pull_request_files",
  "arguments": {
    "repository": "microsoft/vscode",
    "pullRequestNumber": 196892,
    "provider": "github"
  }
}
```

## 错误处理

### 自动重试机制
- 网络错误自动重试（最多 3 次）
- 指数退避延迟策略
- 智能错误分类

### 速率限制处理
- 自动检测 API 速率限制
- 智能等待和重试
- 速率限制状态监控

### 常见错误
1. **认证失败** - 检查 API Token 是否正确
2. **仓库不存在** - 确认仓库名称格式正确
3. **权限不足** - 确保 Token 具有相应权限
4. **网络超时** - 调整 timeout 参数

## 开发

### 本地开发
```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 清理构建目录
npm run clean
```

### 测试
```bash
# 运行测试服务器
node test-examples/test-server.js

# 测试命令行参数
node dist/index.js --help
```

### 项目结构
```
src/
├── index.ts          # 主服务器文件
├── code-analyzer.ts  # 代码分析器
├── api-client.ts     # API 客户端
└── types.ts          # 类型定义

test-examples/
├── test-code.js      # JavaScript 测试代码
├── test-code.py      # Python 测试代码
├── test-server.js    # 服务器测试脚本
└── mcp-test-config.json # MCP 测试配置
```

## 性能优化

### 内存使用
- 基础运行：~50MB
- 大文件处理：~100MB
- 批量处理：~200MB

### 响应时间
- 单文件分析：< 100ms
- 批量分析（10文件）：< 500ms
- API 请求：< 2s（取决于网络）

### 并发限制
- 最多 5 个并发 API 请求
- 防止 API 请求过载
- 智能请求排队

## 常见问题

### Q: 如何切换到 GitLab？
A: 修改配置中的 `api-base-url` 为 `https://gitlab.com/api/v4` 并使用 GitLab token。

### Q: 支持企业版 GitHub/GitLab 吗？
A: 是的，只需修改 `api-base-url` 为企业版 API 地址。

### Q: 如何添加新的代码分析规则？
A: 编辑 `src/code-analyzer.ts` 文件中的规则定义。

### Q: 可以分析超大文件吗？
A: 建议单文件不超过 10MB，批量处理不超过 100 个文件。

## 许可证

MIT 许可证 - 详见 LICENSE 文件。

## 贡献

欢迎提交 Pull Request 和 Issue！

1. Fork 本仓库
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 GitHub 和 GitLab
- 基础代码质量分析
- 10 个 MCP 工具
- 5 种编程语言支持
