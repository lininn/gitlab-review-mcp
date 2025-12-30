import process from 'node:process';
import { Readable, Writable } from 'node:stream';
import {
  JSONRPCMessage,
  JSONRPCMessageSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * A stdio transport that tolerates empty lines/keep-alives on stdin.
 * Some environments send blank lines before real JSON-RPC payloads, which
 * would otherwise trigger a JSON parse error. This transport simply skips
 * those lines while preserving normal MCP framing.
 */
export class SafeStdioServerTransport implements Transport {
  private stdin: Readable;
  private stdout: Writable;
  private buffer?: Buffer;
  private started = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(stdin: Readable = process.stdin, stdout: Writable = process.stdout) {
    this.stdin = stdin;
    this.stdout = stdout;
  }

  private readonly handleData = (chunk: Buffer) => {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
    this.processReadBuffer();
  };

  private readonly handleError = (error: Error) => {
    this.onerror?.(error);
  };

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('SafeStdioServerTransport already started!');
    }
    this.started = true;
    this.stdin.on('data', this.handleData);
    this.stdin.on('error', this.handleError);

    // Keep the event loop alive when a MCP client attaches over stdio.
    if (typeof (this.stdin as any).resume === 'function') {
      (this.stdin as any).resume();
    }
  }

  private processReadBuffer(): void {
    if (!this.buffer) {
      return;
    }

    while (true) {
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex === -1) {
        return;
      }

      const rawLine = this.buffer
        .toString('utf8', 0, newlineIndex)
        .replace(/\r$/, '');
      this.buffer = this.buffer.subarray(newlineIndex + 1);

      // Skip empty keep-alive lines to avoid JSON parse errors.
      if (rawLine.trim() === '') {
        continue;
      }

      try {
        const parsed = JSON.parse(rawLine);
        const message = JSONRPCMessageSchema.parse(parsed);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  async close(): Promise<void> {
    this.stdin.off('data', this.handleData);
    this.stdin.off('error', this.handleError);

    const listenerCount =
      typeof (this.stdin as any).listenerCount === 'function'
        ? (this.stdin as any).listenerCount('data')
        : 0;

    if (listenerCount === 0 && typeof (this.stdin as any).pause === 'function') {
      (this.stdin as any).pause();
    }

    this.buffer = undefined;
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload = serializeMessage(message);

      const onError = (error: Error) => {
        this.stdout.off('error', onError);
        reject(error);
      };

      this.stdout.once('error', onError);
      const written = this.stdout.write(payload, () => {
        this.stdout.off('error', onError);
        resolve();
      });

      if (!written) {
        this.stdout.once('drain', () => {
          this.stdout.off('error', onError);
          resolve();
        });
      }
    });
  }
}
