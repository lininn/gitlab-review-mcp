#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Command } from 'commander';
import { config } from 'dotenv';
import axios, { AxiosResponse } from 'axios';
import { join } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CodeAnalyzer } from './code-analyzer.js';
import { ApiClient } from './api-client.js';
import { CodeAnalysisResult, ApiRequestOptions } from './types.js';

// Load environment variables
config();

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
let packageVersion = '1.0.16';
try {
  const packagePath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageVersion = packageJson.version;
} catch (error) {
  console.warn('Could not read package.json version, using default:', packageVersion);
}


// Configuration interface
interface ServerConfig {
  apiBaseUrl?: string;
  apiToken?: string;
  timeout?: number;
  maxRetries?: number;
}

// Default configuration
const defaultConfig: ServerConfig = {
  apiBaseUrl: process.env.API_BASE_URL || 'https://api.github.com',
  apiToken: process.env.API_TOKEN || '',
  timeout: parseInt(process.env.TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
};

class CodeReviewMCPServer {
  private server: Server;
  private config: ServerConfig;
  private codeAnalyzer: CodeAnalyzer;
  private apiClient: ApiClient;

  constructor(config: ServerConfig = {}) {
    this.config = { ...defaultConfig, ...config };
    this.codeAnalyzer = new CodeAnalyzer();
    this.apiClient = new ApiClient(
      this.config.apiBaseUrl!,
      this.config.apiToken!,
      this.config.timeout,
      this.config.maxRetries
    );
    
    this.server = new Server(
      {
        name: 'node-code-review-mcp',
        version: packageVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fetch_pull_request',
            description: 'Fetch pull request details from GitHub/GitLab',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository in format "owner/repo"',
                },
                pullRequestNumber: {
                  type: 'number',
                  description: 'Pull request number',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'github',
                },
              },
              required: ['repository', 'pullRequestNumber'],
            },
          },
          {
            name: 'fetch_code_diff',
            description: 'Fetch code diff for a pull request or commit',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository in format "owner/repo"',
                },
                pullRequestNumber: {
                  type: 'number',
                  description: 'Pull request number (optional if commitSha is provided)',
                },
                commitSha: {
                  type: 'string',
                  description: 'Commit SHA (optional if pullRequestNumber is provided)',
                },
                filePath: {
                  type: 'string',
                  description: 'Specific file path to get diff for (optional)',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'github',
                },
              },
              required: ['repository'],
            },
          },
          {
            name: 'add_review_comment',
            description: 'Add a review comment to a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository in format "owner/repo"',
                },
                pullRequestNumber: {
                  type: 'number',
                  description: 'Pull request number',
                },
                body: {
                  type: 'string',
                  description: 'Comment body',
                },
                filePath: {
                  type: 'string',
                  description: 'File path for line comment (optional)',
                },
                line: {
                  type: 'number',
                  description: 'Line number for line comment (optional)',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'github',
                },
              },
              required: ['repository', 'pullRequestNumber', 'body'],
            },
          },
          {
            name: 'analyze_code_quality',
            description: 'Analyze code quality and provide suggestions with detailed metrics',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Code content to analyze',
                },
                language: {
                  type: 'string',
                  description: 'Programming language (javascript, typescript, python, java, go, etc.)',
                },
                rules: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific rules to check (optional)',
                },
              },
              required: ['code', 'language'],
            },
          },
          {
            name: 'get_supported_languages',
            description: 'Get list of supported programming languages for code analysis',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_language_rules',
            description: 'Get available analysis rules for a specific language',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  description: 'Programming language',
                },
              },
              required: ['language'],
            },
          },
          {
            name: 'get_repository_info',
            description: 'Get repository information',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository in format "owner/repo"',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'github',
                },
              },
              required: ['repository'],
            },
          },
          {
            name: 'analyze_files_batch',
            description: 'Analyze multiple files for code quality issues',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      path: { type: 'string' },
                      content: { type: 'string' },
                      language: { type: 'string' },
                    },
                    required: ['path', 'content', 'language'],
                  },
                  description: 'Array of files to analyze',
                },
                rules: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific rules to apply to all files (optional)',
                },
              },
              required: ['files'],
            },
          },
          {
            name: 'get_pull_request_files',
            description: 'Get list of files changed in a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository in format "owner/repo"',
                },
                pullRequestNumber: {
                  type: 'number',
                  description: 'Pull request number',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'github',
                },
              },
              required: ['repository', 'pullRequestNumber'],
            },
          },
          {
            name: 'get_server_config',
            description: 'Get current server configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'fetch_pull_request':
            return await this.fetchPullRequest(args);
          case 'fetch_code_diff':
            return await this.fetchCodeDiff(args);
          case 'add_review_comment':
            return await this.addReviewComment(args);
          case 'analyze_code_quality':
            return await this.analyzeCodeQuality(args);
          case 'get_supported_languages':
            return await this.getSupportedLanguages();
          case 'get_language_rules':
            return await this.getLanguageRules(args);
          case 'get_repository_info':
            return await this.getRepositoryInfo(args);
          case 'analyze_files_batch':
            return await this.analyzeFilesBatch(args);
          case 'get_pull_request_files':
            return await this.getPullRequestFiles(args);
          case 'get_server_config':
            return await this.getServerConfig();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async makeApiRequest(endpoint: string, options: ApiRequestOptions = {}): Promise<AxiosResponse> {
    try {
      return await this.apiClient.requestWithRateLimit(endpoint, options);
    } catch (error) {
      console.error(`API request failed for endpoint ${endpoint}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async fetchPullRequest(args: any) {
    const { repository, pullRequestNumber, provider = 'github' } = args;

    let endpoint: string;
    if (provider === 'github') {
      endpoint = `repos/${repository}/pulls/${pullRequestNumber}`;
    } else if (provider === 'gitlab') {
      // For GitLab, repository should be the project ID or path
      endpoint = `projects/${encodeURIComponent(repository)}/merge_requests/${pullRequestNumber}`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await this.makeApiRequest(endpoint);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async fetchCodeDiff(args: any) {
    const { repository, pullRequestNumber, commitSha, filePath, provider = 'github' } = args;

    let endpoint: string;
    if (provider === 'github') {
      if (pullRequestNumber) {
        endpoint = `repos/${repository}/pulls/${pullRequestNumber}/files`;
      } else if (commitSha) {
        endpoint = `repos/${repository}/commits/${commitSha}`;
      } else {
        throw new Error('Either pullRequestNumber or commitSha must be provided');
      }
    } else if (provider === 'gitlab') {
      if (pullRequestNumber) {
        endpoint = `projects/${encodeURIComponent(repository)}/merge_requests/${pullRequestNumber}/changes`;
      } else if (commitSha) {
        endpoint = `projects/${encodeURIComponent(repository)}/repository/commits/${commitSha}/diff`;
      } else {
        throw new Error('Either pullRequestNumber or commitSha must be provided');
      }
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await this.makeApiRequest(endpoint);
    let data = response.data;

    // Filter by file path if specified
    if (filePath && Array.isArray(data)) {
      data = data.filter((file: any) => 
        file.filename === filePath || 
        file.new_path === filePath || 
        file.old_path === filePath
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async addReviewComment(args: any) {
    const { repository, pullRequestNumber, body, filePath, line, provider = 'github' } = args;

    let endpoint: string;
    let requestData: any;

    if (provider === 'github') {
      if (filePath && line) {
        endpoint = `repos/${repository}/pulls/${pullRequestNumber}/reviews`;
        requestData = {
          body,
          event: 'COMMENT',
          comments: [{
            path: filePath,
            line,
            body,
          }],
        };
      } else {
        endpoint = `repos/${repository}/issues/${pullRequestNumber}/comments`;
        requestData = { body };
      }
    } else if (provider === 'gitlab') {
      endpoint = `projects/${encodeURIComponent(repository)}/merge_requests/${pullRequestNumber}/notes`;
      requestData = { body };
      
      if (filePath && line) {
        requestData.position = {
          position_type: 'text',
          new_path: filePath,
          new_line: line,
        };
      }
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await this.makeApiRequest(endpoint, {
      method: 'POST',
      data: requestData,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async analyzeCodeQuality(args: any) {
    const { code, language, rules = [] } = args;
    
    const analysis: CodeAnalysisResult = this.codeAnalyzer.analyze(code, language, rules);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  private async getSupportedLanguages() {
    const languages = this.codeAnalyzer.getSupportedLanguages();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            supportedLanguages: languages,
            total: languages.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getLanguageRules(args: any) {
    const { language } = args;
    const rules = this.codeAnalyzer.getLanguageRules(language);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            language,
            rules: rules.map(rule => ({
              name: rule.name,
              message: rule.message,
              severity: rule.severity,
              type: rule.type,
            })),
            total: rules.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getRepositoryInfo(args: any) {
    const { repository, provider = 'github' } = args;

    let endpoint: string;
    if (provider === 'github') {
      endpoint = `repos/${repository}`;
    } else if (provider === 'gitlab') {
      endpoint = `projects/${encodeURIComponent(repository)}`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await this.makeApiRequest(endpoint);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async analyzeFilesBatch(args: any) {
    const { files, rules = [] } = args;
    
    const results = files.map((file: any) => {
      const analysis = this.codeAnalyzer.analyze(file.content, file.language, rules);
      return {
        filePath: file.path,
        language: file.language,
        analysis,
      };
    });

    // Calculate overall statistics
    const totalIssues = results.reduce((sum: number, result: any) => sum + result.analysis.issues.length, 0);
    const totalLines = results.reduce((sum: number, result: any) => sum + result.analysis.lineCount, 0);
    const avgComplexity = results.reduce((sum: number, result: any) => sum + result.analysis.metrics.cyclomaticComplexity, 0) / results.length;

    const summary = {
      totalFiles: files.length,
      totalLines,
      totalIssues,
      averageComplexity: Math.round(avgComplexity * 100) / 100,
      issuesByType: {
        error: results.reduce((sum: number, result: any) => sum + result.analysis.metrics.issueCount.error, 0),
        warning: results.reduce((sum: number, result: any) => sum + result.analysis.metrics.issueCount.warning, 0),
        info: results.reduce((sum: number, result: any) => sum + result.analysis.metrics.issueCount.info, 0),
      },
      results,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  private async getPullRequestFiles(args: any) {
    const { repository, pullRequestNumber, provider = 'github' } = args;

    let endpoint: string;
    if (provider === 'github') {
      endpoint = `repos/${repository}/pulls/${pullRequestNumber}/files`;
    } else if (provider === 'gitlab') {
      endpoint = `projects/${encodeURIComponent(repository)}/merge_requests/${pullRequestNumber}/changes`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await this.makeApiRequest(endpoint);
    let files = response.data;

    // Normalize the response format
    if (provider === 'gitlab' && files.changes) {
      files = files.changes;
    }

    // Extract file information
    const fileList = Array.isArray(files) ? files.map((file: any) => {
      if (provider === 'github') {
        return {
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch?.substring(0, 1000) + (file.patch?.length > 1000 ? '...' : ''), // Truncate large patches
        };
      } else {
        return {
          filename: file.new_path || file.old_path,
          status: file.new_file ? 'added' : file.deleted_file ? 'deleted' : 'modified',
          oldPath: file.old_path,
          newPath: file.new_path,
          diff: file.diff?.substring(0, 1000) + (file.diff?.length > 1000 ? '...' : ''), // Truncate large diffs
        };
      }
    }) : [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            pullRequestNumber,
            repository,
            provider,
            totalFiles: fileList.length,
            files: fileList,
          }, null, 2),
        },
      ],
    };
  }

  private async getServerConfig() {
    const apiInfo = this.apiClient.getApiInfo();
    const isHealthy = await this.apiClient.healthCheck();
    
    const safeConfig = {
      ...apiInfo,
      supportedLanguages: this.codeAnalyzer.getSupportedLanguages(),
      healthStatus: isHealthy ? 'healthy' : 'unhealthy',
      version: packageVersion,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(safeConfig, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// CLI setup
async function main() {
  const program = new Command();

  program
    .name('node-code-review-mcp')
    .description('Node.js MCP server for code review operations')
    .version(packageVersion)
    .option('--api-base-url <url>', 'API base URL')
    .option('--api-token <token>', 'API token for authentication')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .option('--max-retries <count>', 'Maximum retry attempts', '3');

  program.parse();
  
  const options = program.opts();
  
  // Create server config from CLI options
  const config: ServerConfig = {};
  if (options.apiBaseUrl) config.apiBaseUrl = options.apiBaseUrl;
  if (options.apiToken) config.apiToken = options.apiToken;
  if (options.timeout) config.timeout = parseInt(options.timeout);
  if (options.maxRetries) config.maxRetries = parseInt(options.maxRetries);

  const server = new CodeReviewMCPServer(config);
  await server.run();
}

// Run the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { CodeReviewMCPServer, ServerConfig };
