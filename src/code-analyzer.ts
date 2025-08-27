import { CodeAnalysisResult, CodeIssue, AnalysisRule } from './types.js';

export class CodeAnalyzer {
  private rules: Map<string, AnalysisRule[]> = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // JavaScript/TypeScript rules
    this.rules.set('javascript', [
      {
        name: 'no-console-log',
        pattern: /console\.log\(/g,
        message: 'Console.log statement found',
        severity: 'warning',
        type: 'debug',
      },
      {
        name: 'no-var',
        pattern: /\bvar\s+/g,
        message: 'Use let or const instead of var',
        severity: 'warning',
        type: 'best-practice',
      },
      {
        name: 'no-eval',
        pattern: /\beval\(/g,
        message: 'eval() is dangerous and should be avoided',
        severity: 'error',
        type: 'security',
      },
      {
        name: 'arrow-function-spacing',
        pattern: /=>\s*{/g,
        message: 'Consider using consistent arrow function spacing',
        severity: 'info',
        type: 'style',
      },
    ]);

    this.rules.set('typescript', [
      ...this.rules.get('javascript')!,
      {
        name: 'no-any',
        pattern: /:\s*any\b/g,
        message: 'Avoid using "any" type, use specific types',
        severity: 'warning',
        type: 'type-safety',
      },
      {
        name: 'explicit-return-type',
        pattern: /function\s+\w+\([^)]*\)\s*{/g,
        message: 'Consider adding explicit return type',
        severity: 'info',
        type: 'type-safety',
      },
    ]);

    // Python rules
    this.rules.set('python', [
      {
        name: 'no-print',
        pattern: /\bprint\(/g,
        message: 'Consider using logging instead of print',
        severity: 'warning',
        type: 'debug',
      },
      {
        name: 'pep8-line-length',
        pattern: /.{89,}/g,
        message: 'Line exceeds PEP 8 recommendation (88 characters)',
        severity: 'warning',
        type: 'style',
      },
      {
        name: 'unused-import',
        pattern: /^import\s+\w+.*$/gm,
        message: 'Potential unused import (manual check required)',
        severity: 'info',
        type: 'cleanup',
      },
    ]);

    // Java rules
    this.rules.set('java', [
      {
        name: 'system-out-println',
        pattern: /System\.out\.println\(/g,
        message: 'Use proper logging instead of System.out.println',
        severity: 'warning',
        type: 'debug',
      },
      {
        name: 'public-class-naming',
        pattern: /public\s+class\s+[a-z]/g,
        message: 'Class names should start with uppercase letter',
        severity: 'error',
        type: 'naming',
      },
    ]);

    // Go rules
    this.rules.set('go', [
      {
        name: 'no-fmt-println',
        pattern: /fmt\.Println\(/g,
        message: 'Consider using proper logging instead of fmt.Println',
        severity: 'warning',
        type: 'debug',
      },
      {
        name: 'error-handling',
        pattern: /if\s+err\s*!=\s*nil\s*{/g,
        message: 'Good error handling practice',
        severity: 'info',
        type: 'best-practice',
      },
    ]);

    // Common rules for all languages
    const commonRules: AnalysisRule[] = [
      {
        name: 'todo-comment',
        pattern: /\b(TODO|FIXME|HACK|XXX)\b/gi,
        message: 'TODO/FIXME comment found',
        severity: 'info',
        type: 'maintenance',
      },
      {
        name: 'long-line',
        pattern: /.{121,}/g,
        message: 'Line exceeds 120 characters',
        severity: 'warning',
        type: 'style',
      },
      {
        name: 'trailing-whitespace',
        pattern: /\s+$/gm,
        message: 'Trailing whitespace found',
        severity: 'info',
        type: 'style',
      },
    ];

    // Add common rules to all languages
    for (const [language, rules] of this.rules) {
      this.rules.set(language, [...rules, ...commonRules]);
    }
  }

  analyze(code: string, language: string, customRules?: string[]): CodeAnalysisResult {
    const normalizedLanguage = language.toLowerCase();
    const rules = this.rules.get(normalizedLanguage) || this.rules.get('javascript') || [];
    
    const lines = code.split('\n');
    const issues: CodeIssue[] = [];
    const suggestions: string[] = [];

    // Apply rules
    for (const rule of rules) {
      if (customRules && customRules.length > 0 && !customRules.includes(rule.name)) {
        continue;
      }

      lines.forEach((line: string, index: number) => {
        const matches = line.match(rule.pattern);
        if (matches) {
          issues.push({
            line: index + 1,
            column: line.search(rule.pattern) + 1,
            type: rule.type,
            message: rule.message,
            severity: rule.severity,
            rule: rule.name,
          });
        }
      });
    }

    // Generate suggestions based on analysis
    if (lines.length > 100) {
      suggestions.push('Consider breaking this file into smaller modules');
    }

    if (issues.filter(i => i.severity === 'error').length > 5) {
      suggestions.push('Multiple errors found - consider reviewing code structure');
    }

    const warningCount = issues.filter(i => i.severity === 'warning').length;
    if (warningCount > 10) {
      suggestions.push('High number of warnings - consider code refactoring');
    }

    // Language-specific suggestions
    if (normalizedLanguage === 'javascript' || normalizedLanguage === 'typescript') {
      const hasConsoleLog = issues.some(i => i.rule === 'no-console-log');
      if (hasConsoleLog) {
        suggestions.push('Replace console.log with proper logging framework');
      }
    }

    // Calculate complexity metrics
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code, normalizedLanguage);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(code, issues.length);

    return {
      language: normalizedLanguage,
      codeLength: code.length,
      lineCount: lines.length,
      issues,
      suggestions,
      metrics: {
        cyclomaticComplexity,
        maintainabilityIndex,
        issueCount: {
          error: issues.filter(i => i.severity === 'error').length,
          warning: issues.filter(i => i.severity === 'warning').length,
          info: issues.filter(i => i.severity === 'info').length,
        },
      },
    };
  }

  private calculateCyclomaticComplexity(code: string, language: string): number {
    // Simple complexity calculation based on control flow statements
    const patterns = {
      javascript: /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g,
      typescript: /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g,
      python: /\b(if|elif|else|while|for|try|except|and|or)\b/g,
      java: /\b(if|else|while|for|switch|case|catch|&&|\|\||\?)\b/g,
      go: /\b(if|else|for|switch|case|&&|\|\|)\b/g,
    };

    const pattern = patterns[language as keyof typeof patterns] || patterns.javascript;
    const matches = code.match(pattern);
    return (matches?.length || 0) + 1; // +1 for the main execution path
  }

  private calculateMaintainabilityIndex(code: string, issueCount: number): number {
    // Simplified maintainability index (0-100, higher is better)
    const lines = code.split('\n').length;
    const comments = (code.match(/\/\/|\/\*|\*\/|#/g) || []).length;
    const commentRatio = comments / lines;
    
    let score = 100;
    score -= Math.min(lines / 10, 30); // Penalty for length
    score -= Math.min(issueCount * 2, 40); // Penalty for issues
    score += Math.min(commentRatio * 20, 20); // Bonus for comments
    
    return Math.max(0, Math.round(score));
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.rules.keys());
  }

  getLanguageRules(language: string): AnalysisRule[] {
    return this.rules.get(language.toLowerCase()) || [];
  }
}
