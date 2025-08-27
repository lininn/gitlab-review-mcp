import axios, { AxiosResponse, AxiosError } from 'axios';
import { ApiRequestOptions } from './types.js';

export class ApiClient {
  private baseURL: string;
  private token: string;
  private timeout: number;
  private maxRetries: number;

  constructor(baseURL: string, token: string, timeout: number = 30000, maxRetries: number = 3) {
    this.baseURL = baseURL;
    this.token = token;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  async request(endpoint: string, options: ApiRequestOptions = {}): Promise<AxiosResponse> {
    const { method = 'GET', data, headers = {}, timeout = this.timeout } = options;

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'node-code-review-mcp/1.0.0',
      'Accept': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method,
      url: `${this.baseURL}/${endpoint}`,
      headers: requestHeaders,
      timeout,
      data,
    };

    return this.executeWithRetry(async () => {
      try {
        const response = await axios(config);
        return response;
      } catch (error) {
        if (this.isAxiosError(error)) {
          throw this.handleApiError(error);
        }
        throw error;
      }
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxRetries) {
          break;
        }

        // Only retry on specific errors
        if (this.shouldRetry(error)) {
          const delay = this.calculateDelay(attempt);
          console.warn(`Request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: any): boolean {
    if (this.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on network errors, timeouts, and 5xx server errors
      return !status || status >= 500 || status === 408 || status === 429;
    }
    
    // Retry on network/timeout errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ENOTFOUND' || 
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT';
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isAxiosError(error: any): error is AxiosError {
    return error.isAxiosError === true;
  }

  private handleApiError(error: AxiosError): Error {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const data = error.response?.data;

    let message = `API request failed: ${status} ${statusText}`;

    if (data && typeof data === 'object') {
      // GitHub/GitLab error format
      if ('message' in data) {
        message += ` - ${data.message}`;
      }
      if ('error_description' in data) {
        message += ` - ${data.error_description}`;
      }
    }

    const apiError = new Error(message);
    (apiError as any).status = status;
    (apiError as any).statusText = statusText;
    (apiError as any).data = data;

    return apiError;
  }

  // Rate limiting support
  async requestWithRateLimit(endpoint: string, options: ApiRequestOptions = {}): Promise<AxiosResponse> {
    try {
      const response = await this.request(endpoint, options);
      
      // Check rate limit headers (GitHub format)
      const remaining = response.headers['x-ratelimit-remaining'];
      const reset = response.headers['x-ratelimit-reset'];
      
      if (remaining && parseInt(remaining) < 10) {
        console.warn(`API rate limit low: ${remaining} requests remaining`);
        if (reset) {
          const resetTime = new Date(parseInt(reset) * 1000);
          console.warn(`Rate limit resets at: ${resetTime.toISOString()}`);
        }
      }

      return response;
    } catch (error) {
      // Handle rate limit exceeded
      if (this.isAxiosError(error) && error.response?.status === 403) {
        const resetHeader = error.response.headers['x-ratelimit-reset'];
        if (resetHeader) {
          const resetTime = parseInt(resetHeader) * 1000;
          const waitTime = resetTime - Date.now();
          
          if (waitTime > 0 && waitTime < 3600000) { // Wait max 1 hour
            console.warn(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
            await this.sleep(waitTime + 1000); // Add 1 second buffer
            return this.request(endpoint, options); // Retry once
          }
        }
      }
      
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple request to test connectivity
      await this.request('', { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn('API health check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  // Get API info
  getApiInfo(): { baseURL: string; hasToken: boolean; timeout: number; maxRetries: number } {
    return {
      baseURL: this.baseURL,
      hasToken: !!this.token,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    };
  }
}
