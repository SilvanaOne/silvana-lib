import { describe, it } from "node:test";
import assert from "node:assert";
import {
  UInt32,
  Bool,
  UInt64,
  PrivateKey,
  PublicKey,
  Field,
  Struct,
  ZkProgram,
  Gadgets,
  Provable,
} from "o1js";
import { NFTData, NFTDataPacked } from "../src/index.js";

const NUMBER_OF_ITERATIONS = 1000;
const randomBool = () => Math.random() < 0.5;

/**
 * Represents the data associated with an NFT, including state and permission flags.
 */
class NFTDataVersion2 extends Struct({
  /** The owner of the NFT. */
  owner: PublicKey,
  /** The approved address of the NFT. */
  approved: PublicKey,
  /** The version number of the NFT state. */
  version: UInt32,
  /** The unique identifier of the NFT within the collection. */
  id: UInt64,
  /** Determines whether the NFT's ownership can be changed via a zero-knowledge proof (readonly). */
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
    version?: number;
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
  }): NFTDataVersion2 {
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
    return new NFTDataVersion2({
      owner: typeof owner === "string" ? PublicKey.fromBase58(owner) : owner,
      approved: approved
        ? typeof approved === "string"
          ? PublicKey.fromBase58(approved)
          : approved
        : PublicKey.empty(),
      version: UInt32.from(version ?? 0),
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
    //const id = this.id.value.toBits(64);
    //const version = this.version.value.toBits(32);
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
  static unpack(packed: NFTDataPacked): NFTDataVersion2 {
    const bits = Gadgets.and(packed.data, Field(0xfffn), 12 + 64 + 32).toBits(
      12
    );
    const idField = Gadgets.and(
      packed.data,
      Field(0xffffffffffffffff000n),
      12 + 64 + 32
    );
    const id = Provable.witness(UInt64, () => {
      const idBits = idField.toBits(64 + 12);
      return UInt64.Unsafe.fromField(Field.fromBits(idBits.slice(12, 64 + 12)));
    });
    id.value.mul(Field(2 ** 12)).assertEquals(idField);
    const versionField = Gadgets.and(
      packed.data,
      Field(0xffffffff0000000000000000000n),
      64 + 32 + 12
    );
    const version = Provable.witness(UInt32, () => {
      const versionBits = versionField.toBits(12 + 64 + 32);
      return UInt32.Unsafe.fromField(
        Field.fromBits(versionBits.slice(12 + 64, 12 + 64 + 32))
      );
    });
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
  }
}

const Pack = ZkProgram({
  name: "Pack",
  publicInput: Field,
  publicOutput: Field,
  methods: {
    pack1: {
      privateInputs: [NFTData],
      async method(
        publicInput: Field,
        input: NFTData
      ): Promise<{ publicOutput: Field; auxiliaryOutput: NFTDataPacked }> {
        const packedData = input.pack();
        return {
          publicOutput: packedData.data,
          auxiliaryOutput: packedData,
        };
      },
    },
    pack2: {
      privateInputs: [NFTDataVersion2],
      async method(
        publicInput: Field,
        input: NFTDataVersion2
      ): Promise<{ publicOutput: Field; auxiliaryOutput: NFTDataPacked }> {
        const packedData = input.pack();
        return {
          publicOutput: packedData.data,
          auxiliaryOutput: packedData,
        };
      },
    },
    unpack1: {
      privateInputs: [NFTDataPacked],
      async method(
        publicInput: Field,
        input: NFTDataPacked
      ): Promise<{ publicOutput: Field; auxiliaryOutput: NFTData }> {
        const unpackedData = NFTData.unpack(input);
        return {
          publicOutput: unpackedData.id.value,
          auxiliaryOutput: unpackedData,
        };
      },
    },
    unpack2: {
      privateInputs: [NFTDataPacked],
      async method(
        publicInput: Field,
        input: NFTDataPacked
      ): Promise<{ publicOutput: Field; auxiliaryOutput: NFTDataVersion2 }> {
        const unpackedData = NFTDataVersion2.unpack(input);
        return {
          publicOutput: unpackedData.id.value,
          auxiliaryOutput: unpackedData,
        };
      },
    },
  },
});

describe("Test packing and unpacking", async () => {
  it("should pack and unpack NFTData", async () => {
    for (let i = 0; i < NUMBER_OF_ITERATIONS; i++) {
      const randomVersion = UInt32.from(Math.floor(Math.random() * 2 ** 32));
      const randomId = UInt64.from(Math.floor(Math.random() * 2 ** 64));
      const original = new NFTData({
        owner: PrivateKey.random().toPublicKey(),
        approved: PrivateKey.random().toPublicKey(),
        version: randomVersion,
        id: randomId,
        canChangeOwnerByProof: Bool(randomBool()),
        canTransfer: Bool(randomBool()),
        canApprove: Bool(randomBool()),
        canChangeMetadata: Bool(randomBool()),
        canChangeStorage: Bool(randomBool()),
        canChangeName: Bool(randomBool()),
        canChangeMetadataVerificationKeyHash: Bool(randomBool()),
        canPause: Bool(randomBool()),
        isPaused: Bool(randomBool()),
        requireOwnerAuthorizationToUpgrade: Bool(randomBool()),
      });

      const packed = original.pack();
      const unpacked = NFTData.unpack(packed);

      assert.strictEqual(
        unpacked.owner.equals(original.owner).toBoolean(),
        true
      );
      assert.strictEqual(
        unpacked.approved.equals(original.approved).toBoolean(),
        true
      );
      assert.strictEqual(
        unpacked.version.toBigint(),
        original.version.toBigint()
      );
      assert.strictEqual(unpacked.id.toBigInt(), original.id.toBigInt());
      assert.strictEqual(
        unpacked.canChangeOwnerByProof.toBoolean(),
        original.canChangeOwnerByProof.toBoolean()
      );
      assert.strictEqual(
        unpacked.canTransfer.toBoolean(),
        original.canTransfer.toBoolean()
      );
      assert.strictEqual(
        unpacked.canApprove.toBoolean(),
        original.canApprove.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeMetadata.toBoolean(),
        original.canChangeMetadata.toBoolean()
      );

      assert.strictEqual(
        unpacked.canChangeStorage.toBoolean(),
        original.canChangeStorage.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeName.toBoolean(),
        original.canChangeName.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeMetadataVerificationKeyHash.toBoolean(),
        original.canChangeMetadataVerificationKeyHash.toBoolean()
      );
      assert.strictEqual(
        unpacked.canPause.toBoolean(),
        original.canPause.toBoolean()
      );
      assert.strictEqual(
        unpacked.isPaused.toBoolean(),
        original.isPaused.toBoolean()
      );
      assert.strictEqual(
        unpacked.requireOwnerAuthorizationToUpgrade.toBoolean(),
        original.requireOwnerAuthorizationToUpgrade.toBoolean()
      );
    }
  });

  it("should pack and unpack NFTDataVersion2", async () => {
    for (let i = 0; i < NUMBER_OF_ITERATIONS; i++) {
      const randomVersion = UInt32.from(Math.floor(Math.random() * 2 ** 32));
      const randomId = UInt64.from(Math.floor(Math.random() * 2 ** 64));
      const original = new NFTDataVersion2({
        owner: PrivateKey.random().toPublicKey(),
        approved: PrivateKey.random().toPublicKey(),
        version: randomVersion,
        id: randomId,
        canChangeOwnerByProof: Bool(randomBool()),
        canTransfer: Bool(randomBool()),
        canApprove: Bool(randomBool()),
        canChangeMetadata: Bool(randomBool()),
        canChangeStorage: Bool(randomBool()),
        canChangeName: Bool(randomBool()),
        canChangeMetadataVerificationKeyHash: Bool(randomBool()),
        canPause: Bool(randomBool()),
        isPaused: Bool(randomBool()),
        requireOwnerAuthorizationToUpgrade: Bool(randomBool()),
      });

      const packed = original.pack();
      const unpacked = NFTDataVersion2.unpack(packed);

      assert.strictEqual(
        unpacked.owner.equals(original.owner).toBoolean(),
        true
      );
      assert.strictEqual(
        unpacked.approved.equals(original.approved).toBoolean(),
        true
      );
      assert.strictEqual(
        unpacked.version.toBigint(),
        original.version.toBigint()
      );
      assert.strictEqual(unpacked.id.toBigInt(), original.id.toBigInt());
      assert.strictEqual(
        unpacked.canChangeOwnerByProof.toBoolean(),
        original.canChangeOwnerByProof.toBoolean()
      );
      assert.strictEqual(
        unpacked.canTransfer.toBoolean(),
        original.canTransfer.toBoolean()
      );
      assert.strictEqual(
        unpacked.canApprove.toBoolean(),
        original.canApprove.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeMetadata.toBoolean(),
        original.canChangeMetadata.toBoolean()
      );

      assert.strictEqual(
        unpacked.canChangeStorage.toBoolean(),
        original.canChangeStorage.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeName.toBoolean(),
        original.canChangeName.toBoolean()
      );
      assert.strictEqual(
        unpacked.canChangeMetadataVerificationKeyHash.toBoolean(),
        original.canChangeMetadataVerificationKeyHash.toBoolean()
      );
      assert.strictEqual(
        unpacked.canPause.toBoolean(),
        original.canPause.toBoolean()
      );
      assert.strictEqual(
        unpacked.isPaused.toBoolean(),
        original.isPaused.toBoolean()
      );
      assert.strictEqual(
        unpacked.requireOwnerAuthorizationToUpgrade.toBoolean(),
        original.requireOwnerAuthorizationToUpgrade.toBoolean()
      );
    }
  });
  it("should calculate number of constraints", async () => {
    const methods = await Pack.analyzeMethods();
    console.log("pack1:", methods.pack1.rows);
    console.log("pack2:", methods.pack2.rows);
    console.log("unpack1:", methods.unpack1.rows);
    console.log("unpack2:", methods.unpack2.rows);
  });
});
