import { createClient, ConnectError } from "@connectrpc/connect";
import type { Transport } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import type { JsonObject } from "@bufbuild/protobuf";
import { TimestampSchema } from "@bufbuild/protobuf/wkt";

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
  type CancelSettlementResponse,
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
  CancelSettlementRequestSchema,
  ReportErrorsRequestSchema,
  type ReportErrorsResponse,
  TransactionType,
  SenderType,
  TransactionResult,
  SettlementEventType,
  RecordedByRole,
  SettlementEventResult,
  UpdateProposalStatusRequest_NewStatus,
} from "./proto/silvana/settlement/v1/settlement_pb.js";

// Export all types and schemas from the generated protobuf file
export {
  file_silvana_settlement_v1_settlement,
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
  type CancelSettlementRequest,
  CancelSettlementRequestSchema,
  type CancelSettlementResponse,
  CancelSettlementResponseSchema,
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
  type RfqRequest,
  RfqRequestSchema,
  type RfqQuote,
  RfqQuoteSchema,
  type RfqReject,
  RfqRejectSchema,
  RfqDirection,
  RfqDirectionSchema,
  RfqRejectionReason,
  RfqRejectionReasonSchema,
  NextAction,
  NextActionSchema,
  // Error reporting (cross-stack structured error ingestion)
  type ErrorEvent,
  ErrorEventSchema,
  type ReportErrorsRequest,
  ReportErrorsRequestSchema,
  type ReportErrorsResponse,
  ReportErrorsResponseSchema,
  type ErrorRejection,
  ErrorRejectionSchema,
  SettlementService,
} from "./proto/silvana/settlement/v1/settlement_pb.js";

/**
 * Converts a Date to a Timestamp message
 */
function dateToTimestamp(date: Date) {
  const seconds = BigInt(Math.floor(date.getTime() / 1000));
  const nanos = (date.getTime() % 1000) * 1000000;
  return create(TimestampSchema, { seconds, nanos });
}

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
  /** JWT token for authentication (passed via gRPC metadata header) */
  token: string;
}

/**
 * Settlement client for interacting with the Silvana Settlement Service
 */
export class SettlementClient {
  private client: ReturnType<typeof createClient<typeof SettlementService>>;
  private authHeaders: HeadersInit;

