# Git 工作流集成示例

本文档展示如何使用新的 MCP Git 工具来自动化 GitLab 工作流程。

## 工作流程概述

1. 🔍 **获取当前分支信息** - 使用 `get_current_branch`
2. 📋 **获取项目信息** - 使用 `get_project_info`
3. 🚀 **创建 Merge Request** - 使用 `create_merge_request`

## 完整工作流示例

### 步骤 1: 检查当前分支

```json
{
  "tool": "get_current_branch",
  "arguments": {}
}
```

**响应示例:**
```json
{
  "currentBranch": "feature/user-authentication",
  "allBranches": ["main", "develop", "feature/user-authentication"],
  "isGitRepository": true,
  "repositoryRoot": "/Users/developer/my-project"
}
```

### 步骤 2: 获取项目信息

```json
{
  "tool": "get_project_info",
  "arguments": {
    "remoteName": "origin"
  }
}
```

**响应示例:**
```json
{
  "projectId": "mycompany%2Fawesome-app",
  "projectPath": "mycompany/awesome-app",
  "gitlabUrl": "https://gitlab.com",
  "remotes": [
    {
      "name": "origin",
      "url": "git@gitlab.com:mycompany/awesome-app.git",
      "fetch": "git@gitlab.com:mycompany/awesome-app.git",
      "push": "git@gitlab.com:mycompany/awesome-app.git"
    }
  ],
  "isGitlabProject": true
}
```

### 步骤 3: 自动创建 MR

使用从前两步获取的信息自动创建 Merge Request：

```json
{
  "tool": "create_merge_request",
  "arguments": {
    "projectId": "mycompany/awesome-app",
    "sourceBranch": "feature/user-authentication",
    "targetBranch": "develop",
    "description": "This MR implements JWT-based user authentication with the following features:\n\n- User registration and login\n- Password hashing with bcrypt\n- JWT token generation and validation\n- Protected route middleware\n\nTesting completed for all authentication flows."
  }
}
```

## 智能化 Claude 指令示例

您可以使用自然语言指令让 Claude 自动执行整个工作流：

### 示例 1: 完整的 MR 创建流程

> "请帮我为当前分支创建一个 merge request。首先检查当前分支和项目信息，然后创建 MR 到 main 分支。"

Claude 将自动：
1. 调用 `get_current_branch` 获取当前分支
2. 调用 `get_project_info` 获取项目 ID
3. 调用 `create_merge_request` 创建 MR

### 示例 2: 条件性 MR 创建

> "如果当前分支是 feature 分支，请创建一个 MR 到 develop 分支，否则告诉我当前的分支状态。"

### 示例 3: 批量分支检查

> "检查这个项目的所有分支，并告诉我哪些 feature 分支可能需要创建 MR。"

## 高级用法

### 多项目管理

如果您有多个项目，可以指定不同的工作目录：

```json
{
  "tool": "get_project_info",
  "arguments": {
    "workingDirectory": "/path/to/another/project",
    "remoteName": "origin"
  }
}
```

### 不同远程仓库

检查不同的远程仓库（如 upstream）：

```json
{
  "tool": "get_project_info",
  "arguments": {
    "remoteName": "upstream"
  }
}
```

### 错误处理

工具会优雅地处理各种错误情况：

- 📁 **非 Git 仓库**: `isGitRepository: false`
- 🔗 **远程不存在**: `isGitlabProject: false`
- 🚫 **权限问题**: 返回详细错误信息

## 自动化脚本示例

结合这些工具，您可以创建自动化脚本：

```javascript
// 伪代码示例
async function autoCreateMR() {
  // 1. 获取当前分支
  const branchInfo = await mcp.call('get_current_branch');
  
  if (!branchInfo.isGitRepository) {
    console.log('❌ 当前目录不是 Git 仓库');
    return;
  }
  
  // 2. 检查是否为 feature 分支
  if (!branchInfo.currentBranch.startsWith('feature/')) {
    console.log('⚠️ 当前分支不是 feature 分支');
    return;
  }
  
  // 3. 获取项目信息
  const projectInfo = await mcp.call('get_project_info');
  
  if (!projectInfo.isGitlabProject) {
    console.log('❌ 当前项目不是 GitLab 项目');
    return;
  }
  
  // 4. 创建 MR
  const result = await mcp.call('create_merge_request', {
    projectId: projectInfo.projectPath,
    sourceBranch: branchInfo.currentBranch,
    targetBranch: 'develop'
  });
  
  console.log('🎉 MR 创建成功:', result.mergeRequest.web_url);
}
```

## 最佳实践

1. **🔍 先检查**: 始终先使用 `get_current_branch` 检查当前状态
2. **📋 确认项目**: 使用 `get_project_info` 确认项目信息正确
3. **✍️ 描述清晰**: 为 MR 提供清晰的标题和描述
4. **👥 指定审查者**: 使用 `reviewerIds` 指定合适的审查者
5. **🧹 清理分支**: 考虑设置 `deleteSourceBranch: true`

## 故障排除

### 常见问题

**Q: 工具显示 `isGitRepository: false`？**
A: 确保在 Git 仓库目录中运行，或指定正确的 `workingDirectory`。

**Q: 工具显示 `isGitlabProject: false`？**
A: 检查远程 URL 是否指向 GitLab 实例，确认 `remoteName` 参数正确。

**Q: 创建 MR 失败？**
A: 确保：
- API token 有效且有足够权限
- 源分支已推送到远程仓库
- 目标分支存在
- 项目 ID 正确

### 调试技巧

使用 `get_server_config` 检查服务器状态：

```json
{
  "tool": "get_server_config",
  "arguments": {}
}
```

这将显示当前配置和健康状态，帮助诊断问题。
