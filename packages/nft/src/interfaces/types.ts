import {
  Field,
  PublicKey,
  Bool,
  Struct,
  UInt32,
  UInt64,
  Provable,
  DynamicProof,
  FeatureFlags,
  Option,
  Account,
  Gadgets,
} from "o1js";
import { Storage } from "@silvana-one/storage";
export {
  MintParams,
  MintParamsOption,
  MintRequest,
  NFTDataPacked,
  NFTData,
  CollectionData,
  NFTState,
  NFTImmutableState,
  NFTUpdateProof,
  NFTStateStruct,
  UInt64Option,
  TransferBySignatureParams,
  TransferByProofParams,
  MAX_ROYALTY_FEE,
  NFTTransactionContext,
  TransferExtendedParams,
};

class UInt64Option extends Option(UInt64) {}

class NFTDataPacked extends Struct({
  ownerX: Field,
  approvedX: Field,
  data: Field,
}) {
  static assertEqual(a: NFTDataPacked, b: NFTDataPacked) {
    a.ownerX.assertEquals(b.ownerX);
    a.approvedX.assertEquals(b.approvedX);
    a.data.assertEquals(b.data);
  }
}

/**
 * Represents the on-chain state structure of an NFT.
 * The order of the fields is important and should match the NFT SmartContract.
 */
class NFTStateStruct extends Struct({
  name: Field,
  metadata: Field,
  storage: Storage,
  packedData: NFTDataPacked,
  metadataVerificationKeyHash: Field,
}) {
  /**
   * Creates an NFTStateStruct from an account's app state.
   * @param account The account containing the zkApp state.
   * @returns A new NFTStateStruct instance.
   */
  static fromAccount(account: Account) {
    if (!account.zkapp?.appState) {
      throw new Error("Invalid zkApp account state");
    }
    if (NFTStateStruct.sizeInFields() !== account.zkapp?.appState.length) {
      throw new Error("Invalid NFTStateStruct size");
    }
    return NFTStateStruct.fromFields(account.zkapp?.appState);
  }

  /**
   * Asserts that two NFTStateStruct instances are equal.
   * @param a The first NFTStateStruct instance.
   * @param b The second NFTStateStruct instance.
   */
  static assertEqual(a: NFTStateStruct, b: NFTStateStruct) {
    a.name.assertEquals(b.name);
    a.metadata.assertEquals(b.metadata);
    Storage.assertEquals(a.storage, b.storage);
    NFTDataPacked.assertEqual(a.packedData, b.packedData);
    a.metadataVerificationKeyHash.assertEquals(b.metadataVerificationKeyHash);
  }
}

/**
 * Represents the immutable state of an NFT, containing read-only properties
 * and flags that determine the NFT's behavior and permissions.
 */
