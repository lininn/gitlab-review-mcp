# 使用 MCP 创建 GitLab Merge Request

本功能允许您通过 MCP (Model Context Protocol) 接口根据分支名创建 GitLab Merge Request。

## 功能特性

- ✅ 根据分支名自动创建 MR
- ✅ 智能生成 MR 标题（基于分支命名规范）
- ✅ 支持自定义目标分支（默认为 main）
- ✅ 支持添加描述、指定审查者、设置合并选项
- ✅ 自动处理不同分支前缀（feature/, bugfix/, hotfix/, docs/, refactor/）

## 使用方法

### 基本用法

```json
{
  "tool": "create_merge_request",
  "arguments": {
    "projectId": "your-group/your-project",
    "sourceBranch": "feature/add-new-login-system"
  }
}
```

### 完整配置示例

```json
{
  "tool": "create_merge_request",
  "arguments": {
    "projectId": "12345",
    "sourceBranch": "feature/user-authentication",
    "targetBranch": "develop",
    "title": "feat: Add user authentication system",
    "description": "This MR adds a comprehensive user authentication system with JWT tokens and password hashing.",
    "assigneeId": 123,
    "reviewerIds": [456, 789],
    "deleteSourceBranch": true,
    "squash": true
  }
}
```

## 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `projectId` | string | ✅ | GitLab 项目 ID 或路径 (如 "12345" 或 "group/project") |
| `sourceBranch` | string | ✅ | 源分支名称 |
| `targetBranch` | string | ❌ | 目标分支名称（默认：main） |
| `title` | string | ❌ | MR 标题（未提供时自动生成） |
| `description` | string | ❌ | MR 描述 |
| `assigneeId` | number | ❌ | 指定的负责人用户 ID |
| `reviewerIds` | number[] | ❌ | 审查者用户 ID 数组 |
| `deleteSourceBranch` | boolean | ❌ | 合并后是否删除源分支（默认：false） |
| `squash` | boolean | ❌ | 是否压缩提交（默认：false） |

## 自动标题生成规则

基于分支名称前缀自动生成符合 Conventional Commits 规范的标题：

- `feature/` → `feat: `
- `feat/` → `feat: `
- `bugfix/` → `fix: `
- `hotfix/` → `fix: `
- `docs/` → `docs: `
- `refactor/` → `refactor: `

### 示例

- `feature/user-login` → `feat: User Login`
- `bugfix/fix-password-reset` → `fix: Fix Password Reset`
- `docs/update-readme` → `docs: Update Readme`

## 返回结果

成功创建时返回：

```json
{
  "success": true,
  "mergeRequest": {
    "id": 123,
    "web_url": "https://gitlab.com/group/project/-/merge_requests/123",
    "title": "feat: Add User Authentication",
    "state": "opened",
    "source_branch": "feature/user-authentication",
    "target_branch": "main",
    "author": {
      "id": 456,
      "name": "John Doe",
      "username": "johndoe"
    }
  },
  "message": "🎉 Merge request created successfully!"
}
```

失败时返回：

```json
{
  "success": false,
  "error": "Branch already exists",
  "message": "❌ Failed to create merge request"
}
```

## 环境配置

确保设置了以下环境变量：

```bash
# GitLab API 配置
API_BASE_URL=https://gitlab.com/api/v4
API_TOKEN=your_gitlab_personal_access_token

# 可选配置
TIMEOUT=30000
MAX_RETRIES=3
```

## 集成示例

在 Claude Desktop 中的配置文件中添加：

```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "node",
      "args": ["/path/to/gitlab-review-mcp/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://gitlab.com/api/v4",
        "API_TOKEN": "your_gitlab_token"
      }
    }
  }
}
```

现在您可以在 Claude 中直接使用自然语言创建 MR：

> "请为分支 feature/new-dashboard 创建一个 merge request 到 main 分支"

或者

> "创建 MR: 分支 bugfix/login-issue，目标分支 develop，标题 '修复登录问题'，并指定审查者 ID 123"
