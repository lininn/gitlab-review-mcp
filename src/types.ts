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
