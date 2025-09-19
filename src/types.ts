export interface CodeIssue {
  line: number;
  column?: number;
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
}

export interface AnalysisRule {
  name: string;
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning' | 'info';
  type: string;
}

export interface CodeMetrics {
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  issueCount: {
    error: number;
    warning: number;
    info: number;
  };
}

export interface CodeAnalysisResult {
  language: string;
  codeLength: number;
  lineCount: number;
  issues: CodeIssue[];
  suggestions: string[];
  metrics: CodeMetrics;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface CreateMergeRequestOptions {
  projectId: string;
  sourceBranch: string;
  targetBranch?: string;
  title?: string;
  description?: string;
  assigneeId?: number;
  reviewerIds?: number[];
  deleteSourceBranch?: boolean;
  squash?: boolean;
}

export interface MergeRequestResult {
  id: number;
  web_url: string;
  title: string;
  state: string;
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
}

export interface GitBranchInfo {
  currentBranch: string;
  allBranches: string[];
  isGitRepository: boolean;
  repositoryRoot?: string;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
  fetch?: string;
  push?: string;
}

export interface ProjectInfo {
  projectId?: string;
  projectPath?: string;
  gitlabUrl?: string;
  remotes: GitRemoteInfo[];
  isGitlabProject: boolean;
}
