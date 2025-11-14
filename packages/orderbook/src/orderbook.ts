import { createGrpcTransport } from "@connectrpc/connect-node";
import { createClient, ConnectError, Interceptor } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { TimestampSchema } from "@bufbuild/protobuf/wkt";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/orderbook/v1/orderbook_pb.js";

import {
  OrderbookService,
  type GetOrdersResponse,
  type GetOrderbookDepthResponse,
  type GetSettlementProposalsResponse,
  type GetInstrumentsResponse,
  type GetMarketsResponse,
  type GetOrderHistoryResponse,
  type GetMarketDataResponse,
  type GetSettlementsResponse,
  type SubmitOrderResponse,
  type CancelOrderResponse,
  type CreatePartyResponse,
  type CreateInstrumentResponse,
  type CreateMarketResponse,
  type UpdateMarketPriceFeedsResponse,
  GetOrdersRequestSchema,
  GetOrderbookDepthRequestSchema,
  GetSettlementProposalsRequestSchema,
  GetInstrumentsRequestSchema,
  GetMarketsRequestSchema,
  GetOrderHistoryRequestSchema,
  GetMarketDataRequestSchema,
  GetSettlementsRequestSchema,
  SubmitOrderRequestSchema,
  CancelOrderRequestSchema,
  CreatePartyRequestSchema,
  CreateInstrumentRequestSchema,
  CreateMarketRequestSchema,
  UpdateMarketPriceFeedsRequestSchema,
  SubscribeOrderbookRequestSchema,
  SubscribeOrdersRequestSchema,
  SubscribeSettlementsRequestSchema,
  JWTAuthSchema,
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketType,
  SettlementStatus,
} from "./proto/silvana/orderbook/v1/orderbook_pb.js";

// Re-export commonly used enums for convenience
export { OrderType, OrderStatus, TimeInForce, MarketType, SettlementStatus };

/**
 * Converts a Date to a Timestamp message
 */
function dateToTimestamp(date: Date) {
  const seconds = BigInt(Math.floor(date.getTime() / 1000));
  const nanos = (date.getTime() % 1000) * 1000000;
  return create(TimestampSchema, { seconds, nanos });
}

/**
 * Custom error class for Orderbook client errors
 */
export class OrderbookError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OrderbookError';
  }
}

/**
 * Orderbook client configuration
 */
export interface OrderbookClientConfig {
  /** Base URL of the orderbook service (e.g., "http://localhost:50052") */
  baseUrl: string;
  /** JWT token for authentication */
  token: string;
}

/**
 * Orderbook client for interacting with the Silvana Orderbook Service
 */
export class OrderbookClient {
  private client: ReturnType<typeof createClient<typeof OrderbookService>>;
  private token: string;

  /**
   * Creates a new OrderbookClient instance
   * @param config Client configuration
   */
  constructor(config: OrderbookClientConfig) {
    // Create interceptor to add Authorization header
    const authInterceptor: Interceptor = (next) => async (req) => {
      req.header.set("authorization", `Bearer ${config.token}`);
      return await next(req);
    };

    const transport = createGrpcTransport({
      baseUrl: config.baseUrl,
      interceptors: [authInterceptor],
    });

    this.client = createClient(OrderbookService, transport);
    this.token = config.token;
  }

  /**
   * Creates JWT auth object
   */
  private createAuth() {
    return create(JWTAuthSchema, { token: this.token });
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
        throw new OrderbookError(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new OrderbookError(
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        error
      );
    }
  }

