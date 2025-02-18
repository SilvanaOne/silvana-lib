import { Field, PublicKey, Poseidon } from "o1js";
export { MinaAddress };

/**
/**
 * The `MinaAddress` class represents a Mina address in the form of a Merkle tree. The address is converted to its
 * hash and stored as a leaf in the Merkle tree. The root of the tree can be used as a compact representation
 * of the address data in cryptographic proofs.
 */
class MinaAddress {
  /**
   * The original address.
   */
  readonly address: PublicKey;
  /**
   * The hash of the address.
   */
  readonly hash: Field;

  /**
   * Constructs a new `MinaAddress` instance by creating a Merkle tree from the given address.
   * The address is converted to its hash and stored as a leaf in the tree.
   *
   * @param address - The address to be represented.
   * @throws Will throw an error if the address is not a valid Mina address.
   */
  constructor(address: PublicKey | string) {
    this.address =
      typeof address === "string" ? PublicKey.fromBase58(address) : address;
    this.hash = Poseidon.hashPacked(PublicKey, this.address);
  }

  /**
   * Returns the original address.
   *
   * @returns The public key.
   */
  public toPublicKey(): PublicKey {
    return this.address;
  }

  /**
   * Returns the base58 representation of the address.
   *
   * @returns The base58 representation of the address.
   */
  public toString(): string {
    return this.address.toBase58();
  }
}
