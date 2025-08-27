# Node Code Review MCP

A Node.js implementation of the Model Context Protocol (MCP) server for code review operations, supporting both GitHub and GitLab platforms.

> 📖 **中文文档**: [README-zh.md](./README-zh.md) | [快速开始](./快速开始.md) | [功能对比](./功能对比.md)

## Features

- 🔍 Fetch pull request/merge request details
- 📄 Get code diffs for PRs or commits
- 💬 Add review comments
- 🔍 Basic code quality analysis
- 🔧 Configurable via command line arguments
- 🌐 Support for both GitHub and GitLab APIs

## Installation

### Via NPM (when published)
```bash
npm install -g gitlab-review-mcp
```

### Local Development
```bash
git clone <repository>
cd gitlab-review-mcp
npm install
npm run build
```

## Configuration

### Environment Variables
Copy `env.example` to `.env` and configure:

```bash
# API Configuration
API_BASE_URL=https://api.github.com
API_TOKEN=your_github_token_here

# For GitLab, use:
# API_BASE_URL=https://gitlab.com/api/v4
# API_TOKEN=your_gitlab_token_here

# Server Configuration
TIMEOUT=30000
MAX_RETRIES=3
```

### Command Line Arguments
```bash
gitlab-review-mcp \
  --api-base-url https://api.github.com \
  --api-token your_token \
  --timeout 30000 \
  --max-retries 3
```

## MCP Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

### Using NPX (Recommended)
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "gitlab-review-mcp",
        "--api-base-url=https://api.github.com",
        "--api-token=your_github_token_here"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_server_config"
      ]
    }
  }
}
```

### Using Local Installation
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "node",
      "args": [
        "/path/to/gitlab-review-mcp/dist/index.js",
        "--api-base-url=https://api.github.com",
        "--api-token=your_github_token_here"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_server_config"
      ]
    }
  }
}
```

### For GitLab
```json
{
  "mcpServers": {
    "gitlab-review-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "gitlab-review-mcp",
        "--api-base-url=https://gitlab.com/api/v4",
        "--api-token=your_gitlab_token_here"
      ],
      "alwaysAllow": [
        "fetch_pull_request",
        "fetch_code_diff",
        "add_review_comment",
        "analyze_code_quality",
        "get_server_config"
      ]
    }
  }
}
```

## Available Tools

### `fetch_pull_request`
Fetch pull request/merge request details.

**Parameters:**
- `repository` (string): Repository in format "owner/repo"
- `pullRequestNumber` (number): Pull request number
- `provider` (string, optional): "github" or "gitlab" (default: "github")

### `fetch_code_diff`
Fetch code diff for a pull request or commit.

**Parameters:**
- `repository` (string): Repository in format "owner/repo"  
- `pullRequestNumber` (number, optional): Pull request number
- `commitSha` (string, optional): Commit SHA
- `filePath` (string, optional): Specific file path to get diff for
- `provider` (string, optional): "github" or "gitlab" (default: "github")

### `add_review_comment`
Add a review comment to a pull request.

**Parameters:**
- `repository` (string): Repository in format "owner/repo"
- `pullRequestNumber` (number): Pull request number
- `body` (string): Comment body
- `filePath` (string, optional): File path for line comment
- `line` (number, optional): Line number for line comment
- `provider` (string, optional): "github" or "gitlab" (default: "github")

### `analyze_code_quality`
Analyze code quality and provide suggestions with detailed metrics.

**Parameters:**
- `code` (string): Code content to analyze
- `language` (string): Programming language (javascript, typescript, python, java, go, etc.)
- `rules` (array, optional): Specific rules to check

### `get_repository_info`
Get repository information.

**Parameters:**
- `repository` (string): Repository in format "owner/repo"
- `provider` (string, optional): "github" or "gitlab" (default: "github")

### `analyze_files_batch`
Analyze multiple files for code quality issues.

**Parameters:**
- `files` (array): Array of file objects with `path`, `content`, and `language` properties
- `rules` (array, optional): Specific rules to apply to all files

### `get_pull_request_files`
Get list of files changed in a pull request.

**Parameters:**
- `repository` (string): Repository in format "owner/repo"
- `pullRequestNumber` (number): Pull request number
- `provider` (string, optional): "github" or "gitlab" (default: "github")

### `get_supported_languages`
Get list of supported programming languages for code analysis.

### `get_language_rules`
Get available analysis rules for a specific language.

**Parameters:**
- `language` (string): Programming language

### `get_server_config`
Get current server configuration and health status.

## API Token Setup

### GitHub
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with appropriate permissions:
   - `repo` scope for private repositories
   - `public_repo` scope for public repositories only

### GitLab
1. Go to GitLab User Settings > Access Tokens
2. Create a personal access token with:
   - `api` scope for full API access
   - `read_api` scope for read-only access

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Clean build directory
npm run clean
```

## License

MIT License - see LICENSE file for details.
