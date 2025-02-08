/**
 * The `NFTAdvancedAdminContract` is an implementation of an admin contract that uses a whitelist to control access to certain actions within the NFT ecosystem.
 * This contract ensures that only whitelisted addresses can perform specific actions such as minting, updating, transferring, buying, or selling NFTs.
 * It also introduces functionality for pausing and resuming the contract, upgrading the contract's verification key, and transferring ownership.
 */

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
  Provable,
  Field,
  AccountUpdate,
  Mina,
  UInt32,
  Struct,
} from "o1js";
import { Whitelist } from "@silvana-one/storage";
import {
  MintRequest,
  NFTState,
  NFTAdminBase,
  MintParamsOption,
  PauseEvent,
  PausableContract,
  OwnershipChangeEvent,
  OwnableContract,
  TransferEvent,
} from "../interfaces/index.js";
import {
  UpgradeAuthorityBase,
  VerificationKeyUpgradeData,
  UpgradableContract,
  UpgradeAuthorityContractConstructor,
} from "@silvana-one/upgradable";

export { NFTAdvancedAdminContract, AdminData, NFTAdvancedAdminDeployProps };

/**
 * Deployment properties for the `NFTAdvancedAdminContract`.
 */
interface NFTAdvancedAdminDeployProps extends Exclude<DeployArgs, undefined> {
  /** The public key of the admin or owner of the contract. */
  admin: PublicKey;
  /** The public key of the Upgrade Authority Contract. */
  upgradeAuthority: PublicKey;
  /** The whitelist. */
  whitelist: Whitelist;

  /** The URI of the zkApp. */
  uri: string;
  /** The admin data. */
  adminData: AdminData;
}

/**
 * Represents pause-related data, containing flags for pause functionality.
 */
class AdminData extends Struct({
  /** Indicates whether the contract can be paused. */
  canPause: Bool,
  /** Indicates whether the contract is currently paused. */
  isPaused: Bool,
  /** Indicates whether the contract can change the royalty fee. */
  allowChangeRoyalty: Bool,
  /** Indicates whether the contract can change the transfer fee. */
  allowChangeTransferFee: Bool,
  /** Indicates whether the contract can change the base URI. */
  allowChangeBaseUri: Bool,
  /** Indicates whether the contract can change the creator. */
  allowChangeCreator: Bool,
  /** Indicates whether the contract can change the admin. */
  allowChangeAdmin: Bool,
  /** Indicates whether the contract can change the name. */
  allowChangeName: Bool,
}) {
  static new(
    params: {
      canPause?: boolean;
      isPaused?: boolean;
      allowChangeRoyalty?: boolean;
      allowChangeTransferFee?: boolean;
      allowChangeBaseUri?: boolean;
      allowChangeCreator?: boolean;
      allowChangeAdmin?: boolean;
      allowChangeName?: boolean;
    } = {}
  ) {
    const {
      canPause,
      isPaused,
      allowChangeRoyalty,
      allowChangeTransferFee,
      allowChangeBaseUri,
      allowChangeCreator,
      allowChangeAdmin,
      allowChangeName,
    } = params;
    return new AdminData({
      canPause: Bool(canPause ?? true),
      isPaused: Bool(isPaused ?? false),
      allowChangeRoyalty: Bool(allowChangeRoyalty ?? false),
      allowChangeTransferFee: Bool(allowChangeTransferFee ?? false),
      allowChangeBaseUri: Bool(allowChangeBaseUri ?? false),
      allowChangeCreator: Bool(allowChangeCreator ?? false),
      allowChangeAdmin: Bool(allowChangeAdmin ?? false),
      allowChangeName: Bool(allowChangeName ?? false),
    });
  }
  /**
   * Packs the pause data into a `Field`.
   * @returns A `Field` representing the packed pause data.
   */
  pack(): Field {
    return Field.fromBits([
      this.isPaused,
      this.canPause,
      this.allowChangeRoyalty,
      this.allowChangeTransferFee,
      this.allowChangeBaseUri,
      this.allowChangeCreator,
      this.allowChangeAdmin,
      this.allowChangeName,
    ]);
  }
  /**
   * Unpacks a `Field` into `PauseData`.
   * @param field The `Field` to unpack.
   * @returns An instance of `PauseData`.
   */
  static unpack(field: Field): AdminData {
    const [
      isPaused,
      canPause,
      allowChangeRoyalty,
      allowChangeTransferFee,
      allowChangeBaseUri,
      allowChangeCreator,
      allowChangeAdmin,
      allowChangeName,
    ] = field.toBits(8);
    return new AdminData({
      canPause,
      isPaused,
      allowChangeRoyalty,
      allowChangeTransferFee,
      allowChangeBaseUri,
      allowChangeCreator,
      allowChangeAdmin,
      allowChangeName,
    });
  }
  static isPaused(field: Field): Bool {
    return field.toBits(8)[0];
  }
}