class NFTImmutableState extends Struct({
  /** Determines if the NFT's ownership can be changed via a zero-knowledge proof (readonly). */
  canChangeOwnerByProof: Bool, // readonly
  /** Specifies if the NFT's ownership can be transferred (readonly). */
  canTransfer: Bool, // readonly
  /** Specifies if the NFT's approved address can be changed (readonly). */
  canApprove: Bool, // readonly
  /** Indicates whether the NFT's metadata can be updated (readonly). */
  canChangeMetadata: Bool, // readonly
  /** Determines whether the storage associated with the NFT can be altered (readonly). */
  canChangeStorage: Bool, // readonly
  /** Specifies if the name of the NFT can be changed (readonly). */
  canChangeName: Bool, // readonly
  /** Indicates whether the verification key hash for the metadata can be changed (readonly). */
  canChangeMetadataVerificationKeyHash: Bool, // readonly
  /** Specifies if the NFT contract can be paused, preventing certain operations (readonly). */
  canPause: Bool, // readonly
  /** The address of the NFT contract (readonly). */
  address: PublicKey, // readonly
  /** The token ID associated with the NFT (readonly). */
  tokenId: Field, // readonly
  /** The identifier of the NFT within the collection to be used off-chain(readonly).
   * It can be set to any value chosen by the creator for the new NFTs
   * and by default is set to 0. To uniquely identify the NFT, use the pair (NFT address, tokenId) or (collection address, NFT address)
   */
  id: UInt64, // readonly
}) {
  /**
   * Asserts that two NFTImmutableState instances are equal.
   * @param a The first NFTImmutableState instance.
   * @param b The second NFTImmutableState instance.
   */
  static assertEqual(a: NFTImmutableState, b: NFTImmutableState) {
    a.canChangeOwnerByProof.assertEquals(b.canChangeOwnerByProof);
    a.canTransfer.assertEquals(b.canTransfer);
    a.canApprove.assertEquals(b.canApprove);
    a.canChangeMetadata.assertEquals(b.canChangeMetadata);
    a.canChangeStorage.assertEquals(b.canChangeStorage);
    a.canChangeName.assertEquals(b.canChangeName);
    a.canChangeMetadataVerificationKeyHash.assertEquals(
      b.canChangeMetadataVerificationKeyHash
    );
    a.canPause.assertEquals(b.canPause);
    a.address.assertEquals(b.address);
    a.tokenId.assertEquals(b.tokenId);
    a.id.assertEquals(b.id);
  }

  /**
   * Creates a new NFTImmutableState from NFTData and other parameters.
   * @param params The parameters including nftData, creator, address, and tokenId.
   * @returns A new NFTImmutableState instance.
   */
  static fromNFTData(params: {
    nftData: NFTData;
    address: PublicKey;
    tokenId: Field;
  }) {
    const { nftData, address, tokenId } = params;
    return new NFTImmutableState({
      address,
      tokenId,
      id: nftData.id,
      canChangeOwnerByProof: nftData.canChangeOwnerByProof,
      canTransfer: nftData.canTransfer,
      canApprove: nftData.canApprove,
      canChangeMetadata: nftData.canChangeMetadata,
      canChangeStorage: nftData.canChangeStorage,
      canChangeName: nftData.canChangeName,
      canChangeMetadataVerificationKeyHash:
        nftData.canChangeMetadataVerificationKeyHash,
      canPause: nftData.canPause,
    });
  }
}

class NFTTransactionContext extends Struct({
  /** Custom context that can be interpreted by the owner or approved contract.
   * Can hold Storage and root or two PublicKeys and UInt64
   * In case of holding Storage and root, the contracts can fetch using witnessAsync any off-chain data with unlimited size
   * and verify it using the root.
   */
  custom: Provable.Array(Field, 3),
}) {
  static assertEqual(a: NFTTransactionContext, b: NFTTransactionContext) {
    for (let i = 0; i < 3; i++) {
      a.custom[i].assertEquals(b.custom[i]);
    }
  }
}

/**
 * Represents the full state of an NFT, including both immutable and mutable properties.
 */
