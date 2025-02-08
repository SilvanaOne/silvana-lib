import {
  AccountUpdate,
  Bool,
  method,
  PublicKey,
  SmartContract,
  state,
  State,
  Permissions,
  DeployArgs,
} from "o1js";
import { NFTCollectionContractConstructor } from "./collection.js";
import { NFTState } from "./types.js";
export {
  NFTUpdateBase,
  NFTUpdateContractConstructor,
  NFTStandardUpdate,
  NFTUpdateDeployProps,
  DefineUpdateFactory,
};
type DefineUpdateFactory = (params: {
  collectionContract: () => NFTCollectionContractConstructor;
}) => NFTUpdateContractConstructor;

/**
 * The `NFTUpdateBase` interface defines the update functionalities required for managing an NFT update
 */
type NFTUpdateBase = SmartContract & {
  /**
   * Checks if an NFT can be updated from its current state (`input`) to a new state (`output`).
   *
   * @param collectionAddress - The public key of the NFT collection address.
   * @param nftAddress - The public key of the NFT.
   * @param input - The current state of the NFT.
   * @param output - The desired new state of the NFT.
   * @returns A `Promise` resolving to a `Bool` indicating whether the update is permitted.
   */
  canUpdate(
    collectionAddress: PublicKey,
    nftAddress: PublicKey,
    input: NFTState,
    output: NFTState
  ): Promise<Bool>;
};

/**
 * Defines a constructor for contracts implementing `NFTUpdateBase`, accepting an `address` public key and returning an instance of `NFTUpdateBase`.
 *
 * @param address - The public key of the contract's owner.
 * @returns An instance of `NFTUpdateBase`.
 */
type NFTUpdateContractConstructor = new (address: PublicKey) => NFTUpdateBase;

interface NFTUpdateDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
}

/**
 * The **NFTStandardUpdate** contract is the default implementation of the `NFTUpdateBase` interface.
 */
class NFTStandardUpdate extends SmartContract implements NFTUpdateBase {
  /**
   * The public key of the contract's administrator.
   */
  @state(PublicKey) admin = State<PublicKey>();

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: NFTUpdateDeployProps) {
    await super.deploy(props);
    this.admin.set(props.admin);
    this.account.zkappUri.set(props.uri);
    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey: Permissions.VerificationKey.signature(),
      setPermissions: Permissions.impossible(),
    });
  }

  /**
   * Ensures that the transaction is authorized by the contract owner.
   * @returns A signed `AccountUpdate` from the admin.
   */
  async ensureOwnerSignature(): Promise<AccountUpdate> {
    const admin = this.admin.getAndRequireEquals();
    const adminUpdate = AccountUpdate.createSigned(admin);
    adminUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
    return adminUpdate;
  }

  @method.returns(Bool)
  async canUpdate(
    collectionAddress: PublicKey,
    nftAddress: PublicKey,
    input: NFTState,
    output: NFTState
  ): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }
}
