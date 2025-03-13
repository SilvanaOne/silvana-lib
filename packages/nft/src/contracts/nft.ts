import {
  Field,
  PublicKey,
  Bool,
  SmartContract,
  method,
  state,
  State,
  VerificationKey,
} from "o1js";
import { Storage } from "@silvana-one/storage";
import {
  NFTData,
  NFTDataPacked,
  NFTState,
  NFTImmutableState,
  UpdateEvent,
  TransferExtendedParams,
  UpgradeVerificationKeyEvent,
  PauseEvent,
  OwnershipChangeEvent,
  UpgradeVerificationKeyData,
  NFTStateStruct,
  NFTTransactionContext,
} from "../interfaces/index.js";

export { NFT };

const NftErrors = {
  cannotChangeMetadataVerificationKeyHash:
    "Cannot change metadata verification key hash",
  cannotChangeOwner: "Cannot change owner",
  cannotChangeApproval: "Cannot change approval",
  cannotChangeStorage: "Cannot change storage",
  cannotChangePauseState: "Cannot change pause state",
  noPermissionToPause: "No permission to pause",
  nftAlreadyPaused: "NFT is already paused",
  nftIsNotPaused: "NFT is not paused",
  nftIsPaused: "NFT is paused",
  cannotChangeName: "Cannot change name",
  cannotChangeMetadata: "Cannot change metadata",
  noMetadataVerificationKey: "No metadata verification key",
};

/**
 * The NFT Contract represents an individual NFT within a collection.
 *
 * It manages the state and behavior of a single NFT, including ownership, metadata,
 * storage, pricing, and permissions. The contract provides functionality for updating
 * NFT properties with proofs and permissions, transferring ownership, selling and buying NFTs,
 * upgrading the verification key, and pausing or resuming the NFT.
 */
class NFT extends SmartContract {
  /** The name of the NFT (`Field`). */
  @state(Field) name = State<Field>();

  /** The metadata associated with the NFT (`Field`). */
  @state(Field) metadata = State<Field>();

  /** Holds off-chain storage information, e.g., IPFS hash (`Storage`). */
  @state(Storage) storage = State<Storage>();

  /** A packed field containing additional NFT data and flags (`Field`). */
  @state(NFTDataPacked) packedData = State<NFTDataPacked>();

  /** The hash of the verification key used for metadata proofs (`Field`). */
  @state(Field) metadataVerificationKeyHash = State<Field>();

  /** Events emitted by the NFT contract. */
  events = {
    update: UpdateEvent,
    transfer: OwnershipChangeEvent,
    approve: PublicKey,
    upgradeVerificationKey: UpgradeVerificationKeyEvent,
    pause: PauseEvent,
    resume: PauseEvent,
  };

  @method.returns(NFTStateStruct)
  async getState(): Promise<NFTStateStruct> {
    const name = this.name.getAndRequireEquals();
    const metadata = this.metadata.getAndRequireEquals();
    const storage = this.storage.getAndRequireEquals();
    const packedData = this.packedData.getAndRequireEquals();
    const metadataVerificationKeyHash =
      this.metadataVerificationKeyHash.getAndRequireEquals();
    return new NFTStateStruct({
      name,
      metadata,
      storage,
      packedData,
      metadataVerificationKeyHash,
    });
  }

  /**
   * Updates the NFT's state with provided proofs and permissions.
   *
   * @param input - The current state of the NFT (`NFTState`).
   * @param output - The desired new state of the NFT (`NFTState`).
   * @param creator - The public key of the creator (`PublicKey`).
   * @returns The hash of the metadata verification key (`Field`).
   */
  @method.returns(Field)
  async update(
    input: NFTState,
    output: NFTState,
    creator: PublicKey
  ): Promise<Field> {
    const name = this.name.getAndRequireEquals();
    const metadata = this.metadata.getAndRequireEquals();
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());
    const owner = data.owner;

    const storage = this.storage.getAndRequireEquals();
    const metadataVerificationKeyHash =
      this.metadataVerificationKeyHash.getAndRequireEquals();
    // Check that the metadata verification key exists
    metadataVerificationKeyHash.assertNotEquals(
      Field(0),
      NftErrors.noMetadataVerificationKey
    );

    // We do not check if the NFT is paused here
    // It is the responsibility of metadata zkProgram to check if the NFT is paused,
    // similar to data.isPaused.assertFalse(NftErrors.nftIsPaused);

    // Assert that the public input matches the NFT state
    NFTState.assertEqual(
      input,
      new NFTState({
        immutableState: new NFTImmutableState({
          canChangeOwnerByProof: data.canChangeOwnerByProof,
          canTransfer: data.canTransfer,
          canApprove: data.canApprove,
          canChangeMetadata: data.canChangeMetadata,
          canChangeStorage: data.canChangeStorage,
          canChangeName: data.canChangeName,
          canChangeMetadataVerificationKeyHash:
            data.canChangeMetadataVerificationKeyHash,
          canPause: data.canPause,
          address: this.address,
          tokenId: this.tokenId,
          id: data.id,
        }),
        name,
        metadata,
        storage,
        owner,
        approved: data.approved,
        version: data.version,
        isPaused: data.isPaused,
        metadataVerificationKeyHash,
        creator,
        context: input.context,
        oracleAddress: input.oracleAddress,
      })
    );

    // assert that the read-only fields are not changed
    input.creator.assertEquals(output.creator);
    NFTTransactionContext.assertEqual(input.context, output.context);
    input.oracleAddress.assertEquals(output.oracleAddress);
    // Check permissions and set new state
    name
      .equals(output.name)
      .not()
      .and(data.canChangeName.not())
      .assertFalse(NftErrors.cannotChangeName);
    this.name.set(output.name);

