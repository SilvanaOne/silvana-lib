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
  UInt8,
  Struct,
  assert,
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
export { NFTAdmin, NFTAdminDeployProps, NFTAdminAllowFlags };

interface NFTAdminDeployProps extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  uri: string;
  canBePaused?: Bool;
  allowChangeRoyalty?: Bool;
  allowChangeTransferFee?: Bool;
  allowPauseCollection?: Bool;
  isPaused?: Bool;
}

/**
 * Contains flags for the admin contract related to the NFT collection permissions.
 */
class NFTAdminAllowFlags extends Struct({
  allowChangeRoyalty: Bool,
  allowChangeTransferFee: Bool,
  allowPauseCollection: Bool,
}) {
  /**
   * Packs the NFTAdminAllowFlags into a UInt8 representation for efficient storage.
   * @returns The packed UInt8 instance.
   */
  pack(): UInt8 {
    return UInt8.from(
      Field.fromBits([
        this.allowChangeRoyalty,
        this.allowChangeTransferFee,
        this.allowPauseCollection,
      ])
    );
  }

  /**
   * Unpacks a UInt8 instance into a NFTAdminAllowFlags instance.
   * @param packed The packed UInt8 instance.
   * @returns A new NFTAdminAllowFlags instance.
   */
  static unpack(packed: UInt8): NFTAdminAllowFlags {
    const bits = packed.value.toBits(3);

    const allowChangeRoyalty = bits[0];
    const allowChangeTransferFee = bits[1];
    const allowPauseCollection = bits[2];

    return new NFTAdminAllowFlags({
      allowChangeRoyalty,
      allowChangeTransferFee,
      allowPauseCollection,
    });
  }
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
   * The public key of the contract's pending administrator.
   */
  @state(PublicKey) pendingAdmin = State<PublicKey>();

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
   * A boolean flags indicating whether the collection is allowed to change the royalty fee, transfer fee and pause the collection.
   */
  @state(UInt8) flags = State<UInt8>();

  /**
   * Deploys the contract with initial settings.
   * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
   */
  async deploy(props: NFTAdminDeployProps) {
    await super.deploy(props);
    const isPaused = props.isPaused ?? Bool(false);
    const canBePaused = props.canBePaused ?? Bool(true);
    assert(
      isPaused.equals(Bool(false)).or(canBePaused.equals(Bool(true))),
      "Cannot deploy paused contract that cannot be resumed"
    );
    this.admin.set(props.admin);
    this.pendingAdmin.set(PublicKey.empty());
    this.isPaused.set(isPaused);
    this.canBePaused.set(canBePaused);
    this.flags.set(
      new NFTAdminAllowFlags({
        allowChangeRoyalty: props.allowChangeRoyalty ?? Bool(false),
        allowChangeTransferFee: props.allowChangeTransferFee ?? Bool(false),
        allowPauseCollection: props.allowPauseCollection ?? Bool(true),
      }).pack()
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
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
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
    ownershipTransfer: OwnershipChangeEvent,
    /** Emitted when ownership of the contract is accepted. */
    ownershipAccepted: OwnershipChangeEvent,
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
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
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
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    return Bool(true);
  }

  /**
   * Determines whether a transfer between the specified addresses is permitted.
   * @param transferEvent - The transfer event details.
   * @returns A `Bool` indicating whether the transfer is allowed.
   */
  @method.returns(Bool)
  async canTransfer(transferEvent: TransferEvent): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
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
   * @returns The public key of the previous admin.
   */
  @method.returns(PublicKey)
  async transferOwnership(to: PublicKey): Promise<PublicKey> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    await this.ensureOwnerSignature();
    const from = this.admin.getAndRequireEquals();
    // Pending admin public key can be empty, it cancels the transfer
    this.pendingAdmin.set(to);
    this.emitEvent(
      "ownershipTransfer",
      new OwnershipChangeEvent({
        from,
        to,
      })
    );
    return from;
  }

  /**
   * Accept transfer of the ownership of the contract.
   * @returns The public key of the previous admin.
   */
  @method.returns(PublicKey)
  async acceptOwnership(): Promise<PublicKey> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    const admin = this.admin.getAndRequireEquals();
    const pendingAdmin = this.pendingAdmin.getAndRequireEquals();
    pendingAdmin
      .equals(PublicKey.empty())
      .assertFalse("Pending admin is not set");
    // pendingAdmin can be different from the sender, but it should sign the tx
    const pendingAminUpdate = AccountUpdate.createSigned(pendingAdmin);
    pendingAminUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
    this.admin.set(pendingAdmin);
    this.pendingAdmin.set(PublicKey.empty());
    this.emitEvent(
      "ownershipAccepted",
      new OwnershipChangeEvent({
        from: admin,
        to: pendingAdmin,
      })
    );
    return admin;
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
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    return Bool(false);
  }

  /**
   * Determines if the creator can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeCreator(creator: PublicKey): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    return Bool(false);
  }

  /**
   * Determines if the base URI can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeBaseUri(baseUri: Field): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    return Bool(false);
  }

  /**
   * Determines if the royalty fee can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeRoyalty(royaltyFee: UInt32): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    await this.ensureOwnerSignature();
    const flags = NFTAdminAllowFlags.unpack(this.flags.getAndRequireEquals());
    return flags.allowChangeRoyalty;
  }

  /**
   * Determines if the transfer fee can be changed for a Collection.
   */
  @method.returns(Bool)
  async canChangeTransferFee(transferFee: UInt64): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    await this.ensureOwnerSignature();
    const flags = NFTAdminAllowFlags.unpack(this.flags.getAndRequireEquals());
    return flags.allowChangeTransferFee;
  }

  /**
   * Determines if the admin contract can be changed for a Collection.
   */
  @method.returns(Bool)
  async canSetAdmin(admin: PublicKey): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    return Bool(false);
  }

  /**
   * Determines if the collection can be paused.
   */
  @method.returns(Bool)
  async canPause(): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    await this.ensureOwnerSignature();
    const flags = NFTAdminAllowFlags.unpack(this.flags.getAndRequireEquals());
    return flags.allowPauseCollection;
  }

  /**
   * Determines if the collection can be resumed.
   */
  @method.returns(Bool)
  async canResume(): Promise<Bool> {
    const isPaused = this.isPaused.getAndRequireEquals();
    isPaused.assertFalse("Contract is paused");
    await this.ensureOwnerSignature();
    const flags = NFTAdminAllowFlags.unpack(this.flags.getAndRequireEquals());
    return flags.allowPauseCollection;
  }
}
