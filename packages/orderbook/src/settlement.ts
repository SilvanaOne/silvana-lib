import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Export all types and schemas from the generated protobuf file
export * from "./proto/silvana/settlement/v1/settlement_pb.js";

import {
  SettlementService,
  type GetPendingProposalsResponse,
  type GetSettlementStatusResponse,
  type UpdateSettlementProposalResponse,
  type SaveDisclosedContractResponse,
  type GetDisclosedContractsResponse,
  type RecordSettlementResponse,
  type RecordTransactionResponse,
  type GetTransactionHistoryResponse,
  type DisclosedContractMessage,
  GetPendingProposalsRequestSchema,
  GetSettlementStatusRequestSchema,
  SubmitPreconfirmationRequestSchema,
  UpdateSettlementProposalRequestSchema,
  SaveDisclosedContractRequestSchema,
  GetDisclosedContractsRequestSchema,
  RecordSettlementRequestSchema,
  RecordTransactionRequestSchema,
  GetTransactionHistoryRequestSchema,
  CantonToServerMessageSchema,
  type CantonNodeAuth,
  type PreconfirmationDecision,
  type CantonToServerMessage,
  SettlementStage,
  TransactionType,
  SenderType,
  TransactionResult,
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
  /** Transport instance (create with @connectrpc/connect-node or @connectrpc/connect-web) */
  transport: Transport;
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
    this.client = createClient(SettlementService, config.transport);
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

  /**
   * Update settlement proposal (frontend user action with version control for concurrency)
   */
  async updateSettlementProposal(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    expectedVersion: bigint;
    dvpProposalCid?: string;
    dvpProposalUpdateId?: string;
    dvpCid?: string;
    dvpUpdateId?: string;
    allocationBuyerCid?: string;
    allocationBuyerUpdateId?: string;
    allocationSellerCid?: string;
    allocationSellerUpdateId?: string;
    settledDvpCid?: string;
    settlementUpdateId?: string;
    settlementCompletionOffset?: string;
    newStage?: SettlementStage;
    errorMessage?: string;
    metadata?: any;
    buyerFeeSent?: boolean;
    sellerFeeSent?: boolean;
    buyerFeeUpdateId?: string;
    sellerFeeUpdateId?: string;
    buyerFeePaidAt?: { seconds: bigint; nanos: number };
    sellerFeePaidAt?: { seconds: bigint; nanos: number };
  }): Promise<UpdateSettlementProposalResponse> {
    return await this.wrapCall(async () => {
      const request = create(UpdateSettlementProposalRequestSchema, params);
      return await this.client.updateSettlementProposal(request);
    }, 'updateSettlementProposal');
  }

  /**
   * Save a disclosed contract (buyer/seller saves during allocation)
   */
  async saveDisclosedContract(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    contract: DisclosedContractMessage;
  }): Promise<SaveDisclosedContractResponse> {
    return await this.wrapCall(async () => {
      const request = create(SaveDisclosedContractRequestSchema, params);
      return await this.client.saveDisclosedContract(request);
    }, 'saveDisclosedContract');
  }

  /**
   * Get disclosed contracts (operator gets all, buyer/seller gets own)
   */
  async getDisclosedContracts(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    owner?: string;
  }): Promise<GetDisclosedContractsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetDisclosedContractsRequestSchema, params);
      return await this.client.getDisclosedContracts(request);
    }, 'getDisclosedContracts');
  }

  /**
   * Record a completed settlement (updates proposal AND creates settlements table record)
   * Called by settlement operator after successful Dvp_Settle execution
   */
  async recordSettlement(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    settledDvpCid: string;
    settlementUpdateId: string;
    settlementCompletionOffset: string;
  }): Promise<RecordSettlementResponse> {
    return await this.wrapCall(async () => {
      const request = create(RecordSettlementRequestSchema, params);
      return await this.client.recordSettlement(request);
    }, 'recordSettlement');
  }

  /**
   * Record a transaction in history
   */
  async recordTransaction(params: {
    auth: CantonNodeAuth;
    txType: TransactionType;
    senderParty: string;
    senderType: SenderType;
    result: TransactionResult;
    updateId?: string;
    submissionId?: string;
    settlementProposalId?: string;
    marketId?: string;
    counterparty?: string;
    contractId?: string;
    choiceName?: string;
    amount?: string;
    rewardsAmount?: string;
    rewardsRound?: bigint;
    trafficRequest?: bigint;
    trafficResponse?: bigint;
    trafficTotal?: bigint;
    activityMarkerCreated?: bigint;
    errorMessage?: string;
    metadata?: any;
    update?: any;
    damlTemplateId: string;
    damlChoice: string;
    damlChoices?: any;
  }): Promise<RecordTransactionResponse> {
    return await this.wrapCall(async () => {
      const request = create(RecordTransactionRequestSchema, params);
      return await this.client.recordTransaction(request);
    }, 'recordTransaction');
  }

  /**
   * Get transaction history with optional filters
   */
  async getTransactionHistory(params: {
    auth: CantonNodeAuth;
    senderParty?: string;
    txType?: TransactionType;
    settlementProposalId?: string;
    result?: TransactionResult;
    limit?: number;
    offset?: number;
  }): Promise<GetTransactionHistoryResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetTransactionHistoryRequestSchema, params);
      return await this.client.getTransactionHistory(request);
    }, 'getTransactionHistory');
  }
}
