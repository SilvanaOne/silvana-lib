import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { TimestampSchema } from "@bufbuild/protobuf/wkt";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/pricing/v1/pricing_pb.js";

import {
  PricingService,
  type GetPriceResponse,
  type GetPricesResponse,
  type GetKlinesResponse,
  type GetOrderBookResponse,
  type GetPivotPointsResponse,
  GetPriceRequestSchema,
  GetPricesRequestSchema,
  GetKlinesRequestSchema,
  GetOrderBookRequestSchema,
  StreamPricesRequestSchema,
  GetPivotPointsRequestSchema,
} from "./proto/silvana/pricing/v1/pricing_pb.js";

/**
 * Converts a Date to a Timestamp message
 */
function dateToTimestamp(date: Date) {
  const seconds = BigInt(Math.floor(date.getTime() / 1000));
  const nanos = (date.getTime() % 1000) * 1000000;
  return create(TimestampSchema, { seconds, nanos });
}

/**
 * Custom error class for Pricing client errors
 */
export class PricingError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

/**
 * Pricing client configuration
 */
export interface PricingClientConfig {
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
}

/**
 * Pricing client for interacting with the Silvana Pricing Service
 */
export class PricingClient {
  private client: ReturnType<typeof createClient<typeof PricingService>>;

  /**
   * Creates a new PricingClient instance
   * @param config Client configuration
   */
  constructor(config: PricingClientConfig) {
    this.client = createClient(PricingService, config.transport);
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
        throw new PricingError(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new PricingError(
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        error
      );
    }
  }

  /**
   * Get current price for a market
   */
  async getPrice(params: {
    marketId: string;
    source?: string;
  }): Promise<GetPriceResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPriceRequestSchema, params);
      return await this.client.getPrice(request);
    }, 'getPrice');
  }

  /**
   * Get multiple market prices
   */
  async getPrices(params: {
    marketIds: string[];
    source?: string;
  }): Promise<GetPricesResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPricesRequestSchema, params);
      return await this.client.getPrices(request);
    }, 'getPrices');
  }

  /**
   * Get kline/candle data
   */
  async getKlines(params: {
    marketId: string;
    interval: string;
    limit?: number;
    startTime?: Date;
    endTime?: Date;
    source?: string;
  }): Promise<GetKlinesResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetKlinesRequestSchema, {
        marketId: params.marketId,
        interval: params.interval,
        limit: params.limit,
        startTime: params.startTime ? dateToTimestamp(params.startTime) : undefined,
        endTime: params.endTime ? dateToTimestamp(params.endTime) : undefined,
        source: params.source,
      });
      return await this.client.getKlines(request);
    }, 'getKlines');
  }

  /**
   * Get order book snapshot
   */
  async getOrderBook(params: {
    marketId: string;
    depth?: number;
    source?: string;
  }): Promise<GetOrderBookResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetOrderBookRequestSchema, params);
      return await this.client.getOrderBook(request);
    }, 'getOrderBook');
  }

  /**
   * Stream real-time price updates
   */
  streamPrices(params: {
    marketIds: string[];
    includeOrderbook?: boolean;
    includeTrades?: boolean;
  }) {
    const request = create(StreamPricesRequestSchema, params);
    return this.client.streamPrices(request);
  }

  /**
   * Get calculated pivot points
   */
  async getPivotPoints(params: {
    marketId: string;
    timeframe: string;
    source?: string;
  }): Promise<GetPivotPointsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPivotPointsRequestSchema, params);
      return await this.client.getPivotPoints(request);
    }, 'getPivotPoints');
  }
}