class NFTState extends Struct({
  /** The immutable state of the NFT. */
  immutableState: NFTImmutableState,
  /** The name of the NFT. */
  name: Field,
  /** The owner of the NFT. */
  owner: PublicKey,
  /** The approved address of the NFT. */
  approved: PublicKey,
  /** The metadata associated with the NFT. */
  metadata: Field,
  /** The off-chain storage information (e.g., IPFS hash). */
  storage: Storage,
  /** The version number of the NFT state. */
  version: UInt64,
  /** Indicates whether the NFT contract is currently paused. */
  isPaused: Bool,
  /** The hash of the verification key used for metadata proofs. */
  metadataVerificationKeyHash: Field,

  /** The public key of the creator of the NFT (readonly). */
  creator: PublicKey, // readonly
  /** The transaction context of the NFT. */
  context: NFTTransactionContext, // readonly
  /** The oracle address to link the NFT update with the network and accounts state */
  oracleAddress: PublicKey, // readonly
}) {
  /**
   * Asserts that two NFTState instances are equal.
   * @param a The first NFTState instance.
   * @param b The second NFTState instance.
   */
  static assertEqual(a: NFTState, b: NFTState) {
    NFTImmutableState.assertEqual(a.immutableState, b.immutableState);
    a.name.assertEquals(b.name);
    a.metadata.assertEquals(b.metadata);
    Storage.assertEquals(a.storage, b.storage);
    a.owner.assertEquals(b.owner);
    a.approved.assertEquals(b.approved);
    a.version.assertEquals(b.version);
    a.isPaused.assertEquals(b.isPaused);
    a.metadataVerificationKeyHash.assertEquals(b.metadataVerificationKeyHash);
    a.creator.assertEquals(b.creator);
    NFTTransactionContext.assertEqual(a.context, b.context);
    a.oracleAddress.assertEquals(b.oracleAddress);
  }

  /**
   * Creates a new NFTState from an NFTStateStruct and other parameters.
   * @param params The parameters including nftState, creator, address, and tokenId.
   * @returns A new NFTState instance.
   */
  static fromNFTState(params: {
    nftState: NFTStateStruct;
    creator: PublicKey;
    address: PublicKey;
    tokenId: Field;
    context?: NFTTransactionContext;
    oracleAddress?: PublicKey;
  }) {
    const { nftState, creator, address, tokenId, context, oracleAddress } =
      params;
    const nftData = NFTData.unpack(nftState.packedData);
    const immutableState = NFTImmutableState.fromNFTData({
      nftData,
      address,
      tokenId,
    });
    return new NFTState({
      immutableState,
      name: nftState.name,
      metadata: nftState.metadata,
      storage: nftState.storage,
      owner: nftData.owner,
      approved: nftData.approved,
      version: nftData.version,
      isPaused: nftData.isPaused,
      metadataVerificationKeyHash: nftState.metadataVerificationKeyHash,
      creator,
      context: context ?? NFTTransactionContext.empty(),
      oracleAddress: oracleAddress ?? PublicKey.empty(),
    });
  }
}

/**
 * Represents a dynamic proof used for updating the state of an NFT.
 */
class NFTUpdateProof extends DynamicProof<NFTState, NFTState> {
  static publicInputType = NFTState;
  static publicOutputType = NFTState;
  static maxProofsVerified = 2 as const;
  static featureFlags = FeatureFlags.allMaybe;
}

/**
 * Represents the data associated with an NFT, including state and permission flags.
 */
