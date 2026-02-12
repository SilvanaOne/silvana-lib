import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/ledger/v1/ledger_pb.js";

import {
  DAppProviderService,
  type GetActiveContractsResponse,
  type GetUpdatesResponse,
  type GetLedgerEndResponse,
  type GetBalancesResponse,
  type GetPreapprovalsResponse,
  type GetDsoRatesResponse,
  type GetSettlementContractsResponse,
  type GetServiceInfoResponse,
  type GetAgentConfigResponse,
  type RegisterAgentResponse,
  type GetOnboardingStatusResponse,
  type SubmitOnboardingSignatureResponse,
  type PrepareTransactionResponse,
  type ExecuteTransactionResponse,
  type RegisterAgentRequest,
  type GetOnboardingStatusRequest,
  type SubmitOnboardingSignatureRequest,
  type PrepareTransactionRequest,
  type ExecuteTransactionRequest,
  GetActiveContractsRequestSchema,
  GetUpdatesRequestSchema,
  GetLedgerEndRequestSchema,
  GetBalancesRequestSchema,
  GetPreapprovalsRequestSchema,
  GetDsoRatesRequestSchema,
  GetSettlementContractsRequestSchema,
  GetServiceInfoRequestSchema,
  GetAgentConfigRequestSchema,
  RegisterAgentRequestSchema,
  GetOnboardingStatusRequestSchema,
  SubmitOnboardingSignatureRequestSchema,
  PrepareTransactionRequestSchema,
  ExecuteTransactionRequestSchema,
  TransactionOperation,
  TransactionStatus,
  OnboardingStatus,
  ProviderErrorCode,
} from "./proto/silvana/ledger/v1/ledger_pb.js";

// Re-export commonly used enums for convenience
export { TransactionOperation, TransactionStatus, OnboardingStatus, ProviderErrorCode };

/**
 * Custom error class for Ledger client errors
 */
export class LedgerError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

/**
 * Ledger client configuration
 */
export interface LedgerClientConfig {
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
  /** JWT token for authentication (passed via gRPC metadata header). Optional for onboarding RPCs. */
  token?: string;
}

/**
 * Ledger client for interacting with the Silvana DAppProviderService
 */
export class LedgerClient {
  private client: ReturnType<typeof createClient<typeof DAppProviderService>>;
  private authHeaders: HeadersInit;

  constructor(config: LedgerClientConfig) {
    this.client = createClient(DAppProviderService, config.transport);
    this.authHeaders = config.token
      ? { authorization: `Bearer ${config.token}` }
      : {};
  }

  private callOptions() {
    return { headers: this.authHeaders };
  }

  private async wrapCall<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ConnectError) {
        throw new LedgerError(
          `${operationName} failed: ${error.message}`,
          String(error.code),
          error.metadata
        );
      }
      throw new LedgerError(
        `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        error
      );
    }
  }

  // === Streaming Query RPCs ===

  /**
   * Stream active contracts for the authenticated party (server-streaming)
   */
  getActiveContracts(params?: {
    templateFilters?: string[];
  }) {
    const request = create(GetActiveContractsRequestSchema, params ?? {});
    return this.client.getActiveContracts(request, this.callOptions());
  }

  /**
   * Stream ledger updates from a given offset (server-streaming)
   */
  getUpdates(params: {
    beginExclusive: bigint;
    endInclusive?: bigint;
    templateFilters?: string[];
  }) {
    const request = create(GetUpdatesRequestSchema, params);
    return this.client.getUpdates(request, this.callOptions());
  }

  // === Unary Query RPCs ===

  /**
   * Get current ledger end offset
   */
  async getLedgerEnd(): Promise<GetLedgerEndResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetLedgerEndRequestSchema, {});
      return await this.client.getLedgerEnd(request, this.callOptions());
    }, 'getLedgerEnd');
  }

  /**
   * Get token balances (CIP-56 holdings + Canton Coin)
   */
  async getBalances(): Promise<GetBalancesResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetBalancesRequestSchema, {});
      return await this.client.getBalances(request, this.callOptions());
    }, 'getBalances');
  }

  /**
   * Fetch TransferPreapproval contracts
   */
  async getPreapprovals(): Promise<GetPreapprovalsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPreapprovalsRequestSchema, {});
      return await this.client.getPreapprovals(request, this.callOptions());
    }, 'getPreapprovals');
  }

  /**
   * Get DSO rates (CC/USD rate, current round)
   */
  async getDsoRates(): Promise<GetDsoRatesResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetDsoRatesRequestSchema, {});
      return await this.client.getDsoRates(request, this.callOptions());
    }, 'getDsoRates');
  }

  /**
   * Discover on-chain DvpProposal/Dvp contracts for active settlements
   */
  async getSettlementContracts(params: {
    settlementIds: string[];
  }): Promise<GetSettlementContractsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementContractsRequestSchema, params);
      return await this.client.getSettlementContracts(request, this.callOptions());
    }, 'getSettlementContracts');
  }

  /**
   * Get provider service info
   */
  async getServiceInfo(): Promise<GetServiceInfoResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetServiceInfoRequestSchema, {});
      return await this.client.getServiceInfo(request, this.callOptions());
    }, 'getServiceInfo');
  }

  // === Onboarding RPCs (no JWT required — use message-level signing) ===

  /**
   * Get agent configuration template (unauthenticated)
   */
  async getAgentConfig(): Promise<GetAgentConfigResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetAgentConfigRequestSchema, {});
      return await this.client.getAgentConfig(request);
    }, 'getAgentConfig');
  }

  /**
   * Register agent on waiting list (signed by agent's Ed25519 key)
   */
  async registerAgent(params: RegisterAgentRequest): Promise<RegisterAgentResponse> {
    return await this.wrapCall(async () => {
      const request = create(RegisterAgentRequestSchema, params);
      return await this.client.registerAgent(request);
    }, 'registerAgent');
  }

  /**
   * Poll onboarding status (signed by agent's Ed25519 key)
   */
  async getOnboardingStatus(params: GetOnboardingStatusRequest): Promise<GetOnboardingStatusResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetOnboardingStatusRequestSchema, params);
      return await this.client.getOnboardingStatus(request);
    }, 'getOnboardingStatus');
  }

  /**
   * Submit multihash signature (signed by agent's Ed25519 key)
   */
  async submitOnboardingSignature(params: SubmitOnboardingSignatureRequest): Promise<SubmitOnboardingSignatureResponse> {
    return await this.wrapCall(async () => {
      const request = create(SubmitOnboardingSignatureRequestSchema, params);
      return await this.client.submitOnboardingSignature(request);
    }, 'submitOnboardingSignature');
  }

  // === Two-Phase Transaction RPCs ===

  /**
   * Phase 1: Prepare transaction (server builds tx, returns hash to sign)
   */
  async prepareTransaction(params: PrepareTransactionRequest): Promise<PrepareTransactionResponse> {
    return await this.wrapCall(async () => {
      const request = create(PrepareTransactionRequestSchema, params);
      return await this.client.prepareTransaction(request, this.callOptions());
    }, 'prepareTransaction');
  }

  /**
   * Phase 2: Execute signed transaction
   */
  async executeTransaction(params: ExecuteTransactionRequest): Promise<ExecuteTransactionResponse> {
    return await this.wrapCall(async () => {
      const request = create(ExecuteTransactionRequestSchema, params);
      return await this.client.executeTransaction(request, this.callOptions());
    }, 'executeTransaction');
  }
}
