import { PublicKey, SmartContract, Field, Struct, Bool } from "o1js";

/**
 * Interface representing ownable functionality for smart contracts.
 *
 * The `OwnableContract` interface extends `SmartContract` and provides methods to ensure that only the owner
 * can perform certain actions and to allow the transfer of ownership to a new owner.
 *
 * By implementing the Ownable interface, contracts can secure critical operations and provide a transparent
 * mechanism for ownership management.
 *
 * @interface
 */
export type OwnableContract = SmartContract & {
  /**
   * Transfers ownership of the contract to a new owner.
   *
   * @param {PublicKey} to - The public key of the new owner.
   * @returns {Promise<PublicKey>} A promise that resolves to the public key of the old owner.
   */
  transferOwnership(to: PublicKey): Promise<PublicKey>; // returns the old owner
};

/**
 * Event emitted when the ownership of the contract changes.
 *
 * Contains the old owner's and new owner's public keys.
 */
export class OwnershipChangeEvent extends Struct({
  from: PublicKey,
  to: PublicKey,
}) {}