class NFTData extends Struct({
  /** The owner of the NFT. */
  owner: PublicKey,
  /** The approved address of the NFT. */
  approved: PublicKey,
  /** The version number of the NFT state. */
  version: UInt64,
  /** The unique identifier of the NFT within the collection. */
  id: UInt64,
  /** Determines whether the NFT's ownership can be changed via a zero-knowledge proof (readonly).
   *
   * It can be used only with update() and updateWithOracle() methods and
   * in this case overrides both canTransfer and canApprove flags used in the transfer methods
   */
  canChangeOwnerByProof: Bool, // readonly
  /** Specifies if the NFT's ownership can be transferred (readonly). Applies
   * to transfer methods and can be bypassed by the update() and updateWithOracle() methods
   */
  canTransfer: Bool, // readonly
  /** Specifies if the NFT's approved address can be changed (readonly). Transfer methods reset approved address to PublicKey.empty()
   *  on transfer independently from the canApprove flag value
   */
  canApprove: Bool, // readonly
  /** Indicates whether the NFT's metadata can be updated (readonly). */
  canChangeMetadata: Bool, // readonly
  /** Determines whether the storage associated with the NFT can be altered (readonly). */
  canChangeStorage: Bool, // readonly
  /** Specifies if the name of the NFT can be changed (readonly). */
  canChangeName: Bool, // readonly
  /** Indicates whether the verification key hash for the metadata can be changed (readonly). */
  canChangeMetadataVerificationKeyHash: Bool, // readonly
  /** Specifies if the NFT contract can be paused, preventing certain operations (readonly). */
  canPause: Bool, // readonly
  /** Indicates whether the NFT contract is currently paused. */
  isPaused: Bool,
  /** Determines whether the owner's authorization is required to upgrade the NFT's verification key (readonly). */
  requireOwnerAuthorizationToUpgrade: Bool, // readonly
}) {
  /**
   * Creates a new NFTData instance with optional parameters.
   * @param params The parameters to create the NFTData.
   * @returns A new NFTData instance.
   */
  static new(params: {
    owner: string | PublicKey;
    approved?: string | PublicKey;
    version?: number | bigint | string;
    id?: bigint | string;
    canChangeOwnerByProof?: boolean;
    canTransfer?: boolean;
    canApprove?: boolean;
    canChangeMetadata?: boolean;
    canChangeStorage?: boolean;
    canChangeName?: boolean;
    canChangeMetadataVerificationKeyHash?: boolean;
    canPause?: boolean;
    isPaused?: boolean;
    requireOwnerAuthorizationToUpgrade?: boolean;
  }): NFTData {
    const {
      owner,
      approved,
      version,
      id,
      canChangeOwnerByProof,
      canTransfer,
      canApprove,
      canChangeMetadata,
      canChangeStorage,
      canChangeName,
      canChangeMetadataVerificationKeyHash,
      canPause,
      isPaused,
      requireOwnerAuthorizationToUpgrade,
    } = params;
    return new NFTData({
      owner: typeof owner === "string" ? PublicKey.fromBase58(owner) : owner,
      approved: approved
        ? typeof approved === "string"
          ? PublicKey.fromBase58(approved)
          : approved
        : PublicKey.empty(),
      version: UInt64.from(BigInt(version ?? 0)),
      id: UInt64.from(BigInt(id ?? 0)),
      canChangeOwnerByProof: Bool(canChangeOwnerByProof ?? false),
      canTransfer: Bool(canTransfer ?? true),
      canApprove: Bool(canApprove ?? true),
      canChangeMetadata: Bool(canChangeMetadata ?? false),
      canChangeStorage: Bool(canChangeStorage ?? false),
      canChangeName: Bool(canChangeName ?? false),
      canChangeMetadataVerificationKeyHash: Bool(
        canChangeMetadataVerificationKeyHash ?? false
      ),
      canPause: Bool(canPause ?? false),
      isPaused: Bool(isPaused ?? false),
      requireOwnerAuthorizationToUpgrade: Bool(
        requireOwnerAuthorizationToUpgrade ?? false
      ),
    });
  }

  /**
   * Packs the NFTData into a single Field for efficient storage.
   * @returns The packed Field representation of the NFTData.
   */
  pack(): NFTDataPacked {
    return new NFTDataPacked({
      ownerX: this.owner.x,
      approvedX: this.approved.x,
      data: Field.fromBits([
        this.canChangeOwnerByProof,
        this.canTransfer,
        this.canApprove,
        this.canChangeMetadata,
        this.canChangeStorage,
        this.canChangeName,
        this.canChangeMetadataVerificationKeyHash,
        this.canPause,
        this.isPaused,
        this.requireOwnerAuthorizationToUpgrade,
        this.owner.isOdd,
        this.approved.isOdd,
      ])
        .add(Field(this.id.value).mul(Field(2 ** 12)))
        .add(Field(this.version.value).mul(Field(2 ** (12 + 64)))),
    });
  }

  /**
   * Unpacks a Field into an NFTData instance.
   * @param packed The packed Field representation of the NFTData.
   * @returns A new NFTData instance.
   */
  static unpack(packed: NFTDataPacked): NFTData {
    const unpacked = Provable.witness(NFTData, () => {
      const bits = Gadgets.and(packed.data, Field(0xfffn), 12 + 64 + 64).toBits(
        12
      );
      const idField = Gadgets.and(
        packed.data,
        Field(0xffffffffffffffff000n),
        12 + 64 + 64
      );
      const idBits = idField.toBits(64 + 12);
      // the next line relies on the constants 0xffffffffffffffff000n and 12 + 64 + 64 above
      const id = UInt64.Unsafe.fromField(
        Field.fromBits(idBits.slice(12, 64 + 12))
      );
      id.value.mul(Field(2 ** 12)).assertEquals(idField);

      const versionField = Gadgets.and(
        packed.data,
        Field(0xffffffffffffffff0000000000000000000n),
        64 + 64 + 12
      );
      const versionBits = versionField.toBits(12 + 64 + 64);
      // the next line relies on the constants 0xffffffffffffffff0000000000000000000n and 12 + 64 + 64 above
      const version = UInt64.Unsafe.fromField(
        Field.fromBits(versionBits.slice(12 + 64, 12 + 64 + 64))
      );
      version.value.mul(Field(2 ** (12 + 64))).assertEquals(versionField);

      const canChangeOwnerByProof = bits[0];
      const canTransfer = bits[1];
      const canApprove = bits[2];
      const canChangeMetadata = bits[3];
      const canChangeStorage = bits[4];
      const canChangeName = bits[5];
      const canChangeMetadataVerificationKeyHash = bits[6];
      const canPause = bits[7];
      const isPaused = bits[8];
      const requireOwnerAuthorizationToUpgrade = bits[9];
      const ownerIsOdd = bits[10];
      const approvedIsOdd = bits[11];
      const owner = PublicKey.from({ x: packed.ownerX, isOdd: ownerIsOdd });
      const approved = PublicKey.from({
        x: packed.approvedX,
        isOdd: approvedIsOdd,
      });
      return new NFTData({
        owner,
        approved,
        id,
        version,
        canChangeOwnerByProof,
        canTransfer,
        canApprove,
        canChangeMetadata,
        canChangeStorage,
        canChangeName,
        canChangeMetadataVerificationKeyHash,
        canPause,
        isPaused,
        requireOwnerAuthorizationToUpgrade,
      });
    });
    NFTDataPacked.assertEqual(unpacked.pack(), packed);
    return unpacked;
  }
}

