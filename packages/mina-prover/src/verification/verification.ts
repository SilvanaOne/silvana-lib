import { CanonicalBlockchain } from "@silvana-one/api";
import { SmartContract } from "o1js";

/**
 * VerificationData is a data structure that contains all the information needed to verify a smart contract on a blockchain.
 * contract: The smart contract that needs to be verified.
 * contractDependencies: The smart contracts that need to be compiled before verification.
 * programDependencies: The zk programs that need to be compiled before verification.
 * address: The address of the smart contract on the blockchain.
 * chain: The blockchain on which the smart contract is deployed.
 * image: The logo of the smart contract (public url)
 *
 * Contract, contractDependencies, and programDependencies should be exported from the repo
 */

export interface VerificationData {
  contract: typeof SmartContract;
  contractDependencies?: (typeof SmartContract)[];
  programDependencies?: any[]; // ZkProgram[];
  address: string;
  chain: CanonicalBlockchain;
  image?: string;
}
