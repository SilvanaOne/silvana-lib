import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Re-export all RFQ V2 types & schemas (RfqV2Service, AtomicQuoteEnvelope,
// AtomicQuote, AtomicFeeSpec, AtomicQuoteInfo, AtomicRejectInfo,
// RfqConfirmRejectReason, the *V2* request/response messages, etc.)
export * from "./proto/silvana/rfqv2/v1/rfqv2_pb.js";

import {
  RfqV2Service,
  RequestQuotesV2RequestSchema,
  type RequestQuotesV2Response,
  AcceptQuoteAtomicRequestSchema,
  type AcceptQuoteAtomicResponse,
  GetAtomicLiquidityProvidersRequestSchema,
  type GetAtomicLiquidityProvidersResponse,
  GetAtomicRfqAuditLogRequestSchema,
  type GetAtomicRfqAuditLogResponse,
  EstimateAtomicFeeRequestSchema,
  type EstimateAtomicFeeResponse,
  RfqConfirmRejectReason,
} from "./proto/silvana/rfqv2/v1/rfqv2_pb.js";

// Convenience enum re-export (parity with orderbook.ts surfacing its enums)
export { RfqConfirmRejectReason };

/**
 * Custom error class for RFQ V2 client errors
 */
export class RfqV2Error extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "RfqV2Error";
  }
}

/**
 * RFQ V2 client configuration
 */
export interface RfqV2ClientConfig {
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
  /**
   * JWT for authentication, sent via gRPC metadata as `authorization: Bearer <token>`.
   *
   * - Direct calls: a normal user token (aud = JWT_AUDIENCE); leave `user` unset.
   * - Delegated (swap-venue) calls: a platform-signed swap-venue token
   *   (aud = JWT_SWAP_VENUE_AUDIENCE), and set `user` to the delegated wallet party
   *   id on requestQuotes/acceptQuoteAtomic. The server selects the auth path by
   *   whether `user` is present on the request.
   */
  token: string;
}

/**
 * Client for the Silvana RFQ V2 (AtomicDVP) service. All RPCs are unary.
 *
 * This is a thin transport wrapper: it never signs anything and holds no
 * settlement state. Responses carry everything a consumer needs — most notably
 * the LP-signed `AtomicQuoteEnvelope` returned by `acceptQuoteAtomic`.
 */
export class RfqV2Client {
  private client: ReturnType<typeof createClient<typeof RfqV2Service>>;
  private authHeaders: HeadersInit;

  /**
   * Creates a new RfqV2Client instance
   * @param config Client configuration
   */
  constructor(config: RfqV2ClientConfig) {
    this.client = createClient(RfqV2Service, config.transport);
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
        throw new RfqV2Error(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new RfqV2Error(
        `${operationName} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UNKNOWN",
        error
      );
    }
  }

  /**
   * Request atomic quotes from liquidity providers (RFQ V2).
   * Unary: returns the full quote set after the server-side timeout elapses.
   */
  async requestQuotes(params: {
    marketId: string;
    /** "buy" | "sell" (user side) */
    direction: string;
    /** base quantity */
    quantity: string;
    lpNames?: string[];
    /** default 10, clamped 1..30 server-side */
    timeoutSecs?: number;
    /** priority-ordered fee-token preference; empty ⇒ CC */
    feeTokens?: string[];
    /** delegated wallet party id (requires a swap-venue token) */
    user?: string;
  }): Promise<RequestQuotesV2Response> {
    return await this.wrapCall(async () => {
      const request = create(RequestQuotesV2RequestSchema, params);
      return await this.client.requestQuotes(request, this.callOptions());
    }, "requestQuotes");
  }

  /**
   * Accept a quote; returns a fully LP-signed `AtomicQuoteEnvelope` on success.
   *
   * An LP reject arrives in-band as `success = false` + `rejectReason`
   * (RfqConfirmRejectReason) — NOT a transport error — so branch on the response.
   */
  async acceptQuoteAtomic(params: {
    rfqId: string;
    quoteId: string;
    /** default 10, clamped 1..30 server-side */
    timeoutSecs?: number;
    /** delegated wallet party id (requires a swap-venue token) */
    user?: string;
  }): Promise<AcceptQuoteAtomicResponse> {
    return await this.wrapCall(async () => {
      const request = create(AcceptQuoteAtomicRequestSchema, params);
      return await this.client.acceptQuoteAtomic(request, this.callOptions());
    }, "acceptQuoteAtomic");
  }

  /**
   * List liquidity providers with validated AtomicDVP venues.
   * User token only; no `user` delegation.
   */
  async getAtomicLiquidityProviders(): Promise<GetAtomicLiquidityProvidersResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetAtomicLiquidityProvidersRequestSchema, {});
      return await this.client.getAtomicLiquidityProviders(request, this.callOptions());
    }, "getAtomicLiquidityProviders");
  }

  /**
   * Read the atomic RFQ audit log.
   * User token only; no `user` delegation.
   */
  async getAtomicRfqAuditLog(params?: {
    rfqId?: string;
    marketId?: string;
    limit?: number;
  }): Promise<GetAtomicRfqAuditLogResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetAtomicRfqAuditLogRequestSchema, params ?? {});
      return await this.client.getAtomicRfqAuditLog(request, this.callOptions());
    }, "getAtomicRfqAuditLog");
  }

  /**
   * Estimate the settlement fee for a market + fee-token preference.
   * Public RPC — the server ignores the token (the header is still sent for uniformity).
   */
  async estimateAtomicFee(params: {
    marketId: string;
    /** priority-ordered fee-token preference; empty ⇒ CC */
    feeTokens?: string[];
  }): Promise<EstimateAtomicFeeResponse> {
    return await this.wrapCall(async () => {
      const request = create(EstimateAtomicFeeRequestSchema, params);
      return await this.client.estimateAtomicFee(request, this.callOptions());
    }, "estimateAtomicFee");
  }
}