const MAX_ROYALTY_FEE = 100000;

/**
 * Represents the data associated with an NFT collection, including configuration parameters and permission flags.
 */
class CollectionData extends Struct({
  /** The royalty fee percentage (e.g., 1000 = 1%, 100 = 0.1%, 10000 = 10%, 100000 = 100%). */
  royaltyFee: UInt32, // 1000 = 1%, 100 = 0.1%, 10000 = 10%, 100000 = 100%
  /** The transfer fee amount. */
  transferFee: UInt64,
  /** If true, transferring NFTs requires approval from the admin contract. */
  requireTransferApproval: Bool,
  /** If true, the minting is stopped and cannot be resumed. */
  mintingIsLimited: Bool,
  /** Indicates whether the collection is currently paused. */
  isPaused: Bool,
}) {
  /**
   * Creates a new CollectionData instance with specified parameters.
   * @param params The parameters to create the CollectionData.
   * @returns A new CollectionData instance.
   */
  static new(params: {
    royaltyFee?: number;
    transferFee?: number | bigint | string;
    requireTransferApproval?: boolean;
    mintingIsLimited?: boolean;
    isPaused?: boolean;
  }): CollectionData {
    const {
      royaltyFee,
      transferFee,
      requireTransferApproval,
      mintingIsLimited,
      isPaused,
    } = params;
    return new CollectionData({
      royaltyFee: UInt32.from(royaltyFee ?? 0),
      transferFee: UInt64.from(BigInt(transferFee ?? 0)),
      requireTransferApproval: Bool(requireTransferApproval ?? false),
      mintingIsLimited: Bool(mintingIsLimited ?? false),
      isPaused: Bool(isPaused ?? false),
    });
  }

  /**
   * Packs the CollectionData into a CollectionDataPacked representation for efficient storage.
   * @returns The packed CollectionDataPacked instance.
   */
  pack(): Field {
    return Field.fromBits([
      this.isPaused,
      this.requireTransferApproval,
      this.mintingIsLimited,
      ...this.royaltyFee.value.toBits(32),
      ...this.transferFee.value.toBits(64),
    ]);
  }

  /**
   * Unpacks a CollectionDataPacked instance into a CollectionData instance.
   * @param packed The packed CollectionDataPacked instance.
   * @returns A new CollectionData instance.
   */
  static unpack(packed: Field) {
    const bits = packed.toBits(3 + 32 + 64);
    const royaltyFee = UInt32.Unsafe.fromField(
      Field.fromBits(bits.slice(3, 3 + 32))
    );
    const transferFee = UInt64.Unsafe.fromField(
      Field.fromBits(bits.slice(3 + 32, 3 + 32 + 64))
    );

    return new CollectionData({
      isPaused: bits[0],
      requireTransferApproval: bits[1],
      mintingIsLimited: bits[2],
      royaltyFee,
      transferFee,
    });
  }

  static isPaused(packed: Field) {
    return packed.toBits(3 + 32 + 64)[0];
  }

  static requireTransferApproval(packed: Field) {
    return packed.toBits(3 + 32 + 64)[1];
  }
}