  /**
   * Creates a new SettlementClient instance
   * @param config Client configuration
   */
  constructor(config: SettlementClientConfig) {
    this.client = createClient(SettlementService, config.transport);
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
    partyId: string;
    limit?: number;
  }): Promise<GetPendingProposalsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetPendingProposalsRequestSchema, params);
      return await this.client.getPendingProposals(request, this.callOptions());
    }, 'getPendingProposals');
  }

  /**
   * Query settlement status
   */
  async getSettlementStatus(params: {
    settlementId: string;
  }): Promise<GetSettlementStatusResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementStatusRequestSchema, params);
      return await this.client.getSettlementStatus(request, this.callOptions());
    }, 'getSettlementStatus');
  }

  /**
   * Manual preconfirmation (if not using stream)
   */
  async submitPreconfirmation(params: {
    decision: PreconfirmationDecision;
  }): Promise<void> {
    return await this.wrapCall(async () => {
      const request = create(SubmitPreconfirmationRequestSchema, params);
      await this.client.submitPreconfirmation(request, this.callOptions());
    }, 'submitPreconfirmation');
  }

  /**
   * Record a settlement event to the settlement_proposal_history table
   * Any party (buyer/seller/operator/system) can record events for DVP flow tracking
   */
  async recordSettlementEvent(params: {
    proposalId: string;
    recordedBy?: string;
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
      return await this.client.recordSettlementEvent(request, this.callOptions());
    }, 'recordSettlementEvent');
  }

  /**
   * Get settlement event history for a proposal
   */
  async getSettlementHistory(params: {
    proposalId: string;
    eventType?: SettlementEventType;
    result?: SettlementEventResult;
    limit?: number;
    offset?: number;
  }): Promise<GetSettlementHistoryResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementHistoryRequestSchema, params);
      return await this.client.getSettlementHistory(request, this.callOptions());
    }, 'getSettlementHistory');
  }

  /**
   * Update proposal status (operator only)
   */
  async updateProposalStatus(params: {
    proposalId: string;
    newStatus: UpdateProposalStatusRequest_NewStatus;
    errorMessage?: string;
  }): Promise<UpdateProposalStatusResponse> {
    return await this.wrapCall(async () => {
      const request = create(UpdateProposalStatusRequestSchema, params);
      return await this.client.updateProposalStatus(request, this.callOptions());
    }, 'updateProposalStatus');
  }

  /**
   * Cancel a settlement (buyer or seller can cancel before settlement execution)
   */
  async cancelSettlement(params: {
    proposalId: string;
    reason: string;
  }): Promise<CancelSettlementResponse> {
    return await this.wrapCall(async () => {
      const request = create(CancelSettlementRequestSchema, params);
      return await this.client.cancelSettlement(request, this.callOptions());
    }, 'cancelSettlement');
  }

  /**
   * Get a settlement proposal by ID
   */
  async getSettlementProposalById(params: {
    proposalId: string;
  }): Promise<GetSettlementProposalByIdResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetSettlementProposalByIdRequestSchema, {
        proposalId: params.proposalId,
      });
      return await this.client.getSettlementProposalById(request, this.callOptions());
    }, 'getSettlementProposalById');
  }

  /**
   * Save a disclosed contract (buyer/seller saves during allocation)
   */
  async saveDisclosedContract(params: {
    proposalId: string;
    contract: DisclosedContractMessage;
  }): Promise<SaveDisclosedContractResponse> {
    return await this.wrapCall(async () => {
      const request = create(SaveDisclosedContractRequestSchema, params);
      return await this.client.saveDisclosedContract(request, this.callOptions());
    }, 'saveDisclosedContract');
  }

  /**
   * Get disclosed contracts (operator gets all, buyer/seller gets own)
   */
  async getDisclosedContracts(params: {
    proposalId: string;
    owner?: string;
  }): Promise<GetDisclosedContractsResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetDisclosedContractsRequestSchema, params);
      return await this.client.getDisclosedContracts(request, this.callOptions());
    }, 'getDisclosedContracts');
  }

  /**
   * Record a completed settlement (updates proposal AND creates settlements table record)
   * Called by settlement operator after successful Dvp_Settle execution
   */
  async recordSettlement(params: {
    proposalId: string;
    settledDvpCid: string;
    settlementUpdateId: string;
    settlementCompletionOffset: string;
  }): Promise<RecordSettlementResponse> {
    return await this.wrapCall(async () => {
      const request = create(RecordSettlementRequestSchema, params);
      return await this.client.recordSettlement(request, this.callOptions());
    }, 'recordSettlement');
  }

  /**
   * Record a transaction in history
   */
  async recordTransaction(params: {
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
    token?: string;
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
      return await this.client.recordTransaction(request, this.callOptions());
    }, 'recordTransaction');
  }

  /**
   * Get transaction history with optional filters
   */
  async getTransactionHistory(params: {
    senderParty?: string;
    txType?: TransactionType;
    settlementProposalId?: string;
    result?: TransactionResult;
    limit?: number;
    offset?: number;
  }): Promise<GetTransactionHistoryResponse> {
    return await this.wrapCall(async () => {
      const request = create(GetTransactionHistoryRequestSchema, params);
      return await this.client.getTransactionHistory(request, this.callOptions());
    }, 'getTransactionHistory');
  }

  /**
   * Report structured errors (best-effort ingestion; max 50 per batch —
   * a larger batch fails WHOLE with INVALID_ARGUMENT, no per-event
   * rejections).
   *
   * Auth is EXCLUSIVELY the Bearer JWT — the server derives the reporter
   * from it and may overwrite partyId/venueName per its caller-class rules
   * (untrusted callers cannot attribute errors to other parties). The
   * response carries accepted/rejected counts plus per-event rejections
   * with reason "rate_limited" | "invalid" ("too_large" is reserved but
   * currently unused — oversize payloads are truncated server-side
   * instead); callers should drop rejected events, never retry them.
   * Requests over the per-IP pre-auth rate limit fail with
   * RESOURCE_EXHAUSTED.
   *
   * Pass plain objects — this wrapper owns create() (constructing the
   * request yourself and passing it here loses Struct fields; see the
   * double-create() pitfall).
   */
  async reportErrors(params: {
    errors: Array<{
      /** "frontend-orderbook" | "frontend-swap" | "agent" (server-whitelisted) */
      source?: string;
      /** "debug"|"info"|"warning"|"error"|"critical"; empty => "error" */
      severity?: string;
      /**
       * Error classification. For non-Trusted callers, values outside the
       * server's vocabulary are STORED AS "CLIENT_ERROR" with the raw label
       * moved into error_code (the column is an indexed analytics dimension
       * and must not be free-text).
       */
      errorType: string;
      errorCode?: string;
      errorMessage?: string;
      /** Subject party (whose flow failed) */
      partyId?: string;
      updateId?: string;
      commandId?: string;
      submissionId?: string;
      contractId?: string;
      damlTemplateId?: string;
      damlChoice?: string;
      settlementProposalId?: string;
      marketId?: string;
      orderId?: string;
      venueName?: string;
      venueBranch?: string;
      /** Session / trace id (frontends: per-tab uuid v7) */
      correlationId?: string;
      /** Build/commit stamp, e.g. NEXT_PUBLIC_GIT_COMMIT */
      appVersion?: string;
      /** Code path, e.g. "useSwapSettlement" */
      module?: string;
      /**
       * google.protobuf.Struct — JSON-serializable values ONLY, <= 16 KiB
       * serialized. Pass `err.stack` as a string; an Error or Date object
       * silently encodes as {} (non-enumerable/unsupported fields).
       */
      metadata?: JsonObject;
      /** When the error occurred (client clock; converted to a Timestamp) */
      occurredAt?: Date;
    }>;
  }): Promise<ReportErrorsResponse> {
    return await this.wrapCall(async () => {
      const request = create(ReportErrorsRequestSchema, {
        errors: params.errors.map((e) => ({
          ...e,
          occurredAt: e.occurredAt ? dateToTimestamp(e.occurredAt) : undefined,
        })),
      });
      return await this.client.reportErrors(request, this.callOptions());
    }, 'reportErrors');
  }
}
