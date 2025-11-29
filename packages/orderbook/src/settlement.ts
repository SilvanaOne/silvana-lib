import { createGrpcTransport } from "@connectrpc/connect-node";
import { createClient, ConnectError } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/settlement/v1/settlement_pb.js";

import {
  SettlementService,
  type GetPendingProposalsResponse,
  type GetSettlementStatusResponse,
  GetPendingProposalsRequestSchema,
  GetSettlementStatusRequestSchema,
  SubmitPreconfirmationRequestSchema,
  CantonToServerMessageSchema,
  type CantonNodeAuth,
  type PreconfirmationDecision,
  type CantonToServerMessage,
} from "./proto/silvana/settlement/v1/settlement_pb.js";

/**
 * Custom error class for Settlement client errors
 */
export class SettlementError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SettlementError';
  }
}

/**
 * Settlement client configuration
 */
export interface SettlementClientConfig {
  /** Base URL of the settlement service (e.g., "http://localhost:50055") */
  baseUrl: string;
}

/**
 * Settlement client for interacting with the Silvana Settlement Service
 */
export class SettlementClient {
  private client: ReturnType<typeof createClient<typeof SettlementService>>;

  /**
   * Creates a new SettlementClient instance
   * @param config Client configuration
   */
  constructor(config: SettlementClientConfig) {
    const transport = createGrpcTransport({
      baseUrl: config.baseUrl,
    });

    this.client = createClient(SettlementService, transport);
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
        throw new SettlementError(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new SettlementError(
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        error
      );
    }
  }

  /**
   * Bidirectional streaming for settlement flow
   * Canton node initiates connection and maintains stream
   */
  settlementStream(messages: AsyncIterable<CantonToServerMessage>) {
    return this.client.settlementStream(messages);
  }

  /**
   * Get pending proposals for a party
   */
  async getPendingProposals(params: {
    auth: CantonNodeAuth;
    partyId: string;
    limit?: number;
  }): Promise<GetPendingProposalsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPendingProposalsRequestSchema, params);
      return await this.client.getPendingProposals(request);
    }, 'getPendingProposals');
  }

  /**
   * Query settlement status
   */
  async getSettlementStatus(params: {
    auth: CantonNodeAuth;
    settlementId: string;
  }): Promise<GetSettlementStatusResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementStatusRequestSchema, params);
      return await this.client.getSettlementStatus(request);
    }, 'getSettlementStatus');
  }

  /**
   * Manual preconfirmation (if not using stream)
   */
  async submitPreconfirmation(params: {
    auth: CantonNodeAuth;
    decision: PreconfirmationDecision;
  }): Promise<void> {
    return await this.wrapCall(async () => {
      const request = create(SubmitPreconfirmationRequestSchema, params);
      await this.client.submitPreconfirmation(request);
    }, 'submitPreconfirmation');
  }
}
