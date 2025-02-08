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
import { TransferExtendedParams } from "./types.js";
export {
  NFTApprovalBase,
  NFTApprovalContractConstructor,
  NFTStandardApproval,
  NFTApprovalDeployProps,
  DefineApprovalFactory,
};
type DefineApprovalFactory = (params: {
  collectionContract: () => NFTCollectionContractConstructor;
}) => NFTApprovalContractConstructor;

/**
 * The `NFTApprovalBase` interface defines the administrative functionalities required for managing an NFT transfer approval on the Mina Protocol.
 */
type NFTApprovalBase = SmartContract & {
  /**
   * Determines if an NFT can be transferred from one owner (`from`) to another (`to`) for a specific NFT contract address.
   *
   * @param params - The transfer details.
   * @returns A `Promise` resolving to a `Bool` indicating whether the transfer is allowed.
   */
  canTransfer(params: TransferExtendedParams): Promise<Bool>;
};

/**
 * Defines a constructor for contracts implementing `NFTApprovalBase`, accepting an `address` public key and returning an instance of `NFTApprovalBase`.
 *
 * @param address - The public key of the contract's owner.
 * @returns An instance of `NFTApprovalBase`.
 */
type NFTApprovalContractConstructor = new (
  address: PublicKey
) => NFTApprovalBase;

interface NFTApprovalDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
}

/**
 * The **NFTStandardApproval** contract is the default implementation of the `NFTApprovalBase` interface.
 */
class NFTStandardApproval extends SmartContract implements NFTApprovalBase {
  /**
   * The public key of the contract's administrator.
   * This account has the authority to perform administrative actions such as pausing the contract or upgrading the verification key.
   */
  @state(PublicKey) admin = State<PublicKey>();

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: NFTApprovalDeployProps) {
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
  /**
   * Determines if an NFT can be transferred.
   *
   * @param params - The transfer details.
   * @returns A `Promise` resolving to a `Bool` indicating whether the transfer is allowed.
   */
  @method.returns(Bool)
  async canTransfer(params: TransferExtendedParams): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }
}
