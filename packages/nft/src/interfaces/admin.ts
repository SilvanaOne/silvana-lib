import {
  Bool,
  PublicKey,
  SmartContract,
  VerificationKey,
  Field,
  UInt32,
  UInt64,
} from "o1js";
import { MintParamsOption, MintRequest, NFTState } from "./types.js";
import { TransferEvent } from "./events.js";
export { NFTAdminBase, NFTAdminContractConstructor };

/**
 * The `NFTAdminBase` interface defines the administrative functionalities required for managing an NFT collection on the Mina Protocol.
 * It extends the `SmartContract` class and specifies methods that enforce permissions and validations for various NFT operations.
 */
type NFTAdminBase = SmartContract & {
  /**
   * Validates whether a new NFT can be minted based on the provided `MintRequest`.
   *
   * @param nft - The mint request containing details of the NFT to be minted.
   * @returns A `Promise` resolving to `MintParamsOption`, containing mint parameters if minting is allowed, or an empty option if not.
   */
  canMint(nft: MintRequest): Promise<MintParamsOption>;

  /**
   * Checks if an NFT can be updated from its current state (`input`) to a new state (`output`).
   *
   * @param input - The current state of the NFT.
   * @param output - The desired new state of the NFT.
   * @returns A `Promise` resolving to a `Bool` indicating whether the update is permitted.
   */
  canUpdate(input: NFTState, output: NFTState): Promise<Bool>;

  /**
   * Determines if an NFT can be transferred from one owner (`from`) to another (`to`) for a specific NFT contract address.
   *
   * @param transferEvent - The transfer event containing details of the transfer.
   * @returns A `Promise` resolving to a `Bool` indicating whether the transfer is allowed.
   */
  canTransfer(transferEvent: TransferEvent): Promise<Bool>;

  /**
   * Determines if the name can be changed for a Collection.
   *
   * @param name - The new name for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the name change is allowed.
   */
  canChangeName(name: Field): Promise<Bool>;

  /**
   * Determines if the creator can be changed for a Collection.
   *
   * @param creator - The new creator for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the creator change is allowed.
   */
  canChangeCreator(creator: PublicKey): Promise<Bool>;

  /**
   * Determines if the base URI can be changed for a Collection.
   *
   * @param baseUri - The new base URI for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the base URI change is allowed.
   */
  canChangeBaseUri(baseUri: Field): Promise<Bool>;

  /**
   * Determines if the royalty fee can be changed for a Collection.
   *
   * @param royaltyFee - The new royalty fee for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the royalty fee change is allowed.
   */
  canChangeRoyalty(royaltyFee: UInt32): Promise<Bool>;

  /**
   * Determines if the transfer fee can be changed for a Collection.
   *
   * @param transferFee - The new transfer fee for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the transfer fee change is allowed.
   */
  canChangeTransferFee(transferFee: UInt64): Promise<Bool>;

  /**
   * Determines if the admin contract can be changed for a Collection.
   *
   * @param admin - The new admin for the Collection.
   * @returns A `Promise` resolving to a `Bool` indicating whether the admin contract change is allowed.
   */
  canSetAdmin(admin: PublicKey): Promise<Bool>;

  /**
   * Determines if the collection can be paused.
   *
   * @returns A `Promise` resolving to a `Bool` indicating whether the collection can be paused.
   */
  canPause(): Promise<Bool>;

  /**
   * Determines if the collection can be resumed.
   *
   * @returns A `Promise` resolving to a `Bool` indicating whether the collection can be resumed.
   */
  canResume(): Promise<Bool>;

  /**
   * Determines if the verification key can be changed for a specific NFT contract address and token ID.
   *
   * @param vk - The verification key to be changed.
   * @param address - The public key of the NFT contract address or CollectionContract address.
   * @param tokenId - The token ID of the NFT.
   * @returns A `Promise` resolving to a `Bool` indicating whether the verification key change is allowed.
   */
  canChangeVerificationKey(
    vk: VerificationKey,
    address: PublicKey,
    tokenId: Field
  ): Promise<Bool>;
};

/**
 * Defines a constructor for contracts implementing `NFTAdminBase`, accepting an `address` public key and returning an instance of `NFTAdminBase`.
 *
 * @param address - The contract's address.
 * @returns An instance of `NFTAdminBase`.
 */
type NFTAdminContractConstructor = new (address: PublicKey) => NFTAdminBase;
