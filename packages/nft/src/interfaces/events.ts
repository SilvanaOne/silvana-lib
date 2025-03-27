import { PublicKey, Struct, UInt32, Field, Bool, UInt64 } from "o1js";
import { Storage } from "@silvana-one/storage";
import { NFTStateStruct, UInt64Option } from "./types.js";

export {
  MintEvent,
  UpdateEvent,
  TransferEvent,
  UpgradeVerificationKeyEvent,
  UpgradeVerificationKeyData,
  LimitMintingEvent,
  PauseNFTEvent,
  ApproveEvent,
};

/**
 * Emitted when a new NFT is minted in the collection.
 */
class MintEvent extends Struct({
  /** The initial state of the NFT at the time of minting. */
  initialState: NFTStateStruct,
  /** The public key address of the minted NFT. */
  address: PublicKey,
  /** The token ID of the minted NFT. */
  tokenId: Field,
  /** The fee paid for the minting.
   *  This fee is controlled by the admin contract
   *  and is not checked by the Collection contract
   *  Please check the admin contract code before using this fee
   */
  fee: UInt64,
}) {}

/**
 * Emitted when an NFT's state is updated.
 */
class UpdateEvent extends Struct({
  /** The updated name of the NFT. */
  name: Field,
  /** The updated metadata hash of the NFT. */
  metadata: Field,
  /** Off-chain storage information, e.g., IPFS hash. */
  storage: Storage,
  /** The owner of the NFT after the update. */
  owner: PublicKey,
  /** The approved address of the NFT after the update. */
  approved: PublicKey,
  /** The version number of the NFT state. */
  version: UInt32,
  /** Indicates whether the NFT is paused after the update. */
  isPaused: Bool,
  /** The hash of the verification key used for metadata proofs. */
  metadataVerificationKeyHash: Field,
}) {}

/**
 * Emitted when an NFT's approved address is updated.
 */
class ApproveEvent extends Struct({
  /** The public key address of the NFT. */
  nftAddress: PublicKey,
  /** The public key of the approved address. */
  approved: PublicKey,
}) {}

/**
 * Emitted when an NFT is transferred from one owner to another.
 */
class TransferEvent extends Struct({
  /** The public key of the sender (current owner) before the transfer. */
  from: PublicKey,
  /** The public key of the recipient (new owner) after the transfer. */
  to: PublicKey,
  /** The public key of the collection. */
  collection: PublicKey,
  /** The public key address of the NFT being transferred. */
  nft: PublicKey,
  /** The fee paid for the transfer. */
  fee: UInt64Option,
  /** The price of the NFT being transferred. */
  price: UInt64Option,
  /** Indicates whether the transfer is by owner or by approved address. */
  transferByOwner: Bool,
  /** The public key of the approved address. */
  approved: PublicKey,
}) {}

/**
 * Emitted when an NFT is paused or resumed.
 */
class PauseNFTEvent extends Struct({
  /** The public key address of the NFT. */
  address: PublicKey,
  /** Indicates whether the NFT is paused (`true`) or resumed (`false`). */
  isPaused: Bool,
}) {}

/**
 * Emitted when the verification key of an NFT is upgraded.
 */
class UpgradeVerificationKeyEvent extends Struct({
  /** The hash of the new verification key. */
  verificationKeyHash: Field,
  /** The public key address of the NFT whose verification key is upgraded. */
  address: PublicKey,
  /** The tokenId of the upgraded contract */
  tokenId: Field,
}) {}

class UpgradeVerificationKeyData extends Struct({
  /** The owner of the NFT. */
  owner: PublicKey,
  /** Indicates whether the owner approval is required to upgrade the verification key. */
  isOwnerApprovalRequired: Bool,
}) {}

/**
 * Emitted when minting of new NFTs is limited in the collection.
 */
class LimitMintingEvent extends Struct({
  /** Indicates whether minting is limited (`true`) or not (`false`). */
  mintingLimited: Bool,
}) {}
