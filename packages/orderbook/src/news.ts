import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/news/v1/news_pb.js";

import {
  NewsService,
  type GetNewsResponse,
  GetNewsRequestSchema,
  StreamNewsRequestSchema,
} from "./proto/silvana/news/v1/news_pb.js";

/**
 * Custom error class for News client errors
 */
export class NewsError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'NewsError';
  }
}

/**
 * News client configuration
 */
export interface NewsClientConfig {
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
}

/**
 * News client for interacting with the Silvana News Service
 */
export class NewsClient {
  private client: ReturnType<typeof createClient<typeof NewsService>>;

  /**
   * Creates a new NewsClient instance
   * @param config Client configuration
   */
  constructor(config: NewsClientConfig) {
    this.client = createClient(NewsService, config.transport);
  }

  /**
   * Wraps async calls with error handling
   */
  private async wrapCall<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ConnectError) {
        throw new NewsError(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new NewsError(
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        error
      );
    }
  }

  /**
   * Get news articles for specific cryptocurrencies
   */
  async getNews(params?: {
    tokens?: string[];
    limit?: number;
    language?: string;
    hours?: number;
  }): Promise<GetNewsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetNewsRequestSchema, params || {});
      return await this.client.getNews(request);
    }, 'getNews');
  }

  /**
   * Stream real-time news updates
   */
  streamNews(params?: {
    tokens?: string[];
    updateInterval?: number;
  }) {
    const request = create(StreamNewsRequestSchema, params || {});
    return this.client.streamNews(request);
  }
}
