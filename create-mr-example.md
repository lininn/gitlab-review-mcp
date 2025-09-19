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
| `projectId` | string | ✅ | GitLab 项目 ID 或路径 (详见下方格式说明) |
| `sourceBranch` | string | ✅ | 源分支名称 |
| `targetBranch` | string | ❌ | 目标分支名称（默认：main） |
| `title` | string | ❌ | MR 标题（未提供时自动生成） |
| `description` | string | ❌ | MR 描述 |
| `assigneeId` | number | ❌ | 指定的负责人用户 ID |
| `reviewerIds` | number[] | ❌ | 审查者用户 ID 数组 |
| `deleteSourceBranch` | boolean | ❌ | 合并后是否删除源分支（默认：false） |
| `squash` | boolean | ❌ | 是否压缩提交（默认：false） |

### 🔑 项目 ID 格式说明

`projectId` 参数支持以下格式：

#### 1. 数字 ID 格式（推荐）
```json
{
  "projectId": "12345"
}
```
- 最稳定可靠的格式
- 可在 GitLab 项目页面的 URL 或设置页面找到

#### 2. 项目路径格式
```json
{
  "projectId": "mygroup/myproject"
}
```
- 使用组织名/项目名格式
- 支持子组：`"parentgroup/subgroup/project"`

#### 3. 如何找到项目 ID？

1. **在 GitLab UI 中**：
   - 进入项目页面
   - 点击 Settings → General
   - 在 "Project ID" 部分查看数字 ID

2. **从 URL 获取**：
   - 项目 URL：`https://gitlab.com/group/project`
   - 项目路径：`group/project`

3. **使用 MCP 工具获取**：
   ```json
   {
     "tool": "get_project_info",
     "arguments": {
       "workingDirectory": "/path/to/your/project"
     }
   }
   ```

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

失败时返回（增强版错误信息）：

```json
{
  "success": false,
  "error": "404 Project Not Found",
  "message": "❌ Cannot find project: mygroup/myproject",
  "details": {
    "providedProjectId": "mygroup/myproject",
    "normalizedProjectId": "mygroup%2Fmyproject",
    "apiEndpoint": "https://gitlab.com/api/v4/projects/mygroup%2Fmyproject",
    "possibleCauses": [
      "Project does not exist",
      "Project is private and you don't have access",
      "Invalid project ID or path format",
      "Incorrect GitLab API base URL",
      "Invalid or expired API token"
    ],
    "troubleshooting": [
      "Verify project exists in GitLab UI",
      "Check if you have Developer/Maintainer access to the project",
      "Try using project path format: \"group/project\"",
      "Try using numeric project ID instead",
      "Verify API token has correct permissions"
    ]
  }
}
```

## 🔧 故障排除指南

### 常见错误及解决方案

#### 1. "404 Project Not Found"

**可能原因**：
- 项目不存在或被删除
- 项目是私有的，您没有访问权限
- 项目 ID 格式不正确
- API Token 权限不足

**解决方案**：
1. 确认项目在 GitLab 中存在
2. 检查您是否有项目的 Developer 或 Maintainer 权限
3. 尝试使用数字项目 ID：`"12345"`
4. 验证 API Token 的有效性和权限

#### 2. "400 Bad Request"

**可能原因**：
- 源分支不存在
- 目标分支不存在
- 该分支已存在 MR

**解决方案**：
1. 确认源分支已推送到远程仓库
2. 检查目标分支名称是否正确
3. 查看是否已存在相同分支的 MR

#### 3. "401 Unauthorized"

**可能原因**：
- API Token 无效或过期
- Token 权限不足

**解决方案**：
1. 重新生成 API Token
2. 确保 Token 有 `api` 权限
3. 检查 Token 是否正确配置

#### 4. "403 Forbidden"

**可能原因**：
- 没有创建 MR 的权限
- 分支保护规则限制

**解决方案**：
1. 确认您有项目的 Developer 权限
2. 检查分支保护规则设置
3. 联系项目管理员授权

### 🔍 调试技巧

1. **使用项目验证工具**：
   ```json
   {
     "tool": "get_project_info",
     "arguments": {
       "workingDirectory": "/path/to/project"
     }
   }
   ```

2. **获取当前分支信息**：
   ```json
   {
     "tool": "get_current_branch",
     "arguments": {
       "workingDirectory": "/path/to/project"
     }
   }
   ```

3. **验证服务器配置**：
   ```json
   {
     "tool": "get_server_config"
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
