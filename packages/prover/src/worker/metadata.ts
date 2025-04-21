export type JobSettlementChain = "mina" | "zeko" | "ethereum";

export type JobDataAvailabilityChain =
  | "walrus"
  | "project-untitled"
  | "celestia"
  | "pinata";

export type JobCoordinationChain = "sui" | "solana";

export type JobNetwork =
  | "mainnet"
  | "testnet"
  | "devnet"
  | "public"
  | "private";

export interface JobMetadataBase {
  linkId?: string;
  custom?: object | string;
}

export interface JobSettlementTransactionHash extends JobMetadataBase {
  chain: JobSettlementChain;
  network: JobNetwork;
  hash: string;
}

export interface JobCoordinationTransactionHash extends JobMetadataBase {
  chain: JobCoordinationChain;
  network: JobNetwork;
  hash: string;
}

export interface JobDataAvailabilityTransactionHash extends JobMetadataBase {
  chain: JobDataAvailabilityChain;
  network: JobNetwork;
  hash: string;
}

export interface JobProof extends JobMetadataBase {
  // at least one of the following fields must be provided
  storage?: JobDataAvailabilityTransactionHash;
  proof?: string | object;
}

export interface JobMetadata {
  settlement_txs?: JobSettlementTransactionHash[];
  coordination_txs?: JobCoordinationTransactionHash[];
  data_availability_txs?: JobDataAvailabilityTransactionHash[];
  proof_availability_txs?: JobDataAvailabilityTransactionHash[];
  proofs?: JobProof[];
}