  /**
   * Get orders for the authenticated user
   */
  async getOrders(params?: {
    marketId?: string;
    status?: OrderStatus;
    orderType?: OrderType;
    limit?: number;
    offset?: number;
  }): Promise<GetOrdersResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetOrdersRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.getOrders(request);
    }, 'getOrders');
  }

  /**
   * Get orderbook depth for a market
   */
  async getOrderbookDepth(params: {
    marketId: string;
    depth?: number;
  }): Promise<GetOrderbookDepthResponse> {
    const request = create(GetOrderbookDepthRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return await this.client.getOrderbookDepth(request);
  }

  /**
   * Get settlement proposals for the authenticated user
   */
  async getSettlementProposals(params?: {
    marketId?: string;
    status?: SettlementStatus;
    limit?: number;
    offset?: number;
  }): Promise<GetSettlementProposalsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementProposalsRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.getSettlementProposals(request);
    }, 'getSettlementProposals');
  }

  /**
   * Get available instruments
   */
  async getInstruments(params: {
    instrumentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<GetInstrumentsResponse> {
    const request = create(GetInstrumentsRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return await this.client.getInstruments(request);
  }

  /**
   * Get available markets
   */
  async getMarkets(params?: {
    marketType?: MarketType;
    baseInstrument?: string;
    quoteInstrument?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<GetMarketsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetMarketsRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.getMarkets(request);
    }, 'getMarkets');
  }

  /**
   * Get order history for the authenticated user
   */
  async getOrderHistory(params: {
    marketId?: string;
    fromTime?: Date;
    toTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<GetOrderHistoryResponse> {
    const request = create(GetOrderHistoryRequestSchema, {
      auth: this.createAuth(),
      marketId: params.marketId,
      fromTime: params.fromTime ? dateToTimestamp(params.fromTime) : undefined,
      toTime: params.toTime ? dateToTimestamp(params.toTime) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
    return await this.client.getOrderHistory(request);
  }

  /**
   * Get market data
   */
  async getMarketData(params: {
    marketIds?: string[];
  }): Promise<GetMarketDataResponse> {
    const request = create(GetMarketDataRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return await this.client.getMarketData(request);
  }

  /**
   * Get settlements (completed) for the authenticated user
   */
  async getSettlements(params: {
    marketId?: string;
    fromTime?: Date;
    toTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<GetSettlementsResponse> {
    const request = create(GetSettlementsRequestSchema, {
      auth: this.createAuth(),
      marketId: params.marketId,
      fromTime: params.fromTime ? dateToTimestamp(params.fromTime) : undefined,
      toTime: params.toTime ? dateToTimestamp(params.toTime) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
    return await this.client.getSettlements(request);
  }

  /**
   * Submit a new order
   */
  async submitOrder(params: {
    marketId: string;
    orderType: OrderType;
    price: string;
    quantity: string;
    timeInForce: TimeInForce;
    expiresAt?: Date;
    traderOrderRef?: string;
    credentials?: any;
    requirements?: any;
    metadata?: any;
  }): Promise<SubmitOrderResponse> {
    return await this.wrapCall(async () => {
      const request = create(SubmitOrderRequestSchema, {
        auth: this.createAuth(),
        marketId: params.marketId,
        orderType: params.orderType,
        price: params.price,
        quantity: params.quantity,
        timeInForce: params.timeInForce,
        expiresAt: params.expiresAt ? dateToTimestamp(params.expiresAt) : undefined,
        traderOrderRef: params.traderOrderRef,
        credentials: params.credentials,
        requirements: params.requirements,
        metadata: params.metadata,
      });
      return await this.client.submitOrder(request);
    }, 'submitOrder');
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(params: {
    orderId: bigint;
  }): Promise<CancelOrderResponse> {
    const request = create(CancelOrderRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return await this.client.cancelOrder(request);
  }

  /**
   * Subscribe to orderbook updates (streaming)
   */
  subscribeOrderbook(params: {
    marketId: string;
    depth?: number;
  }) {
    const request = create(SubscribeOrderbookRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return this.client.subscribeOrderbook(request);
  }

  /**
   * Subscribe to order updates (streaming)
   */
  subscribeOrders(params: {
    marketId?: string;
  }) {
    const request = create(SubscribeOrdersRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return this.client.subscribeOrders(request);
  }

  /**
   * Subscribe to settlement updates (streaming)
   */
  subscribeSettlements(params: {
    marketId?: string;
  }) {
    const request = create(SubscribeSettlementsRequestSchema, {
      auth: this.createAuth(),
      ...params,
    });
    return this.client.subscribeSettlements(request);
  }

  /**
   * Create a new party (admin operation)
   */
  async createParty(params: {
    partyId: string;
    partyName: string;
    partyType: string;
    userServiceCid?: string;
    operatorConfigCid?: string;
    metadata?: any;
  }): Promise<CreatePartyResponse> {
    return await this.wrapCall(async () => {
      const request = create(CreatePartyRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.createParty(request);
    }, 'createParty');
  }

  /**
   * Create a new instrument (admin operation)
   */
  async createInstrument(params: {
    instrumentId: string;
    instrumentType: string;
    name: string;
    symbol: string;
    description?: string;
    issuer?: string;
    registry?: string;
    metadata?: any;
  }): Promise<CreateInstrumentResponse> {
    return await this.wrapCall(async () => {
      const request = create(CreateInstrumentRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.createInstrument(request);
    }, 'createInstrument');
  }

  /**
   * Create a new market (admin operation)
   */
  async createMarket(params: {
    marketId: string;
    marketType: MarketType;
    baseInstrument?: string;
    quoteInstrument?: string;
    minOrderSize: string;
    maxOrderSize?: string;
    tickSize: string;
    makerFee: string;
    takerFee: string;
    metadata?: any;
    priceFeeds?: any;
  }): Promise<CreateMarketResponse> {
    return await this.wrapCall(async () => {
      const request = create(CreateMarketRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.createMarket(request);
    }, 'createMarket');
  }

  /**
   * Update market price feeds (admin operation)
   */
  async updateMarketPriceFeeds(params: {
    marketId: string;
    priceFeeds: any;
  }): Promise<UpdateMarketPriceFeedsResponse> {
    return await this.wrapCall(async () => {
      const request = create(UpdateMarketPriceFeedsRequestSchema, {
        auth: this.createAuth(),
        ...params,
      });
      return await this.client.updateMarketPriceFeeds(request);
    }, 'updateMarketPriceFeeds');
  }
}
