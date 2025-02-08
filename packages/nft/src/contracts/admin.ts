import {
  Bool,
  DeployArgs,
  method,
  Permissions,
  PublicKey,
  SmartContract,
  State,
  state,
  VerificationKey,
  UInt64,
  Field,
  AccountUpdate,
  UInt32,
} from "o1js";
import {
  MintRequest,
  NFTState,
  NFTAdminBase,
  MintParamsOption,
  PausableContract,
  PauseEvent,
  OwnershipChangeEvent,
  OwnableContract,
  TransferEvent,
} from "../interfaces/index.js";
export { NFTAdmin, NFTAdminDeployProps };

interface NFTAdminDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
  canBePaused?: Bool;
  allowChangeRoyalty?: Bool;
  allowChangeTransferFee?: Bool;
  isPaused?: Bool;
}

/**
 * The **NFTAdmin** contract serves as the foundational administrative layer for NFT collections on the Mina Protocol.
 * It provides essential functionalities such as contract upgrades, pausing and resuming operations, and ownership management.
 * This contract can be extended by custom admin contracts to implement specific administrative logic,
 * ensuring flexibility while maintaining a standardized interface.
 */
class NFTAdmin
  extends SmartContract
  implements NFTAdminBase, PausableContract, OwnableContract
{
  /**
   * The public key of the contract's administrator.
   * This account has the authority to perform administrative actions such as pausing the contract or upgrading the verification key.
   */
  @state(PublicKey) admin = State<PublicKey>();

  /**
   * A boolean flag indicating whether the contract is currently paused.
   * When `true`, certain operations are disabled.
   */
  @state(Bool) isPaused = State<Bool>();

  /**
   * A boolean flag indicating whether the contract has the ability to be paused.
   * This allows for disabling the pause functionality if desired.
   */
  @state(Bool) canBePaused = State<Bool>();

  /**
   * A boolean flag indicating whether the contract has the ability to change the royalty fee.
   */
  @state(Bool) allowChangeRoyalty = State<Bool>();

  /**
   * A boolean flag indicating whether the contract has the ability to change the transfer fee.
   */
  @state(Bool) allowChangeTransferFee = State<Bool>();

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: NFTAdminDeployProps) {
    await super.deploy(props);
    this.admin.set(props.admin);
    this.isPaused.set(props.isPaused ?? Bool(false));
    this.canBePaused.set(props.canBePaused ?? Bool(true));
    this.allowChangeRoyalty.set(props.allowChangeRoyalty ?? Bool(false));
    this.allowChangeTransferFee.set(
      props.allowChangeTransferFee ?? Bool(false)
    );
    this.account.zkappUri.set(props.uri);
    this.account.permissions.set({
      ...Permissions.default(),
      // Allow the upgrade authority to set the verification key
      // even when there is no protocol upgrade
      setVerificationKey:
        Permissions.VerificationKey.proofDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
      access: Permissions.proof(),
      send: Permissions.proof(),
      setZkappUri: Permissions.none(),
      setTokenSymbol: Permissions.none(),
    });
  }

  /**
   * Contract events emitted during various operations.
   */
  events = {
    /** Emitted when the verification key is upgraded. */
    upgradeVerificationKey: Field,
    /** Emitted when the contract is paused. */
    pause: PauseEvent,
    /** Emitted when the contract is resumed. */
    resume: PauseEvent,
    /** Emitted when ownership of the contract changes. */
    ownershipChange: OwnershipChangeEvent,
  };

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
   * Upgrades the contract's verification key after validating with the upgrade authority.
   * @param vk - The new verification key to upgrade to.
   */
  @method
  async upgradeVerificationKey(vk: VerificationKey) {
    await this.ensureOwnerSignature();

    // Set the new verification key
    this.account.verificationKey.set(vk);

    // Emit the upgrade event
    this.emitEvent("upgradeVerificationKey", vk.hash);
  }

  /**
   * Determines whether minting is allowed for the given request.
   * Returns mint parameters if allowed, or none if not allowed.
   * @param mintRequest - The minting request details.
   * @returns A `MintParamsOption` indicating if minting is permitted.
   */
  @method.returns(MintParamsOption)
  async canMint(mintRequest: MintRequest): Promise<MintParamsOption> {
    // Only the creator can mint by default
    return MintParamsOption.none();
  }

  /**
   * Checks whether the NFT state can be updated.
   * Typically returns true if the contract is not paused.
   * @param input - The current state of the NFT.
   * @param output - The desired new state of the NFT.
   * @returns A `Bool` indicating whether the update is allowed.
   */
  @method.returns(Bool)
  async canUpdate(input: NFTState, output: NFTState): Promise<Bool> {
    return Bool(true);
  }

  /**
   * Determines whether a transfer between the specified addresses is permitted.
   * @param transferEvent - The transfer event details.
   * @returns A `Bool` indicating whether the transfer is allowed.
   */
  @method.returns(Bool)
  async canTransfer(transferEvent: TransferEvent): Promise<Bool> {
    return Bool(true);
  }

  /**
   * Pauses the contract, disabling certain administrative actions.
   * Can only be called by the admin if `canPause` is `true`.
   */
  @method
  async pause(): Promise<void> {
    await this.ensureOwnerSignature();
    this.canBePaused.getAndRequireEquals().assertTrue();
    this.isPaused.set(Bool(true));
    this.emitEvent("pause", new PauseEvent({ isPaused: Bool(true) }));
  }

  /**
   * Resumes the contract, re-enabling administrative actions.
   * Can only be called by the admin if `canPause` is `true`.
   */
  @method
  async resume(): Promise<void> {
    await this.ensureOwnerSignature();
    this.canBePaused.getAndRequireEquals().assertTrue();
    this.isPaused.set(Bool(false));
    this.emitEvent("resume", new PauseEvent({ isPaused: Bool(false) }));
  }

  /**
   * Transfers ownership of the contract to a new admin.
   * @param to - The public key of the new owner.
   * @returns The public key of the previous owner.
   */
  @method.returns(PublicKey)
  async transferOwnership(to: PublicKey): Promise<PublicKey> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertTrue("Contract is paused");
    await this.ensureOwnerSignature();
    const from = this.admin.getAndRequireEquals();
    this.admin.set(to);
    this.emitEvent(
      "ownershipChange",
      new OwnershipChangeEvent({
        from,
        to,
      })
    );
    return from;
  }

  @method.returns(Bool)
  async canChangeVerificationKey(
    vk: VerificationKey,
    address: PublicKey,
    tokenId: Field
  ): Promise<Bool> {
    await this.ensureOwnerSignature();
    return Bool(true);
  }

  /**
   * Determines if the name can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeName(name: Field): Promise<Bool> {
    return Bool(false);
  }

  /**
   * Determines if the creator can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeCreator(creator: PublicKey): Promise<Bool> {
    return Bool(false);
  }

  /**
   * Determines if the base URI can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeBaseUri(baseUri: Field): Promise<Bool> {
    return Bool(false);
  }

  /**
   * Determines if the royalty fee can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeRoyalty(royaltyFee: UInt32): Promise<Bool> {
    await this.ensureOwnerSignature();
    return this.allowChangeRoyalty.getAndRequireEquals();
  }

  /**
   * Determines if the transfer fee can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeTransferFee(transferFee: UInt64): Promise<Bool> {
    await this.ensureOwnerSignature();
    return this.allowChangeTransferFee.getAndRequireEquals();
  }

  /**
   * Determines if the admin contract can be changed for a Collection.
   */
  @method.returns(Bool)
  async canSetAdmin(admin: PublicKey): Promise<Bool> {
    return Bool(false);
  }

  /**
   * Determines if the collection can be paused.
   */
  @method.returns(Bool)
  async canPause(): Promise<Bool> {
    await this.ensureOwnerSignature();
    return this.canBePaused.getAndRequireEquals();
  }

  /**
   * Determines if the collection can be resumed.
   */
  @method.returns(Bool)
  async canResume(): Promise<Bool> {
    await this.ensureOwnerSignature();
    return this.canBePaused.getAndRequireEquals();
  }
}
