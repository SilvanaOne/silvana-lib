import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";

// Import types needed for internal implementation
import {
  SettlementService,
  type GetPendingProposalsResponse,
  type GetSettlementStatusResponse,
  type SaveDisclosedContractResponse,
  type GetDisclosedContractsResponse,
  type RecordSettlementResponse,
  type RecordTransactionResponse,
  type GetTransactionHistoryResponse,
  type RecordSettlementEventResponse,
  type GetSettlementHistoryResponse,
  type UpdateProposalStatusResponse,
  type GetSettlementProposalByIdResponse,
  type DisclosedContractMessage,
  type CantonNodeAuth,
  type PreconfirmationDecision,
  type CantonToServerMessage,
  GetPendingProposalsRequestSchema,
  GetSettlementStatusRequestSchema,
  SubmitPreconfirmationRequestSchema,
  SaveDisclosedContractRequestSchema,
  GetDisclosedContractsRequestSchema,
  RecordSettlementRequestSchema,
  RecordTransactionRequestSchema,
  GetTransactionHistoryRequestSchema,
  RecordSettlementEventRequestSchema,
  GetSettlementHistoryRequestSchema,
  UpdateProposalStatusRequestSchema,
  GetSettlementProposalByIdRequestSchema,
  TransactionType,
  SenderType,
  TransactionResult,
  SettlementEventType,
  RecordedByRole,
  SettlementEventResult,
  UpdateProposalStatusRequest_NewStatus,
} from "./proto/silvana/settlement/v1/settlement_pb.js";

