import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
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
  type GetPartyResponse,
  type GetPartiesResponse,
  type UpdatePartyResponse,
  type DeactivatePartyResponse,
  type GetPartyHistoryResponse,
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
  GetPartyRequestSchema,
  GetPartiesRequestSchema,
  UpdatePartyRequestSchema,
  DeactivatePartyRequestSchema,
  GetPartyHistoryRequestSchema,
  SubscribeOrderbookRequestSchema,
  SubscribeOrdersRequestSchema,
  SubscribeSettlementsRequestSchema,
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketType,
  SettlementStatus,
  AddWaitingListEntryRequestSchema,
  type AddWaitingListEntryResponse,
  GetInviteRequestSchema,
  type GetInviteResponse,
  UseInviteRequestSchema,
  type UseInviteResponse,
  RequestQuotesRequestSchema,
  type RequestQuotesResponse,
  AcceptQuoteRequestSchema,
  type AcceptQuoteResponse,
  GetConnectedLiquidityProvidersRequestSchema,
  type GetConnectedLiquidityProvidersResponse,
  GetRfqAuditLogRequestSchema,
  type GetRfqAuditLogResponse,
  GetLiquidityProvidersRequestSchema,
  type GetLiquidityProvidersResponse,
  GetRoundsDataRequestSchema,
  type GetRoundsDataResponse,
  type GetSettlementProposalResponse,
  GetSettlementProposalRequestSchema,
  RfqAuditEventType,
  IssuanceForecast,
  EstimateSettlementFeesRequestSchema,
  type EstimateSettlementFeesResponse,
} from "./proto/silvana/orderbook/v1/orderbook_pb.js";

// Re-export commonly used enums for convenience
export { OrderType, OrderStatus, TimeInForce, MarketType, SettlementStatus, RfqAuditEventType, IssuanceForecast };

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
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
  /** JWT token for authentication (passed via gRPC metadata header) */
  token: string;
}

/**
 * Orderbook client for interacting with the Silvana Orderbook Service
 */
export class OrderbookClient {
  private client: ReturnType<typeof createClient<typeof OrderbookService>>;
  private authHeaders: HeadersInit;

  /**
   * Creates a new OrderbookClient instance
   * @param config Client configuration
   */
  constructor(config: OrderbookClientConfig) {
    this.client = createClient(OrderbookService, config.transport);
    this.authHeaders = { authorization: `Bearer ${config.token}` };
  }

