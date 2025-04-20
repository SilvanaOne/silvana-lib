export type JobChain =
  | "mina"
  | "zeko"
  | "sui"
  | "solana"
  | "ethereum"
  | "walrus"
  | "project-untitled"
  | "celestia"
  | "pinata";

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

export interface JobTransactionHash extends JobMetadataBase {
  chain: JobChain;
  network: JobNetwork;
  hash: string;
}

export interface JobProof extends JobMetadataBase {
  // at least one of the following fields must be provided
  storage?: JobTransactionHash;
  proof?: string | object;
}

export interface JobMetadata {
  settlement_txs?: JobTransactionHash[];
  coordination_txs?: JobTransactionHash[];
  data_availability_txs?: JobTransactionHash[];
  proof_availability_txs?: JobTransactionHash[];
  proofs?: JobProof[];
}
