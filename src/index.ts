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
import axios, { AxiosResponse, AxiosError } from 'axios';
import { join } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { CodeAnalyzer } from './code-analyzer.js';
import { ApiClient } from './api-client.js';
import { CodeAnalysisResult, ApiRequestOptions, CreateMergeRequestOptions, MergeRequestResult, GitBranchInfo, GitRemoteInfo, ProjectInfo } from './types.js';

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
          {
            name: 'create_merge_request',
            description: 'Create a new GitLab merge request from a source branch',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'GitLab project ID or path (e.g., "12345" or "group/project")',
                },
                sourceBranch: {
                  type: 'string',
                  description: 'Source branch name (e.g., "feature/new-feature")',
                },
                targetBranch: {
                  type: 'string',
                  description: 'Target branch name (defaults to "main")',
                  default: 'main',
                },
                title: {
                  type: 'string',
                  description: 'Merge request title (auto-generated from branch name if not provided)',
                },
                description: {
                  type: 'string',
                  description: 'Merge request description',
                },
                assigneeId: {
                  type: 'number',
                  description: 'User ID to assign the merge request to',
                },
                reviewerIds: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Array of user IDs to request reviews from',
                },
                deleteSourceBranch: {
                  type: 'boolean',
                  description: 'Whether to delete source branch when MR is merged',
                  default: false,
                },
                squash: {
                  type: 'boolean',
                  description: 'Whether to squash commits when merging',
                  default: false,
                },
              },
              required: ['projectId', 'sourceBranch'],
            },
          },
          {
            name: 'get_current_branch',
            description: 'Get current Git branch and repository information',
            inputSchema: {
              type: 'object',
              properties: {
                workingDirectory: {
                  type: 'string',
                  description: 'Working directory path (defaults to current directory)',
                },
              },
            },
          },
          {
            name: 'get_project_info',
            description: 'Get current GitLab project information from Git remotes',
            inputSchema: {
              type: 'object',
              properties: {
                workingDirectory: {
                  type: 'string',
                  description: 'Working directory path (defaults to current directory)',
                },
                remoteName: {
                  type: 'string',
                  description: 'Git remote name (defaults to "origin")',
                  default: 'origin',
                },
              },
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
          case 'create_merge_request':
            return await this.createMergeRequest(args);
          case 'get_current_branch':
            return await this.getCurrentBranch(args);
          case 'get_project_info':
            return await this.getProjectInfo(args);
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

  private async createMergeRequest(args: any) {
    const {
      projectId,
      sourceBranch,
      targetBranch = 'main',
      title,
      description,
      assigneeId,
      reviewerIds,
      deleteSourceBranch = false,
      squash = false,
    } = args;

    // Validate and normalize project ID
    const normalizedProjectId = this.normalizeProjectId(projectId);
    if (!normalizedProjectId) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Invalid project ID format',
              message: `❌ Project ID should be in format "group/project" or numeric ID like "12345"`,
              providedProjectId: projectId,
              suggestions: [
                'Use project path format: "mygroup/myproject"',
                'Use numeric project ID: "12345"',
                'Check if the project exists and you have access to it'
              ]
            }, null, 2),
          },
        ],
      };
    }

    // Auto-generate title from branch name if not provided
    const mrTitle = title || this.generateMRTitle(sourceBranch);

    // Prepare the request data
    const requestData: any = {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title: mrTitle,
    };

    if (description) {
      requestData.description = description;
    }

    if (assigneeId) {
      requestData.assignee_id = assigneeId;
    }

    if (reviewerIds && reviewerIds.length > 0) {
      requestData.reviewer_ids = reviewerIds;
    }

    if (deleteSourceBranch) {
      requestData.remove_source_branch = true;
    }

    if (squash) {
      requestData.squash = true;
    }

    try {
      // First, try to verify project exists by fetching project info
      console.log(`🔍 Attempting to verify project: ${normalizedProjectId}`);
      
      try {
        const projectEndpoint = `projects/${normalizedProjectId}`;
        const projectResponse = await this.makeApiRequest(projectEndpoint);
        console.log(`✅ Project verified: ${projectResponse.data.name} (ID: ${projectResponse.data.id})`);
      } catch (verifyError) {
        console.warn(`⚠️ Project verification failed, proceeding with MR creation...`);
        
        // Provide detailed error information for project not found
        if (this.isAxiosError(verifyError) && verifyError.response?.status === 404) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: '404 Project Not Found',
                  message: `❌ Cannot find project: ${projectId}`,
                  details: {
                    providedProjectId: projectId,
                    normalizedProjectId: normalizedProjectId,
                    apiEndpoint: `${this.config.apiBaseUrl}/projects/${normalizedProjectId}`,
                    possibleCauses: [
                      'Project does not exist',
                      'Project is private and you don\'t have access',
                      'Invalid project ID or path format',
                      'Incorrect GitLab API base URL',
                      'Invalid or expired API token'
                    ],
                    troubleshooting: [
                      'Verify project exists in GitLab UI',
                      'Check if you have Developer/Maintainer access to the project',
                      'Try using project path format: "group/project"',
                      'Try using numeric project ID instead',
                      'Verify API token has correct permissions'
                    ]
                  }
                }, null, 2),
              },
            ],
          };
        }
      }

      // Create the merge request using GitLab API
      const endpoint = `projects/${normalizedProjectId}/merge_requests`;
      console.log(`🚀 Creating merge request at endpoint: ${endpoint}`);
      
      const response = await this.makeApiRequest(endpoint, {
        method: 'POST',
        data: requestData,
      });

      const mrData: MergeRequestResult = response.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              mergeRequest: {
                id: mrData.id,
                web_url: mrData.web_url,
                title: mrData.title,
                state: mrData.state,
                source_branch: mrData.source_branch,
                target_branch: mrData.target_branch,
                author: mrData.author,
              },
              message: `🎉 Merge request created successfully!`,
              projectInfo: {
                originalProjectId: projectId,
                normalizedProjectId: normalizedProjectId,
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Failed to create merge request:', error);
      
      // Enhanced error reporting
      let errorDetails: any = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `❌ Failed to create merge request`,
        projectInfo: {
          originalProjectId: projectId,
          normalizedProjectId: normalizedProjectId,
        },
        requestDetails: {
          endpoint: `projects/${normalizedProjectId}/merge_requests`,
          method: 'POST',
          sourceBranch,
          targetBranch,
          title: mrTitle
        }
      };

      // Add specific error handling for common GitLab API errors
      if (this.isAxiosError(error)) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        errorDetails.httpStatus = status;
        errorDetails.responseData = responseData;

        switch (status) {
          case 400:
            errorDetails.troubleshooting = [
              'Check if source branch exists',
              'Verify branch names are valid',
              'Ensure target branch exists',
              'Check if MR already exists for this branch'
            ];
            break;
          case 401:
            errorDetails.troubleshooting = [
              'Check API token validity',
              'Verify token has not expired',
              'Ensure token has correct permissions'
            ];
            break;
          case 403:
            errorDetails.troubleshooting = [
              'Check if you have push access to the project',
              'Verify you have permission to create merge requests',
              'Check if branch protection rules allow MR creation'
            ];
            break;
          case 404:
            errorDetails.troubleshooting = [
              'Verify project exists and you have access',
              'Check if source branch exists',
              'Try using different project ID format',
              'Verify GitLab API base URL is correct'
            ];
            break;
          case 409:
            errorDetails.troubleshooting = [
              'A merge request may already exist for this branch',
              'Check for conflicting branch names',
              'Verify source and target branches are different'
            ];
            break;
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorDetails, null, 2),
          },
        ],
      };
    }
  }

  private generateMRTitle(sourceBranch: string): string {
    // Extract feature name from branch name (similar to the script logic)
    let title = sourceBranch;
    
    // Remove common prefixes
    if (title.startsWith('feature/')) {
      title = title.replace('feature/', '');
    } else if (title.startsWith('feat/')) {
      title = title.replace('feat/', '');
    } else if (title.startsWith('bugfix/')) {
      title = title.replace('bugfix/', '');
      return `fix: ${title}`;
    } else if (title.startsWith('hotfix/')) {
      title = title.replace('hotfix/', '');
      return `fix: ${title}`;
    } else if (title.startsWith('docs/')) {
      title = title.replace('docs/', '');
      return `docs: ${title}`;
    } else if (title.startsWith('refactor/')) {
      title = title.replace('refactor/', '');
      return `refactor: ${title}`;
    }
    
    // Convert kebab-case or snake_case to readable title
    title = title
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    return `feat: ${title}`;
  }

  private async getCurrentBranch(args: any) {
    const { workingDirectory = process.cwd() } = args;

    try {
      const branchInfo = this.executeGitCommand('get_current_branch', workingDirectory);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(branchInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Failed to get current branch:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              isGitRepository: false,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getProjectInfo(args: any) {
    const { workingDirectory = process.cwd(), remoteName = 'origin' } = args;

    try {
      const projectInfo = this.executeGitCommand('get_project_info', workingDirectory, remoteName);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(projectInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Failed to get project info:', error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              isGitlabProject: false,
              remotes: [],
            }, null, 2),
          },
        ],
      };
    }
  }

  private executeGitCommand(command: string, workingDirectory: string, ...args: string[]): any {
    const originalCwd = process.cwd();
    
    try {
      // Change to the working directory
      process.chdir(workingDirectory);
      
      switch (command) {
        case 'get_current_branch':
          return this.getBranchInfo();
        case 'get_project_info':
          return this.getGitProjectInfo(args[0] || 'origin');
        default:
          throw new Error(`Unknown git command: ${command}`);
      }
    } finally {
      // Always restore original working directory
      process.chdir(originalCwd);
    }
  }

  private getBranchInfo(): GitBranchInfo {
    try {
      // Check if it's a git repository
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      
      // Get current branch
      const currentBranch = execSync('git branch --show-current', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim();
      
      // Get all branches
      const allBranchesOutput = execSync('git branch -a', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      const allBranches = allBranchesOutput
        .split('\n')
        .map(branch => branch.replace(/^\s*\*?\s*/, '').trim())
        .filter(branch => branch && !branch.startsWith('remotes/origin/HEAD'))
        .map(branch => branch.replace(/^remotes\/origin\//, ''));
      
      // Remove duplicates and current branch marker
      const uniqueBranches = [...new Set(allBranches)].filter(Boolean);
      
      // Get repository root
      const repositoryRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      return {
        currentBranch,
        allBranches: uniqueBranches,
        isGitRepository: true,
        repositoryRoot,
      };
    } catch (error) {
      return {
        currentBranch: '',
        allBranches: [],
        isGitRepository: false,
      };
    }
  }

  private getGitProjectInfo(remoteName: string): ProjectInfo {
    try {
      // Check if it's a git repository
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      
      // Get remote URLs
      const remotesOutput = execSync('git remote -v', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      const remotes: GitRemoteInfo[] = [];
      const remoteLines = remotesOutput.split('\n').filter(line => line.trim());
      
      for (const line of remoteLines) {
        const match = line.match(/^(\w+)\s+(.+?)\s+\((\w+)\)$/);
        if (match) {
          const [, name, url, type] = match;
          let remote = remotes.find(r => r.name === name);
          if (!remote) {
            remote = { name, url };
            remotes.push(remote);
          }
          if (type === 'fetch') {
            remote.fetch = url;
          } else if (type === 'push') {
            remote.push = url;
          }
        }
      }
      
      // Find the specified remote
      const targetRemote = remotes.find(r => r.name === remoteName);
      if (!targetRemote) {
        return {
          remotes,
          isGitlabProject: false,
        };
      }
      
      // Parse GitLab project info from remote URL
      const gitlabInfo = this.parseGitlabRemoteUrl(targetRemote.url);
      
      return {
        ...gitlabInfo,
        remotes,
        isGitlabProject: gitlabInfo.projectId !== undefined,
      };
    } catch (error) {
      return {
        remotes: [],
        isGitlabProject: false,
      };
    }
  }

  private parseGitlabRemoteUrl(url: string): Partial<ProjectInfo> {
    try {
      // Common GitLab URL patterns:
      // https://gitlab.com/group/project.git
      // git@gitlab.com:group/project.git
      // https://gitlab.example.com/group/subgroup/project.git
      
      let cleanUrl = url.replace(/\.git$/, '');
      let gitlabUrl = '';
      let projectPath = '';
      
      // Handle SSH format (git@hostname:path)
      const sshMatch = cleanUrl.match(/^git@([^:]+):(.+)$/);
      if (sshMatch) {
        const [, hostname, path] = sshMatch;
        gitlabUrl = `https://${hostname}`;
        projectPath = path;
      } else {
        // Handle HTTPS format
        const httpsMatch = cleanUrl.match(/^https?:\/\/([^\/]+)\/(.+)$/);
        if (httpsMatch) {
          const [, hostname, path] = httpsMatch;
          gitlabUrl = `https://${hostname}`;
          projectPath = path;
        }
      }
      
      if (!projectPath) {
        return {};
      }
      
      // For GitLab API, we can use the path directly as project ID
      // or try to determine the numeric ID if needed
      return {
        projectId: encodeURIComponent(projectPath),
        projectPath,
        gitlabUrl,
      };
    } catch (error) {
      return {};
    }
  }

  private normalizeProjectId(projectId: string): string | null {
    if (!projectId || typeof projectId !== 'string') {
      return null;
    }

    const trimmedId = projectId.trim();
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(trimmedId)) {
      return trimmedId;
    }
    
    // Check if it's a valid project path format (group/project or group/subgroup/project)
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(trimmedId)) {
      // For project paths, use URL encoding but be more careful
      // GitLab API expects URL encoding for paths but not for numeric IDs
      return encodeURIComponent(trimmedId);
    }
    
    // If it looks like it might already be encoded, try to use it as-is
    if (trimmedId.includes('%')) {
      return trimmedId;
    }
    
    return null;
  }

  private isAxiosError(error: any): error is AxiosError {
    return error && error.isAxiosError === true;
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
