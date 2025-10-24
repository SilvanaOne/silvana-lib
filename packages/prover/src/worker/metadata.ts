import { CanonicalBlockchain } from "@silvana-one/api";

export type JobDataAvailabilityChain =
  | "walrus"
  | "project-untitled"
  | "celestia"
  | "pinata";

export interface JobMetadataBase {
  linkId?: string;
  custom?: object | string;
}

export interface JobSettlementTransactionHash extends JobMetadataBase {
  chain: CanonicalBlockchain;
  hash: string;
}

export interface JobDataAvailabilityTransactionHash extends JobMetadataBase {
  chain: JobDataAvailabilityChain;
  network: CanonicalBlockchain;
  hash: string;
}

export interface JobProof extends JobMetadataBase {
  // at least one of the following fields must be provided
  storage?: JobDataAvailabilityTransactionHash;
  proof?: string | object;
}

export interface JobMetadata {
  settlement_txs?: JobSettlementTransactionHash[];
  data_availability_txs?: JobDataAvailabilityTransactionHash[];
  proof_availability_txs?: JobDataAvailabilityTransactionHash[];
  proofs?: JobProof[];
}