// Export all types and schemas from the generated protobuf file
// Exclude ExternalAuth and ExternalAuthSchema as they conflict with orderbook exports
export {
  file_proto_silvana_settlement_v1_settlement,
  type CantonNodeAuth,
  CantonNodeAuthSchema,
  type SettlementInstrument,
  SettlementInstrumentSchema,
  type SettlementProposalMessage,
  SettlementProposalMessageSchema,
  type PreconfirmationRequest,
  PreconfirmationRequestSchema,
  type PreconfirmationDecision,
  PreconfirmationDecisionSchema,
  type DvpContractCreated,
  DvpContractCreatedSchema,
  type DvpContractAccepted,
  DvpContractAcceptedSchema,
  type AllocationStatus,
  AllocationStatusSchema,
  type SettlementExecutionStatus,
  SettlementExecutionStatusSchema,
  type UserServiceInfo,
  UserServiceInfoSchema,
  type SettlementHandshake,
  SettlementHandshakeSchema,
  type HandshakeAck,
  HandshakeAckSchema,
  type Heartbeat,
  HeartbeatSchema,
  type LiquidityProviderPing,
  LiquidityProviderPingSchema,
  type LiquidityProviderPong,
  LiquidityProviderPongSchema,
  type ServerToCantonMessage,
  ServerToCantonMessageSchema,
  type CantonToServerMessage,
  CantonToServerMessageSchema,
  type DvpCreationReport,
  DvpCreationReportSchema,
  type DvpAcceptanceReport,
  DvpAcceptanceReportSchema,
  type AllocationReport,
  AllocationReportSchema,
  type SettlementReport,
  SettlementReportSchema,
  type ErrorReport,
  ErrorReportSchema,
  type StatusUpdate,
  StatusUpdateSchema,
  type SettlementCommand,
  SettlementCommandSchema,
  type GetPendingProposalsRequest,
  GetPendingProposalsRequestSchema,
  type GetPendingProposalsResponse,
  GetPendingProposalsResponseSchema,
  type GetSettlementStatusRequest,
  GetSettlementStatusRequestSchema,
  type GetSettlementStatusResponse,
  GetSettlementStatusResponseSchema,
  type SubmitPreconfirmationRequest,
  SubmitPreconfirmationRequestSchema,
  type SaveDisclosedContractRequest,
  SaveDisclosedContractRequestSchema,
  type SaveDisclosedContractResponse,
  SaveDisclosedContractResponseSchema,
  type GetDisclosedContractsRequest,
  GetDisclosedContractsRequestSchema,
  type GetDisclosedContractsResponse,
  GetDisclosedContractsResponseSchema,
  type DisclosedContractMessage,
  DisclosedContractMessageSchema,
  type RecordSettlementRequest,
  RecordSettlementRequestSchema,
  type RecordSettlementResponse,
  RecordSettlementResponseSchema,
  type RecordTransactionRequest,
  RecordTransactionRequestSchema,
  type RecordTransactionResponse,
  RecordTransactionResponseSchema,
  type GetTransactionHistoryRequest,
  GetTransactionHistoryRequestSchema,
  type GetTransactionHistoryResponse,
  GetTransactionHistoryResponseSchema,
  type TransactionHistoryEntry,
  TransactionHistoryEntrySchema,
  type RecordSettlementEventRequest,
  RecordSettlementEventRequestSchema,
  type RecordSettlementEventResponse,
  RecordSettlementEventResponseSchema,
  type GetSettlementHistoryRequest,
  GetSettlementHistoryRequestSchema,
  type GetSettlementHistoryResponse,
  GetSettlementHistoryResponseSchema,
  type SettlementHistoryEntry,
  SettlementHistoryEntrySchema,
  type UpdateProposalStatusRequest,
  UpdateProposalStatusRequestSchema,
  UpdateProposalStatusRequest_NewStatus,
  UpdateProposalStatusRequest_NewStatusSchema,
  type UpdateProposalStatusResponse,
  UpdateProposalStatusResponseSchema,
  type GetSettlementProposalByIdRequest,
  GetSettlementProposalByIdRequestSchema,
  type GetSettlementProposalByIdResponse,
  GetSettlementProposalByIdResponseSchema,
  type DvpStepStatus,
  DvpStepStatusSchema,
  SettlementStage,
  SettlementStageSchema,
  PreconfirmationResponse,
  PreconfirmationResponseSchema,
  PartyRole,
  PartyRoleSchema,
  TransactionType,
  TransactionTypeSchema,
  SenderType,
  SenderTypeSchema,
  TransactionResult,
  TransactionResultSchema,
  SettlementEventType,
  SettlementEventTypeSchema,
  RecordedByRole,
  RecordedByRoleSchema,
  SettlementEventResult,
  SettlementEventResultSchema,
  DvpStepStatusEnum,
  DvpStepStatusEnumSchema,
  SettlementService,
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
   * Record a settlement event to the settlement_proposal_history table
   * Any party (buyer/seller/operator/system) can record events for DVP flow tracking
   */
  async recordSettlementEvent(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    recordedBy: string;
    recordedByRole: RecordedByRole;
    eventType: SettlementEventType;
    submissionId?: string;
    updateId?: string;
    contractId?: string;
    templateId?: string;
    result: SettlementEventResult;
    errorMessage?: string;
    metadata?: any;
  }): Promise<RecordSettlementEventResponse> {
    return await this.wrapCall(async () => {
      const request = create(RecordSettlementEventRequestSchema, params);
      return await this.client.recordSettlementEvent(request);
    }, 'recordSettlementEvent');
  }

  /**
   * Get settlement event history for a proposal
   */
  async getSettlementHistory(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    eventType?: SettlementEventType;
    result?: SettlementEventResult;
    limit?: number;
    offset?: number;
  }): Promise<GetSettlementHistoryResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementHistoryRequestSchema, params);
      return await this.client.getSettlementHistory(request);
    }, 'getSettlementHistory');
  }

  /**
   * Update proposal status (operator only)
   */
  async updateProposalStatus(params: {
    auth: CantonNodeAuth;
    proposalId: string;
    newStatus: UpdateProposalStatusRequest_NewStatus;
    errorMessage?: string;
  }): Promise<UpdateProposalStatusResponse> {
    return await this.wrapCall(async () => {
      const request = create(UpdateProposalStatusRequestSchema, params);
      return await this.client.updateProposalStatus(request);
    }, 'updateProposalStatus');
  }

  /**
   * Get a settlement proposal by ID
   */
  async getSettlementProposalById(params: {
    auth: CantonNodeAuth;
    proposalId: string;
  }): Promise<GetSettlementProposalByIdResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementProposalByIdRequestSchema, {
        auth: { case: "cantonAuth", value: params.auth },
        proposalId: params.proposalId,
      });
      return await this.client.getSettlementProposalById(request);
    }, 'getSettlementProposalById');
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