    metadata
      .equals(output.metadata)
      .not()
      .and(data.canChangeMetadata.not())
      .assertFalse(NftErrors.cannotChangeMetadata);
    this.metadata.set(output.metadata);

    metadataVerificationKeyHash
      .equals(output.metadataVerificationKeyHash)
      .not()
      .and(data.canChangeMetadataVerificationKeyHash.not())
      .assertFalse(NftErrors.cannotChangeMetadataVerificationKeyHash);
    this.metadataVerificationKeyHash.set(output.metadataVerificationKeyHash);

    owner
      .equals(output.owner)
      .not()
      .and(data.canChangeOwnerByProof.not())
      .assertFalse(NftErrors.cannotChangeOwner);

    Storage.equals(storage, output.storage)
      .not()
      .and(data.canChangeStorage.not())
      .assertFalse(NftErrors.cannotChangeStorage);
    this.storage.set(output.storage);

    data.approved
      .equals(output.approved)
      .not()
      .and(data.canChangeOwnerByProof.not())
      .assertFalse(NftErrors.cannotChangeOwner);

    data.isPaused
      .equals(output.isPaused)
      .not()
      .and(data.canPause.not())
      .assertFalse(NftErrors.cannotChangePauseState);

    // recursive proofs can increase the version by more than 1
    output.version.assertGreaterThan(data.version);

    data.owner = output.owner;
    data.approved = output.approved;
    data.version = output.version;

    this.packedData.set(data.pack());

    const event = new UpdateEvent({
      name: output.name,
      metadata: output.metadata,
      storage: output.storage,
      owner: output.owner,
      approved: output.approved,
      version: output.version,
      isPaused: output.isPaused,
      metadataVerificationKeyHash: output.metadataVerificationKeyHash,
    });
    this.emitEvent("update", event);
    return metadataVerificationKeyHash;
  }

  /**
   * Transfers ownership of the NFT from one user to another.
   *
   * @param params - The parameters for the transfer (`TransferExtendedParams`).
   * @returns The public key of the old owner (`PublicKey`).
   */
  @method.returns(TransferExtendedParams)
  async transfer(
    params: TransferExtendedParams
  ): Promise<TransferExtendedParams> {
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());
    data.canTransfer.assertTrue(NftErrors.cannotChangeOwner);
    data.isPaused.assertFalse(NftErrors.nftIsPaused);
    const owner = data.owner;
    const approved = data.approved;
    params.transferByOwner = owner.equals(params.from);

    owner
      .equals(params.from)
      .or(
        approved
          .equals(params.from)
          .and(approved.equals(PublicKey.empty()).not())
      )
      .assertTrue(NftErrors.cannotChangeOwner);
    params.from = owner;
    params.approved = approved;
    const version = data.version.add(1);
    data.version = version;
    data.approved = PublicKey.empty();
    data.owner = params.to;
    this.packedData.set(data.pack());
    this.emitEvent(
      "transfer",
      new OwnershipChangeEvent({
        from: owner,
        to: params.to,
      })
    );

    return params;
  }

  /**
   * Transfers ownership of the NFT from one user to another.
   *
   * @param approved - The public key of the approved address (`PublicKey`).
   * @returns The public key of the owner (`PublicKey`).
   */
  @method.returns(PublicKey)
  async approveAddress(approved: PublicKey): Promise<PublicKey> {
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());
    data.isPaused.assertFalse(NftErrors.nftIsPaused);
    data.canApprove.assertTrue(NftErrors.cannotChangeApproval);
    data.approved = approved;
    this.packedData.set(data.pack());
    this.emitEvent("approve", approved);
    return data.owner;
  }

  /**
   * Upgrades the verification key used by the NFT contract.
   *
   * @param vk - The new verification key (`VerificationKey`).
   * @returns An owner public key to be checked by the Collection contract and the Boolean flag indicating if the owner's authorization is required
   */
  @method.returns(UpgradeVerificationKeyData)
  async upgradeVerificationKey(
    vk: VerificationKey
  ): Promise<UpgradeVerificationKeyData> {
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());

    const version = data.version.add(1);
    data.version = version;
    this.account.verificationKey.set(vk);
    this.packedData.set(data.pack());
    return new UpgradeVerificationKeyData({
      owner: data.owner,
      isOwnerApprovalRequired: data.requireOwnerAuthorizationToUpgrade,
    });
  }

  /**
   * Pauses the NFT, disabling certain actions.
   *
   * @returns An owner public key to be checked by the Collection contract
   */
  @method.returns(PublicKey)
  async pause(): Promise<PublicKey> {
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());
    data.canPause.assertTrue(NftErrors.noPermissionToPause);
    data.isPaused.assertFalse(NftErrors.nftAlreadyPaused);
    data.isPaused = Bool(true);
    this.packedData.set(data.pack());
    this.emitEvent("pause", new PauseEvent({ isPaused: Bool(true) }));
    return data.owner;
  }

  /**
   * Resumes the NFT, re-enabling actions.
   *
   * @returns An owner public key to be checked by the Collection contract
   */
  @method.returns(PublicKey)
  async resume(): Promise<PublicKey> {
    const data = NFTData.unpack(this.packedData.getAndRequireEquals());
    data.canPause.assertTrue(NftErrors.noPermissionToPause);
    data.isPaused.assertTrue(NftErrors.nftIsNotPaused);
    data.isPaused = Bool(false);
    this.packedData.set(data.pack());
    this.emitEvent("resume", new PauseEvent({ isPaused: Bool(false) }));
    return data.owner;
  }
}