/**
 * Represents the parameters required for minting a new NFT.
 */
class MintParams extends Struct({
  /** The name of the NFT. */
  name: Field,
  /** The address of the NFT contract. */
  address: PublicKey,
  /** The token ID of the NFT. */
  tokenId: Field,
  /** The data associated with the NFT, including owner, approved, version, id, permissions and flags. */
  data: NFTData,
  /** The fee associated with minting the NFT. */
  fee: UInt64,
  /** The metadata associated with the NFT. */
  metadata: Field,
  /** The off-chain storage information (e.g., IPFS hash). */
  storage: Storage,
  /** The hash of the verification key used for metadata proofs. */
  metadataVerificationKeyHash: Field,
  /** The expiry time slot for minting the NFT. */
  expiry: UInt32,
}) {}

/**
 * Represents an optional MintParams, used in scenarios where minting may or may not be allowed.
 */
class MintParamsOption extends Option(MintParams) {}

/**
 * Represents a request to mint a new NFT, used by the admin contract to determine if minting is allowed.
 */
class MintRequest extends Struct({
  /** The address of the NFT contract where the NFT will be minted. */
  address: PublicKey,
  /** The owner of the new NFT (can be different from the sender). */
  owner: PublicKey, // can be different from the sender
  /** A custom value that can be interpreted by the admin contract. */
  context: NFTTransactionContext, // should be interpreted by the admin contract
}) {}

/**
 * Represents the parameters required for transferring an NFT using a signature.
 */
class TransferBySignatureParams extends Struct({
  /** The address of the NFT contract. */
  address: PublicKey,
  /** The receiver's public key. */
  to: PublicKey,
  /** Optional price for the transfer. */
  price: UInt64Option,
  /** Custom value that can be interpreted by the owner or approved contract. */
  context: NFTTransactionContext,
}) {}

/**
 * Represents the parameters required for transferring an NFT using a proof.
 */
class TransferByProofParams extends Struct({
  /** The address of the NFT contract. */
  address: PublicKey,
  /** The sender's public key. */
  from: PublicKey,
  /** The receiver's public key. */
  to: PublicKey,
  /** Optional price for the transfer. */
  price: UInt64Option,
  /** Custom value that can be interpreted by the owner or approved contract. */
  context: NFTTransactionContext,
}) {}

class TransferExtendedParams extends Struct({
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
  /** Custom value that can be interpreted by the owner or approved contract. */
  context: NFTTransactionContext,
}) {}