const NFTAdvancedAdminContractErrors = {
  contractIsPaused: "Contract is paused",
  notWhitelisted: "Address not whitelisted",
  senderNotWhitelisted: "Sender address not whitelisted",
  cannotMint: "Cannot mint",
  verificationKeyHashNotFound: "Verification key hash not found",
  cannotUpgradeVerificationKey: "Cannot upgrade verification key",
};

/**
 * Constructs the `NFTAdvancedAdmin` class, an admin contract that uses a whitelist to control access.
 * @param params Object containing the upgrade contract constructor.
 * @returns The `NFTAdvancedAdmin` class.
 */
function NFTAdvancedAdminContract(params: {
  upgradeContract: UpgradeAuthorityContractConstructor;
}) {
  const { upgradeContract } = params;

  /**
   * The `NFTWhitelistedAdmin` class ensures that only whitelisted addresses can perform specific actions such as minting, updating, transferring, buying, or selling NFTs.
   * It also provides functionality for pausing and resuming the contract, upgrading the contract's verification key, and transferring ownership.
   */
  class NFTAdvancedAdmin
    extends SmartContract
    implements
      NFTAdminBase,
      UpgradableContract,
      PausableContract,
      OwnableContract
  {
    /** The public key of the admin or owner of the contract. */
    @state(PublicKey) admin = State<PublicKey>();
    /** The public key of the Upgrade Authority Contract. */
    @state(PublicKey) upgradeAuthority = State<PublicKey>();
    /** The root hash of the Merkle tree representing the whitelist. */
    @state(Whitelist) whitelist = State<Whitelist>();
    /** Packed field containing pause-related flags. */
    @state(Field) data = State<Field>();

    /**
     * Deploys the `NFTWhitelistedAdmin` contract with the provided initial settings.
     * @param props Deployment properties.
     */
    async deploy(props: NFTAdvancedAdminDeployProps) {
      await super.deploy(props);
      this.admin.set(props.admin);
      this.upgradeAuthority.set(props.upgradeAuthority);
      this.whitelist.set(props.whitelist);
      this.data.set(props.adminData.pack());
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
        setZkappUri: Permissions.impossible(),
        setTokenSymbol: Permissions.impossible(),
      });
    }

    events = {
      /** Emitted when the contract's verification key is upgraded. */
      upgradeVerificationKey: Field,
      /** Emitted when the contract is paused. */
      pause: PauseEvent,
      /** Emitted when the contract is resumed. */
      resume: PauseEvent,
      /** Emitted when ownership of the contract changes. */
      ownershipChange: OwnershipChangeEvent,
      /** Emitted when the whitelist is updated. */
      updateWhitelist: Whitelist,
    };

    /**
     * Ensures that the transaction is authorized by the contract owner.
     * @returns An `AccountUpdate` representing the admin's signed transaction.
     */
    async ensureOwnerSignature(): Promise<AccountUpdate> {
      const admin = this.admin.getAndRequireEquals();
      const adminUpdate = AccountUpdate.createSigned(admin);
      adminUpdate.body.useFullCommitment = Bool(true); // prevent memo and fee change
      return adminUpdate;
    }

    /** Gets the upgrade contract constructor. */
    get getUpgradeContractConstructor() {
      return upgradeContract;
    }

    /**
     * Retrieves the `UpgradeAuthorityBase` contract instance.
     * @returns An instance of the upgrade authority contract.
     */
    async getUpgradeContract(): Promise<UpgradeAuthorityBase> {
      return new this.getUpgradeContractConstructor(
        this.upgradeAuthority.getAndRequireEquals()
      );
    }

    /**
     * Upgrades the contract's verification key using the Upgrade Authority Contract.
     * @param vk The new verification key.
     */
    @method
    async upgradeVerificationKey(vk: VerificationKey) {
      await this.ensureOwnerSignature();
      const upgradeContract = await this.getUpgradeContract();
      // fetchAccount() should be called before calling this method
      // this code should be changed after verification key precondition
      // will be added to the Mina protocol
      const previousVerificationKeyHash = Provable.witness(Field, () => {
        const account = Mina.getAccount(this.address);
        const vkHash = account.zkapp?.verificationKey?.hash;
        if (!vkHash) {
          throw Error(
            NFTAdvancedAdminContractErrors.verificationKeyHashNotFound
          );
        }
        return vkHash;
      });
      const data = new VerificationKeyUpgradeData({
        address: this.address,
        tokenId: this.tokenId,
        previousVerificationKeyHash,
        newVerificationKeyHash: vk.hash,
      });
      const upgradeAuthorityAnswer = await upgradeContract.verifyUpgradeData(
        data
      );
      upgradeAuthorityAnswer.isVerified.assertTrue(
        NFTAdvancedAdminContractErrors.cannotUpgradeVerificationKey
      );
      this.account.verificationKey.set(vk);
      this.upgradeAuthority.set(
        upgradeAuthorityAnswer.nextUpgradeAuthority.orElse(
          this.upgradeAuthority.getAndRequireEquals()
        )
      );
      this.emitEvent("upgradeVerificationKey", vk.hash);
    }

    /**
     * Determines if the minting request can proceed by checking if the owner and sender are whitelisted.
     * @param mintRequest The minting request parameters.
     * @returns A `MintParamsOption` indicating if minting is allowed.
     */
    @method.returns(MintParamsOption)
    async canMint(mintRequest: MintRequest): Promise<MintParamsOption> {
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );

      const whitelist = this.whitelist.getAndRequireEquals();
      const ownerAmount = await whitelist.getWhitelistedAmount(
        mintRequest.owner
      );
      ownerAmount.isSome.assertTrue(
        NFTAdvancedAdminContractErrors.notWhitelisted
      );

      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.body.useFullCommitment = Bool(true); // prevent memo and fee change
      const senderAmount = await whitelist.getWhitelistedAmount(sender);
      senderAmount.isSome.assertTrue(
        NFTAdvancedAdminContractErrors.senderNotWhitelisted
      );
      const mintParams = await Provable.witnessAsync(
        MintParamsOption,
        async () => {
          // only creator can mint
          // can be changed in the future to support CMS
          return MintParamsOption.none();
        }
      );
      return mintParams;
    }

    /**
     * Checks whether the NFT's state can be updated, ensuring the new owner is whitelisted.
     * @param input The current state of the NFT.
     * @param output The desired new state of the NFT.
     * @returns A `Bool` indicating whether the update is permitted.
     */
    @method.returns(Bool)
    async canUpdate(input: NFTState, output: NFTState) {
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      const whitelist = this.whitelist.getAndRequireEquals();
      return (await whitelist.getWhitelistedAmount(output.owner)).isSome.and(
        (await whitelist.getWhitelistedAmount(input.owner)).isSome
      );
    }

    /**
     * Verifies if the transfer between `from` and `to` addresses is allowed based on whitelist status.
     * @param address The address of the NFT.
     * @param from The sender's public key.
     * @param to The receiver's public key.
     * @returns A `Bool` indicating whether the transfer is permitted.
     */
    @method.returns(Bool)
    async canTransfer(transferEvent: TransferEvent) {
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      const { to, from, price } = transferEvent;

      const whitelist = this.whitelist.getAndRequireEquals();
      const toAmount = await whitelist.getWhitelistedAmount(to);
      const fromAmount = await whitelist.getWhitelistedAmount(from);

      const toAmountAllowed = toAmount
        .orElse(UInt64.from(0))
        .greaterThanOrEqual(price.orElse(UInt64.zero));

      const fromAmountAllowed = fromAmount
        .orElse(UInt64.from(0))
        .greaterThanOrEqual(price.orElse(UInt64.zero));

      return toAmountAllowed
        .and(fromAmountAllowed)
        .and(toAmount.isSome)
        .and(fromAmount.isSome);
    }

    /**
     * Updates the whitelist's Merkle root and the associated off-chain storage reference.
     * @param whitelistRoot The new whitelist root.
     * @param storage The storage reference for the whitelist data.
     */
    @method
    async updateWhitelist(whitelist: Whitelist) {
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      await this.ensureOwnerSignature();
      this.whitelist.set(whitelist);
      this.emitEvent("updateWhitelist", whitelist);
    }

    /**
     * Pauses the contract, preventing certain administrative actions from being performed.
     */
    @method
    async pause(): Promise<void> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.canPause.assertTrue();
      adminData.isPaused = Bool(true);
      this.data.set(adminData.pack());
      this.emitEvent("pause", new PauseEvent({ isPaused: Bool(true) }));
    }

    /**
     * Resumes the contract, allowing administrative actions to be performed again.
     */
    @method
    async resume(): Promise<void> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.canPause.assertTrue();
      adminData.isPaused = Bool(false);
      this.data.set(adminData.pack());
      this.emitEvent("resume", new PauseEvent({ isPaused: Bool(false) }));
    }

    /**
     * Transfers ownership of the contract to a new admin.
     * @param newOwner The public key of the new admin.
     * @returns The public key of the old owner.
     */
    @method.returns(PublicKey)
    async transferOwnership(to: PublicKey): Promise<PublicKey> {
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
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
      AdminData.isPaused(this.data.getAndRequireEquals()).assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      const upgradeContract = await this.getUpgradeContract();

      // fetchAccount() should be called before calling this method
      // TODO: this code should be changed after verification key precondition
      // will be added to the Mina protocol
      const previousVerificationKeyHash = Provable.witness(Field, () => {
        const account = Mina.getAccount(address, tokenId);
        const vkHash = account.zkapp?.verificationKey?.hash;
        if (!vkHash) {
          throw Error("Verification key hash not found");
        }
        return vkHash;
      });
      const data = new VerificationKeyUpgradeData({
        address: address,
        tokenId: tokenId,
        previousVerificationKeyHash,
        newVerificationKeyHash: vk.hash,
      });
      const upgradeAuthorityAnswer = await upgradeContract.verifyUpgradeData(
        data
      );

      return upgradeAuthorityAnswer.isVerified;
    }
    /**
     * Determines if the name can be changed for a Collection.
     */
    @method.returns(Bool)
    async canChangeName(name: Field): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeName;
    }

    /**
     * Determines if the creator can be changed for a Collection.
     */
    @method.returns(Bool)
    async canChangeCreator(creator: PublicKey): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeCreator;
    }

    /**
     * Determines if the base URI can be changed for a Collection.
     */
    @method.returns(Bool)
    async canChangeBaseUri(baseUri: Field): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeBaseUri;
    }

    /**
     * Determines if the royalty fee can be changed for a Collection.
     */
    @method.returns(Bool)
    async canChangeRoyalty(royaltyFee: UInt32): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeRoyalty;
    }

    /**
     * Determines if the transfer fee can be changed for a Collection.
     */
    @method.returns(Bool)
    async canChangeTransferFee(transferFee: UInt64): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeTransferFee;
    }

    /**
     * Determines if the admin contract can be changed for a Collection.
     */
    @method.returns(Bool)
    async canSetAdmin(admin: PublicKey): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.allowChangeAdmin;
    }

    /**
     * Determines if the collection can be paused.
     */
    @method.returns(Bool)
    async canPause(): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.canPause;
    }

    /**
     * Determines if the collection can be resumed.
     */
    @method.returns(Bool)
    async canResume(): Promise<Bool> {
      await this.ensureOwnerSignature();
      const adminData = AdminData.unpack(this.data.getAndRequireEquals());
      adminData.isPaused.assertFalse(
        NFTAdvancedAdminContractErrors.contractIsPaused
      );
      return adminData.canPause;
    }
  }

  return NFTAdvancedAdmin;
}
