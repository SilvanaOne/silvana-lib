import {
  AccountUpdate,
  Bool,
  DeployArgs,
  method,
  PublicKey,
  SmartContract,
  state,
  State,
  Permissions,
  VerificationKey,
} from "o1js";
import { NFTCollectionContractConstructor } from "./collection.js";
import { TransferExtendedParams } from "./types.js";
export {
  NFTOwnerBase,
  NFTOwnerContractConstructor,
  NFTOwnerDeployProps,
  NFTStandardOwner,
  DefineOwnerFactory,
};
type DefineOwnerFactory = (params: {
  collectionContract: () => NFTCollectionContractConstructor;
}) => NFTOwnerContractConstructor;

/**
 * The `NFTOwnerBase` interface defines the administrative functionalities required for managing an NFT collection on the Mina Protocol.
 * It extends the `SmartContract` class and specifies methods that enforce permissions and validations for various NFT operations.
 */
type NFTOwnerBase = SmartContract & {
  /**
   * Determines if an NFT can be transferred from one owner (`from`) to another (`to`) for a specific NFT contract address.
   *
   * @param params - The transfer event details.
   * @returns A `Promise` resolving to a `Bool` indicating whether the transfer is allowed.
   */
  canTransfer(params: TransferExtendedParams): Promise<Bool>;

  canApproveAddress(
    collection: PublicKey,
    nft: PublicKey,
    approved: PublicKey
  ): Promise<Bool>;

  canPause(collection: PublicKey, nft: PublicKey): Promise<Bool>;

  canResume(collection: PublicKey, nft: PublicKey): Promise<Bool>;

  canChangeVerificationKey(
    collection: PublicKey,
    nft: PublicKey,
    vk: VerificationKey
  ): Promise<Bool>;
};

/**
 * Defines a constructor for contracts implementing `NFTOwnerBase`, accepting an `address` public key and returning an instance of `NFTOwnerBase`.
 *
 * @param address - The public key of the contract's owner.
 * @returns An instance of `NFTOwnerBase`.
 */
type NFTOwnerContractConstructor = new (address: PublicKey) => NFTOwnerBase;

interface NFTOwnerDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
}

/**
 * The **NFTStandardOwner** contract is the default implementation of the `NFTOwnerBase` interface.

 */
class NFTStandardOwner extends SmartContract implements NFTOwnerBase {
  /**
   * The public key of the contract's administrator.
   * This account has the authority to perform administrative actions such as pausing the contract or upgrading the verification key.
   */
  @state(PublicKey) admin = State<PublicKey>();

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: NFTOwnerDeployProps) {
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
  async canTransfer(params: TransferExtendedParams): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }

  @method.returns(Bool)
  async canPause(collection: PublicKey, nft: PublicKey): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }

  @method.returns(Bool)
  async canResume(collection: PublicKey, nft: PublicKey): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }

  @method.returns(Bool)
  async canChangeVerificationKey(
    collection: PublicKey,
    nft: PublicKey,
    vk: VerificationKey
  ): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }

  @method.returns(Bool)
  async canApproveAddress(
    collection: PublicKey,
    nft: PublicKey,
    approved: PublicKey
  ): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }
}