  /**
   * Returns call options with authentication headers
   */
  private callOptions() {
    return { headers: this.authHeaders };
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
      const request = create(GetOrdersRequestSchema, params ?? {});
      return await this.client.getOrders(request, this.callOptions());
    }, 'getOrders');
  }

  /**
   * Get orderbook depth for a market
   */
  async getOrderbookDepth(params: {
    marketId: string;
    depth?: number;
  }): Promise<GetOrderbookDepthResponse> {
    const request = create(GetOrderbookDepthRequestSchema, params);
    return await this.client.getOrderbookDepth(request, this.callOptions());
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
      const request = create(GetSettlementProposalsRequestSchema, params ?? {});
      return await this.client.getSettlementProposals(request, this.callOptions());
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
    const request = create(GetInstrumentsRequestSchema, params);
    return await this.client.getInstruments(request, this.callOptions());
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
      const request = create(GetMarketsRequestSchema, params ?? {});
      return await this.client.getMarkets(request, this.callOptions());
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
      marketId: params.marketId,
      fromTime: params.fromTime ? dateToTimestamp(params.fromTime) : undefined,
      toTime: params.toTime ? dateToTimestamp(params.toTime) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
    return await this.client.getOrderHistory(request, this.callOptions());
  }

  /**
   * Get market data
   */
  async getMarketData(params: {
    marketIds?: string[];
  }): Promise<GetMarketDataResponse> {
    const request = create(GetMarketDataRequestSchema, params);
    return await this.client.getMarketData(request, this.callOptions());
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
      marketId: params.marketId,
      fromTime: params.fromTime ? dateToTimestamp(params.fromTime) : undefined,
      toTime: params.toTime ? dateToTimestamp(params.toTime) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
    return await this.client.getSettlements(request, this.callOptions());
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
    signature?: string;  // Base64-encoded Ed25519 signature for order authentication
    nonce?: bigint;      // Unique nonce per trader for replay protection
  }): Promise<SubmitOrderResponse> {
    return await this.wrapCall(async () => {
      const request = create(SubmitOrderRequestSchema, {
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
        signature: params.signature,
        nonce: params.nonce,
      });
      return await this.client.submitOrder(request, this.callOptions());
    }, 'submitOrder');
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(params: {
    orderId: bigint;
  }): Promise<CancelOrderResponse> {
    const request = create(CancelOrderRequestSchema, params);
    return await this.client.cancelOrder(request, this.callOptions());
  }

  /**
   * Subscribe to orderbook updates (streaming)
   */
  subscribeOrderbook(params: {
    marketId: string;
    depth?: number;
  }) {
    const request = create(SubscribeOrderbookRequestSchema, params);
    return this.client.subscribeOrderbook(request, this.callOptions());
  }

  /**
   * Subscribe to order updates (streaming)
   */
  subscribeOrders(params: {
    marketId?: string;
  }) {
    const request = create(SubscribeOrdersRequestSchema, params);
    return this.client.subscribeOrders(request, this.callOptions());
  }

  /**
   * Subscribe to settlement updates (streaming)
   */
  subscribeSettlements(params: {
    marketId?: string;
  }) {
    const request = create(SubscribeSettlementsRequestSchema, params);
    return this.client.subscribeSettlements(request, this.callOptions());
  }

  /**
   * Stream RFQ quotes progressively (quotes arrive as each LP responds)
   */
  streamRequestQuotes(params: {
    marketId: string;
    direction: string;
    quantity: string;
    lpNames?: string[];
    timeoutSecs?: number;
  }) {
    const request = create(RequestQuotesRequestSchema, params);
    return this.client.streamRequestQuotes(request, this.callOptions());
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
    userServiceRequestCid?: string;
    userData: any;
    email?: string;
    publicKey?: string;
    inviteCode?: string;
    source?: string;
    liquidityProviderName?: string;
    liquidityProviderDescription?: string;
  }): Promise<CreatePartyResponse> {
    return await this.wrapCall(async () => {
      const request = create(CreatePartyRequestSchema, params);
      return await this.client.createParty(request, this.callOptions());
    }, 'createParty');
  }

  /**
   * Get a single party by ID
   */
  async getParty(params: {
    partyId: string;
  }): Promise<GetPartyResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPartyRequestSchema, params);
      return await this.client.getParty(request, this.callOptions());
    }, 'getParty');
  }

  /**
   * List parties with filters and pagination
   */
  async getParties(params?: {
    partyType?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<GetPartiesResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPartiesRequestSchema, params ?? {});
      return await this.client.getParties(request, this.callOptions());
    }, 'getParties');
  }

  /**
   * Update an existing party (admin operation)
   */
  async updateParty(params: {
    partyId: string;
    expectedVersion: bigint;
    partyName?: string;
    userServiceCid?: string;
    operatorConfigCid?: string;
    userServiceRequestCid?: string;
    userData?: any;
    metadata?: any;
    changeReason?: string;
    email?: string;
    publicKey?: string;
    inviteCode?: string;
    source?: string;
  }): Promise<UpdatePartyResponse> {
    return await this.wrapCall(async () => {
      const request = create(UpdatePartyRequestSchema, params);
      return await this.client.updateParty(request, this.callOptions());
    }, 'updateParty');
  }

  /**
   * Deactivate a party (soft delete - admin operation)
   */
  async deactivateParty(params: {
    partyId: string;
    expectedVersion: bigint;
    changeReason: string;
  }): Promise<DeactivatePartyResponse> {
    return await this.wrapCall(async () => {
      const request = create(DeactivatePartyRequestSchema, params);
      return await this.client.deactivateParty(request, this.callOptions());
    }, 'deactivateParty');
  }

  /**
   * Get party change history (audit trail)
   */
  async getPartyHistory(params: {
    partyId: string;
    limit?: number;
    offset?: number;
  }): Promise<GetPartyHistoryResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPartyHistoryRequestSchema, params);
      return await this.client.getPartyHistory(request, this.callOptions());
    }, 'getPartyHistory');
  }

  /**
   * Create a new instrument (admin operation)
   */
  async createInstrument(params: {
    instrumentId: string;
    instrumentType: string;
    name: string;
    symbol: string;
    newsSymbol: string;
    description?: string;
    issuer?: string;
    registry?: string;
    metadata?: any;
  }): Promise<CreateInstrumentResponse> {
    return await this.wrapCall(async () => {
      const request = create(CreateInstrumentRequestSchema, params);
      return await this.client.createInstrument(request, this.callOptions());
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
      const request = create(CreateMarketRequestSchema, params);
      return await this.client.createMarket(request, this.callOptions());
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
      const request = create(UpdateMarketPriceFeedsRequestSchema, params);
      return await this.client.updateMarketPriceFeeds(request, this.callOptions());
    }, 'updateMarketPriceFeeds');
  }

  /**
   * Add an entry to the waiting list (requires 'onboard' user JWT)
   */
  async addWaitingListEntry(params: {
    userData: any;
    source: string;
    email?: string;
    publicKey?: string;
    metadata?: any;
  }): Promise<AddWaitingListEntryResponse> {
    return await this.wrapCall(async () => {
      const request = create(AddWaitingListEntryRequestSchema, params);
      return await this.client.addWaitingListEntry(request, this.callOptions());
    }, 'addWaitingListEntry');
  }

  /**
   * Get an invite by code
   */
  async getInvite(params: {
    inviteCode: string;
  }): Promise<GetInviteResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetInviteRequestSchema, params);
      return await this.client.getInvite(request, this.callOptions());
    }, 'getInvite');
  }

  /**
   * Use an invite code (increments count)
   */
  async useInvite(params: {
    inviteCode: string;
    partyId?: string;
  }): Promise<UseInviteResponse> {
    return await this.wrapCall(async () => {
      const request = create(UseInviteRequestSchema, params);
      return await this.client.useInvite(request, this.callOptions());
    }, 'useInvite');
  }

  /**
   * Get a single settlement proposal by ID
   */
  async getSettlementProposal(params: {
    proposalId: string;
  }): Promise<GetSettlementProposalResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementProposalRequestSchema, params);
      return await this.client.getSettlementProposal(request, this.callOptions());
    }, 'getSettlementProposal');
  }

  /**
   * Get liquidity providers
   */
  async getLiquidityProviders(params?: {
    activeSeconds?: number;
    limit?: number;
    offset?: number;
  }): Promise<GetLiquidityProvidersResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetLiquidityProvidersRequestSchema, params ?? {});
      return await this.client.getLiquidityProviders(request, this.callOptions());
    }, 'getLiquidityProviders');
  }

  /**
   * Get connected liquidity providers
   */
  async getConnectedLiquidityProviders(params?: {
    marketId?: string;
  }): Promise<GetConnectedLiquidityProvidersResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetConnectedLiquidityProvidersRequestSchema, params ?? {});
      return await this.client.getConnectedLiquidityProviders(request, this.callOptions());
    }, 'getConnectedLiquidityProviders');
  }

  /**
   * Request quotes from liquidity providers (RFQ)
   */
  async requestQuotes(params: {
    marketId: string;
    direction: string;
    quantity: string;
    lpNames?: string[];
    timeoutSecs?: number;
  }): Promise<RequestQuotesResponse> {
    return await this.wrapCall(async () => {
      const request = create(RequestQuotesRequestSchema, params);
      return await this.client.requestQuotes(request, this.callOptions());
    }, 'requestQuotes');
  }

  /**
   * Accept a quote from an LP (RFQ)
   */
  async acceptQuote(params: {
    rfqId: string;
    quoteId: string;
  }): Promise<AcceptQuoteResponse> {
    return await this.wrapCall(async () => {
      const request = create(AcceptQuoteRequestSchema, params);
      return await this.client.acceptQuote(request, this.callOptions());
    }, 'acceptQuote');
  }

  /**
   * Estimate settlement fees for a trade (before creating proposal)
   */
  async estimateSettlementFees(params: {
    marketId: string;
    baseQuantity: string;
    price: string;
  }): Promise<EstimateSettlementFeesResponse> {
    return await this.wrapCall(async () => {
      const request = create(EstimateSettlementFeesRequestSchema, params);
      return await this.client.estimateSettlementFees(request, this.callOptions());
    }, 'estimateSettlementFees');
  }

  /**
   * Get RFQ audit log
   */
  async getRfqAuditLog(params?: {
    rfqId?: string;
    marketId?: string;
    eventType?: RfqAuditEventType;
    lpName?: string;
    fromTime?: Date;
    toTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<GetRfqAuditLogResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetRfqAuditLogRequestSchema, {
        rfqId: params?.rfqId,
        marketId: params?.marketId,
        eventType: params?.eventType,
        lpName: params?.lpName,
        fromTime: params?.fromTime ? dateToTimestamp(params.fromTime) : undefined,
        toTime: params?.toTime ? dateToTimestamp(params.toTime) : undefined,
        limit: params?.limit,
        offset: params?.offset,
      });
      return await this.client.getRfqAuditLog(request, this.callOptions());
    }, 'getRfqAuditLog');
  }

  /**
   * Get rounds data (Canton mining rounds)
   */
  async getRoundsData(params?: {
    limit?: number;
  }): Promise<GetRoundsDataResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetRoundsDataRequestSchema, params ?? {});
      return await this.client.getRoundsData(request, this.callOptions());
    }, 'getRoundsData');
  }
}
