#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { CodeAnalyzer } from './code-analyzer.js';
import { ApiClient } from './api-client.js';
import { CodeAnalysisResult, ApiRequestOptions, CreateMergeRequestOptions, MergeRequestResult, GitBranchInfo, GitRemoteInfo, ProjectInfo } from './types.js';
import { SafeStdioServerTransport } from './safe-stdio-transport.js';

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

type ProjectIdResolutionSource = 'input' | 'git_remote' | 'search';

interface ProjectIdCandidate {
  rawProjectId: string;
  normalizedProjectId: string;
  source: ProjectIdResolutionSource;
  metadata?: Record<string, any>;
}

interface ProjectAttemptRecord {
  candidate: ProjectIdCandidate;
  success: boolean;
  status?: number;
  errorMessage?: string;
  projectData?: {
    id?: number;
    name?: string;
    path_with_namespace?: string;
    web_url?: string;
    visibility?: string;
  };
}

interface ProjectResolutionResult {
  success: boolean;
  rawProjectId?: string;
  normalizedProjectId?: string;
  source?: ProjectIdResolutionSource;
  projectData?: any;
  attempts: ProjectAttemptRecord[];
  providedProjectId?: string;
  reason?: 'invalid_format' | 'not_found' | 'not_detected';
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
                  default: 'gitlab',
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
                  default: 'gitlab',
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
                  default: 'gitlab',
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
                  default: 'gitlab',
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
            description: 'Get list of files changed in a pull request or merge request',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository/project identifier (e.g., "owner/repo" or "group/project"). Optional if workingDirectory is provided.',
                },
                pullRequestNumber: {
                  type: ['number', 'string'],
                  description: 'Pull request number (IID). Optional if mergeRequestIid is provided.',
                },
                mergeRequestIid: {
                  type: ['number', 'string'],
                  description: 'Merge request IID (GitLab). Optional if pullRequestNumber is provided.',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (github or gitlab)',
                  default: 'gitlab',
                },
                workingDirectory: {
                  type: 'string',
                  description: 'Local repository path for auto-detecting project ID (aliases: working_directory, cwd)',
                },
                remoteName: {
                  type: 'string',
                  description: 'Git remote name used for auto-detecting the project ID',
                  default: 'origin',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_merge_request_changes',
            description: 'Get merge request changes (GitLab compatibility alias)',
            inputSchema: {
              type: 'object',
              properties: {
                repository: {
                  type: 'string',
                  description: 'Repository/project identifier (e.g., "group/project"). Optional if workingDirectory is provided.',
                },
                pullRequestNumber: {
                  type: ['number', 'string'],
                  description: 'Pull/MR number (IID). Optional if mergeRequestIid is provided.',
                },
                mergeRequestIid: {
                  type: ['number', 'string'],
                  description: 'Merge request IID (GitLab). Optional if pullRequestNumber is provided.',
                },
                provider: {
                  type: 'string',
                  enum: ['github', 'gitlab'],
                  description: 'Git provider (default gitlab)',
                  default: 'gitlab',
                },
                workingDirectory: {
                  type: 'string',
                  description: 'Local repository path for auto-detecting project ID (aliases: working_directory, cwd)',
                },
                remoteName: {
                  type: 'string',
                  description: 'Git remote name used for auto-detecting the project ID',
                  default: 'origin',
                },
              },
              required: [],
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
            name: 'get_merge_request',
            description: 'Get information about a specific GitLab merge request',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: {
                  type: 'string',
                  description: 'GitLab project ID or path (aliases: project_id, project_path; e.g., "12345" or "group/project")',
                },
                mergeRequestIid: {
                  type: 'string',
                  description: 'Merge request IID (aliases: merge_request_iid; the number in the MR URL, not the database ID)',
                },
                workingDirectory: {
                  type: 'string',
                  description: 'Local repository path for auto-detecting project ID (aliases: working_directory, cwd)',
                },
                remoteName: {
                  type: 'string',
                  description: 'Git remote name used for auto-detecting the project ID',
                  default: 'origin',
                },
              },
              required: ['mergeRequestIid'],
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
                  description: 'GitLab project ID or path (aliases: project_id, project_path; e.g., "12345" or "group/project")',
                },
                sourceBranch: {
                  type: 'string',
                  description: 'Source branch name (aliases: source_branch; e.g., "feature/new-feature")',
                },
                targetBranch: {
                  type: 'string',
                  description: 'Target branch name (aliases: target_branch; defaults to "main")',
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
                workingDirectory: {
                  type: 'string',
                  description: 'Local repository path for auto-detecting project ID (aliases: working_directory, cwd)',
                },
                remoteName: {
                  type: 'string',
                  description: 'Git remote name used for auto-detecting the project ID',
                  default: 'origin',
                },
              },
              required: ['sourceBranch'],
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
          case 'get_merge_request_changes':
            return await this.getMergeRequestChanges(args);
          case 'get_server_config':
            return await this.getServerConfig();
          case 'get_merge_request':
            return await this.getMergeRequest(args);
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
    const provider =
      this.coerceToString(this.getArgumentValue(args, ['provider'])) ??
      'gitlab';

    let repository = this.coerceToString(
      this.getArgumentValue(args, [
        'repository',
        'project',
        'projectId',
        'project_id',
        'project_path',
        'projectPath',
      ])
    );

    let pullRequestIdentifier = this.coerceToString(
      this.getArgumentValue(args, [
        'pullRequestNumber',
        'pull_request_number',
        'pullRequestId',
        'pull_request_id',
        'mergeRequestIid',
        'merge_request_iid',
        'mergeRequestId',
        'merge_request_id',
      ])
    );

    if (provider === 'gitlab') {
      const enhancedContext = this.enhanceGitlabMergeRequestContext(args, {
        projectId: repository,
        mergeRequestIid: pullRequestIdentifier,
      });
      repository = enhancedContext.projectId ?? repository;
      pullRequestIdentifier =
        enhancedContext.mergeRequestIid ?? pullRequestIdentifier;
    }

    if (!pullRequestIdentifier) {
      throw new Error(
        'Pull request number (pullRequestNumber or mergeRequestIid) is required'
      );
    }

    let endpoint: string;
    if (provider === 'github') {
      if (!repository) {
        throw new Error('Repository is required for GitHub provider');
      }
      endpoint = `repos/${repository}/pulls/${pullRequestIdentifier}`;
    } else if (provider === 'gitlab') {
      const projectResolution = await this.resolveGitlabProjectId(
        args,
        repository
      );

      if (!projectResolution.success) {
        const resolutionDetails =
          this.formatProjectResolutionDetails(projectResolution);
        const { errorTitle, message, suggestions } =
          this.buildProjectResolutionError(projectResolution, 'fetch');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: errorTitle,
                  message,
                  details: resolutionDetails,
                  suggestions,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      
      const normalizedProjectId = projectResolution.normalizedProjectId!;
      endpoint = `projects/${normalizedProjectId}/merge_requests/${pullRequestIdentifier}`;
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
    const provider =
      this.coerceToString(this.getArgumentValue(args, ['provider'])) ??
      'gitlab';
    let repository = this.coerceToString(
      this.getArgumentValue(args, [
        'repository',
        'project',
        'projectId',
        'project_id',
        'project_path',
        'projectPath',
      ])
    );
    let pullRequestNumber = this.coerceToString(
      this.getArgumentValue(args, [
        'pullRequestNumber',
        'pull_request_number',
        'mergeRequestIid',
        'merge_request_iid',
        'mergeRequestId',
        'merge_request_id',
      ])
    );
    const commitSha = this.coerceToString(
      this.getArgumentValue(args, ['commitSha', 'commit_sha', 'sha'])
    );
    const filePath = this.coerceToString(
      this.getArgumentValue(args, ['filePath', 'file_path', 'path'])
    );

    if (provider === 'gitlab') {
      const enhancedContext = this.enhanceGitlabMergeRequestContext(args, {
        projectId: repository,
        mergeRequestIid: pullRequestNumber,
      });
      repository = enhancedContext.projectId ?? repository;
      pullRequestNumber =
        enhancedContext.mergeRequestIid ?? pullRequestNumber;
    }

    let endpoint: string;
    if (provider === 'github') {
      if (!repository) {
        throw new Error('Repository is required for GitHub requests');
      }
      if (pullRequestNumber) {
        endpoint = `repos/${repository}/pulls/${pullRequestNumber}/files`;
      } else if (commitSha) {
        endpoint = `repos/${repository}/commits/${commitSha}`;
      } else {
        throw new Error('Either pullRequestNumber or commitSha must be provided');
      }
    } else if (provider === 'gitlab') {
      if (!repository) {
        throw new Error('Project ID or path is required for GitLab requests');
      }
      if (pullRequestNumber) {
        endpoint = `projects/${encodeURIComponent(
          repository
        )}/merge_requests/${pullRequestNumber}/changes`;
      } else if (commitSha) {
        endpoint = `projects/${encodeURIComponent(
          repository
        )}/repository/commits/${commitSha}/diff`;
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
      data = data.filter(
        (file: any) =>
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
    const provider =
      this.coerceToString(this.getArgumentValue(args, ['provider'])) ??
      'gitlab';
    let repository = this.coerceToString(
      this.getArgumentValue(args, [
        'repository',
        'project',
        'projectId',
        'project_id',
        'project_path',
        'projectPath',
      ])
    );
    let pullRequestNumber = this.coerceToString(
      this.getArgumentValue(args, [
        'pullRequestNumber',
        'pull_request_number',
        'pullRequestId',
        'pull_request_id',
        'mergeRequestIid',
        'merge_request_iid',
        'mergeRequestId',
        'merge_request_id',
        'iid',
      ])
    );
    const body = this.coerceToString(this.getArgumentValue(args, ['body']));
    const filePath = this.coerceToString(
      this.getArgumentValue(args, ['filePath', 'file_path'])
    );
    const line = this.coerceToNumber(
      this.getArgumentValue(args, ['line', 'lineNumber', 'line_number'])
    );

    if (!body) {
      throw new Error('Comment body is required');
    }

    if (provider === 'gitlab') {
      const enhancedContext = this.enhanceGitlabMergeRequestContext(args, {
        projectId: repository,
        mergeRequestIid: pullRequestNumber,
      });
      repository = enhancedContext.projectId ?? repository;
      pullRequestNumber =
        enhancedContext.mergeRequestIid ?? pullRequestNumber;
    }

    if (!pullRequestNumber) {
      throw new Error(
        'Pull request or merge request identifier is required to add a comment'
      );
    }

    let endpoint: string;
    let requestData: any;

    if (provider === 'github') {
      if (!repository) {
        throw new Error('Repository is required for GitHub requests');
      }
      if (filePath && line !== undefined) {
        endpoint = `repos/${repository}/pulls/${pullRequestNumber}/reviews`;
        requestData = {
          body,
          event: 'COMMENT',
          comments: [
            {
              path: filePath,
              line,
              body,
            },
          ],
        };
      } else {
        endpoint = `repos/${repository}/issues/${pullRequestNumber}/comments`;
        requestData = { body };
      }
    } else if (provider === 'gitlab') {
      if (!repository) {
        throw new Error('Project ID or path is required for GitLab requests');
      }
      endpoint = `projects/${encodeURIComponent(
        repository
      )}/merge_requests/${pullRequestNumber}/notes`;
      requestData = { body };

      if (filePath && line !== undefined) {
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
    const { repository, provider = 'gitlab' } = args;

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
    const provider =
      this.coerceToString(this.getArgumentValue(args, ['provider'])) ??
      'gitlab';
    let repository = this.coerceToString(
      this.getArgumentValue(args, [
        'repository',
        'project',
        'projectId',
        'project_id',
        'project_path',
        'projectPath',
      ])
    );
    let pullRequestNumber = this.coerceToString(
      this.getArgumentValue(args, [
        'pullRequestNumber',
        'pull_request_number',
        'pullRequestId',
        'pull_request_id',
        'mergeRequestIid',
        'merge_request_iid',
        'mergeRequestId',
        'merge_request_id',
      ])
    );

    if (provider === 'gitlab') {
      const enhancedContext = this.enhanceGitlabMergeRequestContext(args, {
        projectId: repository,
        mergeRequestIid: pullRequestNumber,
      });
      repository = enhancedContext.projectId ?? repository;
      pullRequestNumber =
        enhancedContext.mergeRequestIid ?? pullRequestNumber;
    }

    if (!pullRequestNumber) {
      throw new Error(
        'Pull request or merge request identifier is required to list files'
      );
    }

    let endpoint: string;
    if (provider === 'github') {
      if (!repository) {
        throw new Error('Repository is required for GitHub requests');
      }
      endpoint = `repos/${repository}/pulls/${pullRequestNumber}/files`;
    } else if (provider === 'gitlab') {
      if (!repository) {
        throw new Error('Project ID or path is required for GitLab requests');
      }
      endpoint = `projects/${encodeURIComponent(
        repository
      )}/merge_requests/${pullRequestNumber}/changes`;
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

  private async getMergeRequestChanges(args: any) {
    return this.getPullRequestFiles(args);
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

  private async getMergeRequest(args: any) {
    let rawProjectIdInput = this.coerceToString(
      this.getArgumentValue(args, [
        'projectId',
        'project_id',
        'project',
        'projectPath',
        'project_path',
        'repository',
        'repository_path',
      ])
    );
    let mergeRequestIid = this.coerceToString(
      this.getArgumentValue(args, [
        'mergeRequestIid',
        'merge_request_iid',
        'mergeRequestIID',
        'merge_request_IID',
        'iid',
        'pullRequestNumber',
        'pull_request_number',
        'mergeRequestId',
        'merge_request_id',
      ])
    );

    const enhancedContext = this.enhanceGitlabMergeRequestContext(args, {
      projectId: rawProjectIdInput,
      mergeRequestIid,
    });
    rawProjectIdInput = enhancedContext.projectId ?? rawProjectIdInput;
    mergeRequestIid = enhancedContext.mergeRequestIid ?? mergeRequestIid;

    if (!mergeRequestIid) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Missing merge request IID',
              message: '❌ Please provide mergeRequestIid (e.g., "42")',
              suggestions: [
                'The IID is the number visible in the merge request URL',
                'Pass mergeRequestIid or merge_request_iid in the tool arguments'
              ]
            }, null, 2),
          },
        ],
      };
    }

    const projectResolution = await this.resolveGitlabProjectId(
      args,
      rawProjectIdInput
    );

    if (!projectResolution.success) {
      const resolutionDetails =
        this.formatProjectResolutionDetails(projectResolution);
      const { errorTitle, message, suggestions } =
        this.buildProjectResolutionError(projectResolution, 'fetch');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: errorTitle,
                message,
                details: resolutionDetails,
                suggestions,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const normalizedProjectId = projectResolution.normalizedProjectId!;
    const resolvedRawProjectId = projectResolution.rawProjectId!;
    const projectInfoDetails =
      this.formatProjectResolutionDetails(projectResolution);

    if (projectResolution.source && projectResolution.source !== 'input') {
      console.warn(
        `ℹ️ Resolved project ID via ${projectResolution.source}: ${resolvedRawProjectId}`
      );
    }

    try {
      // Fetch merge request details from GitLab API
      const endpoint = `projects/${normalizedProjectId}/merge_requests/${mergeRequestIid}`;
      console.warn(`🔍 Fetching merge request at endpoint: ${endpoint}`);
      
      const response = await this.makeApiRequest(endpoint);

      const mrData = response.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              mergeRequest: {
                id: mrData.id,
                iid: mrData.iid,
                title: mrData.title,
                description: mrData.description,
                state: mrData.state,
                source_branch: mrData.source_branch,
                target_branch: mrData.target_branch,
                author: mrData.author,
                web_url: mrData.web_url,
                created_at: mrData.created_at,
                updated_at: mrData.updated_at,
                notes_count: mrData.notes_count,
                commits_count: mrData.commits_count,
                changes_count: mrData.changes_count,
                merge_status: mrData.merge_status,
                approvals_before_merge: mrData.approvals_before_merge,
                approved_by: mrData.approved_by,
                reviewers: mrData.reviewers,
                assignees: mrData.assignees,
                labels: mrData.labels,
                milestone: mrData.milestone,
                user: mrData.user,
              },
              message: `📋 Merge request fetched successfully!`,
              projectInfo: projectInfoDetails,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Failed to fetch merge request:', error);
      
      // Enhanced error reporting
      let errorDetails: any = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `❌ Failed to fetch merge request`,
        projectInfo: projectInfoDetails,
        requestDetails: {
          endpoint: `projects/${normalizedProjectId}/merge_requests/${mergeRequestIid}`,
          method: 'GET'
        }
      };

      // Add specific error handling for common GitLab API errors
      if (this.isAxiosError(error)) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        errorDetails.httpStatus = status;
        errorDetails.responseData = responseData;

        switch (status) {
          case 401:
            errorDetails.troubleshooting = [
              'Check API token validity',
              'Verify token has not expired',
              'Ensure token has correct permissions'
            ];
            break;
          case 403:
            errorDetails.troubleshooting = [
              'Check if you have read access to the project',
              'Verify you have permission to view merge requests',
              'Check if the merge request is private'
            ];
            break;
          case 404:
            errorDetails.troubleshooting = [
              'Verify project exists and you have access',
              'Check if merge request IID is correct',
              'Verify the merge request has not been deleted',
              'Try using different project ID format'
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

  private async createMergeRequest(args: any) {
    const rawProjectIdInput = this.coerceToString(
      this.getArgumentValue(args, [
        'projectId',
        'project_id',
        'project',
        'projectPath',
        'project_path',
      ])
    );

    const sourceBranchInput = this.coerceToString(
      this.getArgumentValue(args, [
        'sourceBranch',
        'source_branch',
        'source',
      ])
    );

    const targetBranch =
      this.coerceToString(
        this.getArgumentValue(args, [
          'targetBranch',
          'target_branch',
          'destinationBranch',
          'destination_branch',
        ])
      ) ?? 'main';

    const title = this.coerceToString(
      this.getArgumentValue(args, [
        'title',
        'mr_title',
        'mergeRequestTitle',
      ])
    );

    const description = this.coerceToString(
      this.getArgumentValue(args, [
        'description',
        'body',
        'mergeRequestDescription',
      ])
    );

    const assigneeId = this.coerceToNumber(
      this.getArgumentValue(args, [
        'assigneeId',
        'assignee_id',
        'assignee',
      ])
    );

    const reviewerIds = this.coerceToNumberArray(
      this.getArgumentValue(args, [
        'reviewerIds',
        'reviewer_ids',
        'reviewers',
      ])
    );

    const deleteSourceBranch = this.coerceToBoolean(
      this.getArgumentValue(args, [
        'deleteSourceBranch',
        'delete_source_branch',
        'removeSourceBranch',
        'remove_source_branch',
      ]),
      false
    );

    const squash = this.coerceToBoolean(
      this.getArgumentValue(args, [
        'squash',
        'shouldSquash',
        'squash_commits',
      ]),
      false
    );

    const sourceBranch = sourceBranchInput?.trim();
    if (!sourceBranch) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: 'Missing source branch',
                message:
                  '❌ Please provide sourceBranch (e.g., "feature/my-feature")',
                suggestions: [
                  'Pass sourceBranch or source_branch in the tool arguments',
                  'Ensure the branch exists in the GitLab project',
                ],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const projectResolution = await this.resolveGitlabProjectId(
      args,
      rawProjectIdInput
    );

    if (!projectResolution.success) {
      const resolutionDetails =
        this.formatProjectResolutionDetails(projectResolution);
      const { errorTitle, message, suggestions } =
        this.buildProjectResolutionError(projectResolution, 'create');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: errorTitle,
                message,
                details: resolutionDetails,
                suggestions,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const normalizedProjectId = projectResolution.normalizedProjectId!;
    const resolvedRawProjectId = projectResolution.rawProjectId!;
    const projectInfoDetails =
      this.formatProjectResolutionDetails(projectResolution);

    if (projectResolution.source && projectResolution.source !== 'input') {
      console.warn(
        `ℹ️ Resolved project ID via ${projectResolution.source}: ${resolvedRawProjectId}`
      );
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

    if (assigneeId !== undefined) {
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
      const endpoint = `projects/${normalizedProjectId}/merge_requests`;
      console.warn(`🚀 Creating merge request at endpoint: ${endpoint}`);

      const response = await this.makeApiRequest(endpoint, {
        method: 'POST',
        data: requestData,
      });

      const mrData: MergeRequestResult = response.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
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
                projectInfo: projectInfoDetails,
                requestData,
                responseData: response.data,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Failed to create merge request:', error);

      // Enhanced error reporting
      const errorDetails: any = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `❌ Failed to create merge request`,
        projectInfo: projectInfoDetails,
        requestDetails: {
          endpoint: `projects/${normalizedProjectId}/merge_requests`,
          method: 'POST',
          sourceBranch,
          targetBranch,
          title: mrTitle,
          deleteSourceBranch,
          squash,
        },
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
              'Check if MR already exists for this branch',
            ];
            break;
          case 401:
            errorDetails.troubleshooting = [
              'Check API token validity',
              'Verify token has not expired',
              'Ensure token has correct permissions',
            ];
            break;
          case 403:
            errorDetails.troubleshooting = [
              'Check if you have push access to the project',
              'Verify you have permission to create merge requests',
              'Check if branch protection rules allow MR creation',
            ];
            break;
          case 404:
            errorDetails.troubleshooting = [
              'Verify project exists and you have access',
              'Check if source branch exists',
              'Try using different project ID format',
              'Verify GitLab API base URL is correct',
            ];
            break;
          case 409:
            errorDetails.troubleshooting = [
              'A merge request may already exist for this branch',
              'Check for conflicting branch names',
              'Verify source and target branches are different',
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

  private enhanceGitlabMergeRequestContext(
    args: any,
    context: { projectId?: string | null; mergeRequestIid?: string | null }
  ): { projectId?: string; mergeRequestIid?: string } {
    const mergeRequestUrl = this.coerceToString(
      this.getArgumentValue(args, [
        'mergeRequestUrl',
        'merge_request_url',
        'mergeRequestLink',
        'merge_request_link',
        'mrUrl',
        'mr_url',
        'pullRequestUrl',
        'pull_request_url',
        'prUrl',
        'pr_url',
        'url',
      ])
    );

    const projectUrl = this.coerceToString(
      this.getArgumentValue(args, [
        'projectUrl',
        'project_url',
        'repositoryUrl',
        'repository_url',
        'repoUrl',
        'repo_url',
        'gitlabUrl',
        'gitlab_url',
      ])
    );

    const candidates = [
      context.projectId,
      mergeRequestUrl,
      projectUrl,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    let projectId = context.projectId ?? undefined;
    let mergeRequestIid = context.mergeRequestIid ?? undefined;

    for (const candidate of candidates) {
      const parsed = this.parseGitlabReferenceString(candidate);
      if (!parsed) {
        continue;
      }

      if (parsed.projectPath && !projectId) {
        projectId = parsed.projectPath;
      }
      if (parsed.mergeRequestIid && !mergeRequestIid) {
        mergeRequestIid = parsed.mergeRequestIid;
      }

      if (projectId && mergeRequestIid) {
        break;
      }
    }

    return { projectId, mergeRequestIid };
  }

  private parseGitlabReferenceString(
    value?: string | null
  ): { projectPath?: string; mergeRequestIid?: string } | null {
    if (!value) {
      return null;
    }

    let trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Remove surrounding quotes that sometimes sneak in from CLI tools
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1);
    }

    let mergeRequestIid: string | undefined;

    const normalizePath = (input: string) => {
      let cleaned = input.replace(/^\/+/, '').replace(/[?#].*$/, '');
      cleaned = cleaned.replace(/\.git$/i, '');

      if (!cleaned) {
        return '';
      }

      const segments = cleaned
        .split('/')
        .filter(Boolean)
        .map((segment) => {
          try {
            return decodeURIComponent(segment);
          } catch {
            return segment;
          }
        });

      return segments.join('/');
    };

    const parsePotentialUrl = (input: string): string => {
      try {
        const parsedUrl = new URL(input);
        return parsedUrl.pathname || '';
      } catch {
        return input;
      }
    };

    const parseSshPath = (input: string): string => {
      const sshMatch = input.match(/^git@[^:]+:(.+)$/);
      return sshMatch ? sshMatch[1] : input;
    };

    const extractMergeRequestFromPath = (input: string) => {
      const mrMatch = input.match(/(.+?)\/-\/merge_requests\/(\d+)(?:\/.*)?$/i);
      if (mrMatch) {
        return { path: mrMatch[1], iid: mrMatch[2] };
      }

      const fallbackMatch = input.match(/(.+?)\/merge_requests\/(\d+)(?:\/.*)?$/i);
      if (fallbackMatch) {
        return { path: fallbackMatch[1], iid: fallbackMatch[2] };
      }

      return { path: input };
    };

    let pathCandidate = parsePotentialUrl(trimmed);
    pathCandidate = parseSshPath(pathCandidate);

    const extracted = extractMergeRequestFromPath(pathCandidate);
    if (extracted.iid) {
      mergeRequestIid = extracted.iid;
    }

    const normalizedPath = normalizePath(extracted.path);
    if (!normalizedPath && !mergeRequestIid) {
      return null;
    }

    return {
      projectPath: normalizedPath || undefined,
      mergeRequestIid,
    };
  }

  private getArgumentValue<T = any>(args: Record<string, any> | undefined, keys: string[], defaultValue?: T): T | undefined {
    if (!args) {
      return defaultValue;
    }
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined) {
        return args[key];
      }
    }
    return defaultValue;
  }

  private coerceToString(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  }

  private coerceToBoolean(value: unknown, defaultValue = false): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
      }
    }
    return defaultValue;
  }

  private coerceToNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number') {
      return Number.isNaN(value) ? undefined : value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private coerceToNumberArray(value: unknown): number[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (Array.isArray(value)) {
      const parsed = value
        .map((item) => this.coerceToNumber(item))
        .filter((item): item is number => item !== undefined);
      return parsed.length > 0 ? parsed : undefined;
    }
    if (typeof value === 'string') {
      const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const parsed = parts
        .map((part) => this.coerceToNumber(part))
        .filter((item): item is number => item !== undefined);
      return parsed.length > 0 ? parsed : undefined;
    }
    const single = this.coerceToNumber(value);
    return single !== undefined ? [single] : undefined;
  }

  private getWorkingDirectoryArg(args: any): string | undefined {
    const candidate = this.coerceToString(
      this.getArgumentValue(args, [
        'workingDirectory',
        'working_directory',
        'cwd',
      ])
    );

    if (candidate && existsSync(candidate)) {
      return candidate;
    }

    return undefined;
  }

  private getRemoteNameArg(args: any): string {
    return (
      this.coerceToString(
        this.getArgumentValue(args, ['remoteName', 'remote_name', 'remote'])
      ) ?? 'origin'
    );
  }

  private getApiHost(): string | null {
    try {
      if (!this.config.apiBaseUrl) {
        return null;
      }
      return new URL(this.config.apiBaseUrl).host;
    } catch {
      return null;
    }
  }

  private getProjectCandidateFromGit(args: any): ProjectIdCandidate | null {
    const workingDirectory = this.getWorkingDirectoryArg(args) ?? process.cwd();
    const remoteName = this.getRemoteNameArg(args);

    try {
      const projectInfo = this.executeGitCommand(
        'get_project_info',
        workingDirectory,
        remoteName
      ) as ProjectInfo;

      if (!projectInfo?.isGitlabProject || !projectInfo.projectId) {
        return null;
      }

      const apiHost = this.getApiHost();
      if (apiHost && projectInfo.gitlabUrl) {
        try {
          const remoteHost = new URL(projectInfo.gitlabUrl).host;
          if (remoteHost !== apiHost) {
            return null;
          }
        } catch {
          // Ignore parsing errors and fall through
        }
      }

      return {
        rawProjectId:
          projectInfo.projectPath ?? decodeURIComponent(projectInfo.projectId),
        normalizedProjectId: projectInfo.projectId,
        source: 'git_remote',
        metadata: {
          workingDirectory,
          remoteName,
        },
      };
    } catch (error) {
      console.warn(
        'Failed to detect project from git remote:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async getProjectCandidateFromSearch(
    projectIdentifier?: string
  ): Promise<ProjectIdCandidate | null> {
    if (!projectIdentifier) {
      return null;
    }

    const trimmed = projectIdentifier.trim();
    if (!trimmed) {
      return null;
    }

    const decodedIdentifier = decodeURIComponent(trimmed);
    const segments = decodedIdentifier.split('/').filter(Boolean);
    const searchTerm = segments.length > 0 ? segments[segments.length - 1] : '';
    if (!searchTerm) {
      return null;
    }

    const endpoint = `projects?search=${encodeURIComponent(
      searchTerm
    )}&simple=true&per_page=20`;

    try {
      const response = await this.makeApiRequest(endpoint);
      const projects = Array.isArray(response.data) ? response.data : [];

      if (projects.length === 0) {
        return null;
      }

      const providedLower = decodedIdentifier.toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const exactMatch = projects.find(
        (project: any) =>
          typeof project?.path_with_namespace === 'string' &&
          project.path_with_namespace.toLowerCase() === providedLower
      );

      const pathMatch = projects.find(
        (project: any) =>
          typeof project?.path === 'string' &&
          project.path.toLowerCase() === searchLower
      );

      const nameMatch = projects.find(
        (project: any) =>
          typeof project?.name === 'string' &&
          project.name.toLowerCase() === searchLower
      );

      const candidateProject =
        exactMatch ?? pathMatch ?? nameMatch ?? projects[0];

      if (
        !candidateProject ||
        typeof candidateProject?.path_with_namespace !== 'string'
      ) {
        return null;
      }

      return {
        rawProjectId: candidateProject.path_with_namespace,
        normalizedProjectId: encodeURIComponent(
          candidateProject.path_with_namespace
        ),
        source: 'search',
        metadata: {
          searchTerm,
          projectId: candidateProject.id,
          resultCount: projects.length,
        },
      };
    } catch (error) {
      console.warn(
        'GitLab project search failed:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async verifyProjectCandidate(
    candidate: ProjectIdCandidate,
    attempts: ProjectAttemptRecord[]
  ): Promise<{ verified: boolean; status?: number; projectData?: any }> {
    try {
      const response = await this.makeApiRequest(
        `projects/${candidate.normalizedProjectId}`
      );
      const projectData = response.data;

      attempts.push({
        candidate,
        success: true,
        status: response.status,
        projectData: projectData
          ? {
              id: projectData.id,
              name: projectData.name,
              path_with_namespace: projectData.path_with_namespace,
              web_url: projectData.web_url,
              visibility: projectData.visibility,
            }
          : undefined,
      });

      return {
        verified: true,
        status: response.status,
        projectData,
      };
    } catch (error) {
      let status: number | undefined;
      let errorMessage: string | undefined;

      if (this.isAxiosError(error)) {
        status = error.response?.status;
        const responseData: any = error.response?.data;
        errorMessage =
          (responseData && (responseData.message || responseData.error)) ||
          error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      attempts.push({
        candidate,
        success: false,
        status,
        errorMessage,
      });

      if (status && status !== 404) {
        throw error;
      }

      return {
        verified: false,
        status,
      };
    }
  }

  private async getFallbackProjectCandidates(
    args: any,
    options: {
      allowSearch: boolean;
      providedProjectId?: string;
      excludeNormalized?: string;
    }
  ): Promise<ProjectIdCandidate[]> {
    const candidates: ProjectIdCandidate[] = [];

    const gitCandidate = this.getProjectCandidateFromGit(args);
    if (
      gitCandidate &&
      gitCandidate.normalizedProjectId !== options.excludeNormalized
    ) {
      candidates.push(gitCandidate);
    }

    const searchIdentifier =
      options.providedProjectId ?? gitCandidate?.rawProjectId;

    if (options.allowSearch && searchIdentifier) {
      const searchCandidate = await this.getProjectCandidateFromSearch(
        searchIdentifier
      );

      if (
        searchCandidate &&
        searchCandidate.normalizedProjectId !== options.excludeNormalized &&
        !candidates.some(
          (candidate) =>
            candidate.normalizedProjectId === searchCandidate.normalizedProjectId
        )
      ) {
        candidates.push(searchCandidate);
      }
    }

    return candidates;
  }

  private async resolveGitlabProjectId(
    args: any,
    rawProjectIdInput?: string | null,
    options: { allowSearch?: boolean } = {}
  ): Promise<ProjectResolutionResult> {
    const allowSearch = options.allowSearch !== false;
    const attempts: ProjectAttemptRecord[] = [];
    const seenNormalized = new Set<string>();
    const queue: ProjectIdCandidate[] = [];
    const providedProjectId = rawProjectIdInput ?? undefined;
    const normalizedProvidedProjectId = rawProjectIdInput
      ? this.normalizeProjectId(rawProjectIdInput)
      : null;
    let fallbackCandidatesQueued = false;

    const enqueueCandidate = (
      candidate: ProjectIdCandidate | null | undefined
    ) => {
      if (
        !candidate ||
        !candidate.normalizedProjectId ||
        seenNormalized.has(candidate.normalizedProjectId)
      ) {
        return;
      }
      seenNormalized.add(candidate.normalizedProjectId);
      queue.push(candidate);
    };

    if (normalizedProvidedProjectId) {
      enqueueCandidate({
        rawProjectId: rawProjectIdInput!,
        normalizedProjectId: normalizedProvidedProjectId,
        source: 'input',
        metadata: {
          decodedProjectPath: decodeURIComponent(normalizedProvidedProjectId),
        },
      });
    }

    if (queue.length === 0) {
      const fallbackCandidates = await this.getFallbackProjectCandidates(args, {
        allowSearch,
        providedProjectId,
      });
      fallbackCandidates.forEach(enqueueCandidate);
      if (fallbackCandidates.length > 0) {
        fallbackCandidatesQueued = true;
      }
    }

    while (queue.length > 0) {
      const candidate = queue.shift()!;
      const verification = await this.verifyProjectCandidate(
        candidate,
        attempts
      );

      if (verification.verified) {
        return {
          success: true,
          rawProjectId: candidate.rawProjectId,
          normalizedProjectId: candidate.normalizedProjectId,
          source: candidate.source,
          projectData: verification.projectData,
          attempts,
          providedProjectId,
        };
      }

      if (verification.status === 404 && !fallbackCandidatesQueued) {
        const fallbackCandidates = await this.getFallbackProjectCandidates(
          args,
          {
            allowSearch,
            providedProjectId,
            excludeNormalized: candidate.normalizedProjectId,
          }
        );
        if (fallbackCandidates.length > 0) {
          fallbackCandidates.forEach(enqueueCandidate);
          fallbackCandidatesQueued = true;
        }
      }
    }

    let reason: ProjectResolutionResult['reason'] = undefined;
    if (providedProjectId && !normalizedProvidedProjectId) {
      reason = 'invalid_format';
    } else if (attempts.some((attempt) => attempt.status === 404)) {
      reason = 'not_found';
    } else if (attempts.length === 0) {
      reason = 'not_detected';
    }

    return {
      success: false,
      attempts,
      providedProjectId,
      reason,
    };
  }

  private formatProjectResolutionDetails(
    resolution: ProjectResolutionResult
  ) {
    return {
      providedProjectId: resolution.providedProjectId,
      resolvedProjectId: resolution.rawProjectId,
      normalizedProjectId: resolution.normalizedProjectId,
      resolutionSource: resolution.source,
      reason: resolution.reason,
      attempts: resolution.attempts.map((attempt) => ({
        source: attempt.candidate.source,
        rawProjectId: attempt.candidate.rawProjectId,
        normalizedProjectId: attempt.candidate.normalizedProjectId,
        success: attempt.success,
        status: attempt.status,
        errorMessage: attempt.errorMessage,
        projectId: attempt.projectData?.id,
        projectPath: attempt.projectData?.path_with_namespace,
        projectName: attempt.projectData?.name,
        projectVisibility: attempt.projectData?.visibility,
      })),
    };
  }

  private buildProjectResolutionError(
    resolution: ProjectResolutionResult,
    context: 'fetch' | 'create'
  ) {
    const baseMessage =
      context === 'fetch'
        ? '❌ Unable to resolve project ID from provided parameters or git remotes'
        : '❌ Unable to resolve project ID needed to create merge request';

    let errorTitle = 'Project Resolution Failed';
    let message = baseMessage;
    let suggestions: string[] = [
      'Verify the project exists and you have access',
      'Provide projectId in format "group/project"',
      'Try using numeric project ID (e.g., "12345")',
    ];

    switch (resolution.reason) {
      case 'invalid_format':
        errorTitle = 'Invalid project ID format';
        message =
          '❌ Project ID should be in format "group/project" or numeric ID like "12345"';
        suggestions = [
          'Use project path format: "mygroup/myproject"',
          'Run tool with workingDirectory so the project can be auto-detected from git remote',
          'Use numeric project ID: "12345"',
        ];
        break;
      case 'not_detected':
        errorTitle = 'Project auto-detection failed';
        message =
          '❌ Could not detect GitLab project automatically from git remotes';
        suggestions = [
          'Provide projectId explicitly (e.g., "group/project")',
          'Ensure workingDirectory points to the GitLab repository',
          'If remote is not "origin", pass remoteName (e.g., "upstream")',
        ];
        break;
      case 'not_found':
        errorTitle = 'Project not found';
        message =
          '❌ GitLab API returned 404 for provided project ID candidates';
        suggestions = [
          'Verify the project exists and you have access',
          'Check git remote path (git remote -v) to confirm namespace',
          'Try using numeric project ID from GitLab project settings',
        ];
        break;
    }

    return { errorTitle, message, suggestions };
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
    
    // If it looks like it might already be encoded, try to use it as-is first
    if (trimmedId.includes('%')) {
      return trimmedId;
    }
    
    // Check if it's a valid project path format (更宽松的正则表达式以支持更多GitLab项目格式)
    // 支持: group/project, group/subgroup/project, 以及包含连字符、下划线、点的项目名
    // 也支持中文字符和其他Unicode字符，这在某些GitLab实例中是允许的
    if (/^[a-zA-Z0-9_.\u4e00-\u9fff-]+\/[a-zA-Z0-9_.\u4e00-\u9fff-]+(?:\/[a-zA-Z0-9_.\u4e00-\u9fff-]+)*$/.test(trimmedId)) {
      // For project paths, use URL encoding
      // GitLab API expects URL encoding for paths but not for numeric IDs
      return encodeURIComponent(trimmedId);
    }
    
    // 更宽松的验证：如果包含斜杠，很可能是项目路径格式，尝试编码
    if (trimmedId.includes('/') && trimmedId.split('/').length >= 2) {
      // 简单验证：至少包含 group/project 格式
      const parts = trimmedId.split('/');
      if (parts.every(part => part.length > 0 && !/^[\s]*$/.test(part))) {
        return encodeURIComponent(trimmedId);
      }
    }
    
    // 作为最后尝试，如果看起来像一个合理的标识符，返回编码后的版本
    // 这提供了更好的向后兼容性
    if (trimmedId.length > 0 && !/^[\s]*$/.test(trimmedId)) {
      console.warn(`⚠️ Using fallback encoding for project ID: ${trimmedId}`);
      return encodeURIComponent(trimmedId);
    }
    
    return null;
  }

  private isAxiosError(error: any): error is AxiosError {
    return error && error.isAxiosError === true;
  }

  async run(): Promise<void> {
    const transport = new SafeStdioServerTransport();
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
