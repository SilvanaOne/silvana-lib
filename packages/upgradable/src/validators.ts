import {
  Struct,
  Field,
  PublicKey,
  Signature,
  ZkProgram,
  Poseidon,
  SelfProof,
  UInt32,
  DynamicProof,
  FeatureFlags,
  Bool,
  Nullifier,
  PrivateKey,
  Provable,
  Encoding,
  IndexedMerkleMap,
} from "o1js";
import { Storage } from "@silvana-one/storage";
import { PublicKeyOption } from "./upgradable.js";
import MinaSigner from "mina-signer";

export {
  ValidatorsList,
  UpgradeAuthorityDatabase,
  ValidatorsState,
  ValidatorsDecision,
  ValidatorDecisionType,
  ValidatorsDecisionState,
  ValidatorsVoting,
  ValidatorsVotingProof,
  ValidatorsVotingNativeProof,
  UpgradeDatabaseState,
  UpgradeDatabaseStatePacked,
  ChainId,
};

const VALIDATORS_LIST_HEIGHT = 10;
const UPGRADE_AUTHORITY_DATABASE_HEIGHT = 20;

/**
 * The `ValidatorsList` is an indexed Merkle map used to store the list of validators.
 */
class ValidatorsList extends IndexedMerkleMap(VALIDATORS_LIST_HEIGHT) {}

/**
 * The `UpgradeAuthorityDatabase` is an indexed Merkle map used to manage upgrade proposals.
 */
class UpgradeAuthorityDatabase extends IndexedMerkleMap(
  UPGRADE_AUTHORITY_DATABASE_HEIGHT
) {}

/** Chain IDs following Auro Wallet naming conventions. */
const ChainId = {
  "mina:mainnet": fieldFromString("mina:mainnet"),
  "mina:devnet": fieldFromString("mina:devnet"),
  "zeko:mainnet": fieldFromString("zeko:mainnet"),
  "zeko:devnet": fieldFromString("zeko:devnet"),
};
type ChainId = keyof typeof ChainId;

/** Validator decision types for upgrade proposals. */
const ValidatorDecisionType = {
  updateDatabase: fieldFromString("updateDatabase"),
  updateValidatorsList: fieldFromString("updateValidatorsList"),
} as const;
type ValidatorDecisionType = keyof typeof ValidatorDecisionType;

/**
 * Represents the state of the validators.
 */
class ValidatorsState extends Struct({
  /** Chain ID (e.g., 'mina:mainnet') */
  chainId: Field,
  /** Merkle root of the ValidatorsList */
  root: Field,
  /** Number of validators */
  count: UInt32,
}) {
  /**
   * Asserts that two `ValidatorsState` instances are equal.
   * @param a First `ValidatorsState` instance.
   * @param b Second `ValidatorsState` instance.
   */
  static assertEquals(a: ValidatorsState, b: ValidatorsState) {
    a.chainId.assertEquals(b.chainId);
    a.root.assertEquals(b.root);
    a.count.assertEquals(b.count);
  }

  /**
   * Computes the hash of the validators state.
   * @returns Hash of the current state.
   */
  hash() {
    return Poseidon.hashPacked(ValidatorsState, this);
  }

  /**
   * Returns an empty `ValidatorsState`.
   * @returns An empty `ValidatorsState` instance.
   */
  static empty() {
    return new ValidatorsState({
      chainId: Field(0),
      root: Field(0),
      count: UInt32.zero,
    });
  }
}

/**
 * Represents the packed state of the upgrade database.
 */
class UpgradeDatabaseStatePacked extends Struct({
  /** Root of the UpgradeAuthority database */
  root: Field,
  /** Storage information (e.g., IPFS hash) */
  storage: Storage,
  /** X-coordinate of the next upgrade authority's public key */
  nextUpgradeAuthorityX: Field,
  /** Packed data containing version, validFrom, and flags */
  data: Field,
}) {}

/**
 * Represents the state of the upgrade database.
 */
class UpgradeDatabaseState extends Struct({
  /** Root of the UpgradeAuthority database */
  root: Field,
  /** Storage information (e.g., IPFS hash) */
  storage: Storage,
  /** Optional public key of the next upgrade authority */
  nextUpgradeAuthority: PublicKeyOption,
  /** Version of the UpgradeAuthorityDatabase */
  version: UInt32,
  /** Slot when the UpgradeAuthority is valid from */
  validFrom: UInt32,
}) {
  /**
   * Asserts that two `UpgradeDatabaseState` instances are equal.
   * @param a First `UpgradeDatabaseState` instance.
   * @param b Second `UpgradeDatabaseState` instance.
   */
  static assertEquals(a: UpgradeDatabaseState, b: UpgradeDatabaseState) {
    a.root.assertEquals(b.root);
    Storage.assertEquals(a.storage, b.storage);
    a.nextUpgradeAuthority.value.assertEquals(b.nextUpgradeAuthority.value);
    a.nextUpgradeAuthority.isSome.assertEquals(b.nextUpgradeAuthority.isSome);
    a.version.assertEquals(b.version);
  }

  /**
   * Returns an empty `UpgradeDatabaseState`.
   * @returns An empty `UpgradeDatabaseState` instance.
   */
  static empty() {
    return new UpgradeDatabaseState({
      root: new UpgradeAuthorityDatabase().root,
      storage: Storage.empty(),
      nextUpgradeAuthority: PublicKeyOption.none(),
      version: UInt32.zero,
      validFrom: UInt32.MAXINT(),
    });
  }

  /**
   * Packs the `UpgradeDatabaseState` into a `UpgradeDatabaseStatePacked`.
   * @returns A packed representation of the upgrade database state.
   */
  pack(): UpgradeDatabaseStatePacked {
    const nextUpgradeAuthorityX = this.nextUpgradeAuthority.value.x;
    const data = Field.fromBits([
      ...this.version.value.toBits(32),
      ...this.validFrom.value.toBits(32),
      this.nextUpgradeAuthority.value.isOdd,
      this.nextUpgradeAuthority.isSome,
    ]);
    return new UpgradeDatabaseStatePacked({
      root: this.root,
      storage: this.storage,
      nextUpgradeAuthorityX,
      data,
    });
  }

  /**
   * Unpacks a `UpgradeDatabaseStatePacked` into a `UpgradeDatabaseState`.
   * @param packed The packed upgrade database state.
   * @returns An unpacked `UpgradeDatabaseState` instance.
   */
  static unpack(packed: UpgradeDatabaseStatePacked): UpgradeDatabaseState {
    const bits = packed.data.toBits(66);
    const versionBits = bits.slice(0, 32);
    const validFromBits = bits.slice(32, 64);
    const isOddBit = bits[64];
    const isSomeBit = bits[65];
    const version = UInt32.Unsafe.fromField(Field.fromBits(versionBits));
    const validFrom = UInt32.Unsafe.fromField(Field.fromBits(validFromBits));
    const nextUpgradeAuthority = PublicKeyOption.from(
      PublicKey.from({ x: packed.nextUpgradeAuthorityX, isOdd: isOddBit })
    );
    nextUpgradeAuthority.isSome = isSomeBit;
    return new UpgradeDatabaseState({
      root: packed.root,
      storage: packed.storage,
      nextUpgradeAuthority,
      version,
      validFrom,
    });
  }
}

/**
 * Represents a decision made by the validators.
 */
class ValidatorsDecision extends Struct({
  /** Message to be signed when producing the nullifier, also serves as the nonce to prevent replay attacks */
  message: Field,
  /** Type of decision (e.g., 'updateDatabase') */
  decisionType: Field,
  /** UpgradeAuthority contract address */
  contractAddress: PublicKey,
  /** Chain ID */
  chainId: Field,
  /** Current validators state */
  validators: ValidatorsState,
  /** Current upgrade database state */
  upgradeDatabase: UpgradeDatabaseState,
  /** Proposed update to validators state */
  updateValidatorsList: ValidatorsState,
  /** Slot when decision expires */
  expiry: UInt32,
}) {
  /**
   * Asserts that two `ValidatorsDecision` instances are equal.
   * @param a First `ValidatorsDecision` instance.
   * @param b Second `ValidatorsDecision` instance.
   */
  static assertEquals(a: ValidatorsDecision, b: ValidatorsDecision) {
    a.message.assertEquals(b.message);
    a.decisionType.assertEquals(b.decisionType);
    a.contractAddress.assertEquals(b.contractAddress);
    a.chainId.assertEquals(b.chainId);
    ValidatorsState.assertEquals(a.validators, b.validators);
    UpgradeDatabaseState.assertEquals(a.upgradeDatabase, b.upgradeDatabase);
    a.expiry.assertEquals(b.expiry);
  }

  createNullifierMessage(): Field[] {
    return [this.message, ...ValidatorsDecision.toFields(this)];
  }

  createJsonNullifier(params: {
    network: "mainnet" | "testnet";
    privateKey: PrivateKey;
  }) {
    const { network, privateKey } = params;
    const minaSigner = new MinaSigner({ network });
    const message = this.createNullifierMessage();
    const nullifier = minaSigner.createNullifier(
      message.map((field) => field.toBigInt()),
      privateKey.toBase58()
    );
    return nullifier;
  }
}

/**
 * Represents the state of a validators decision during the voting process.
 */
class ValidatorsDecisionState extends Struct({
  /** The validators' decision */
  decision: ValidatorsDecision,
  /** Indexed Merkle Map root of the validators who have voted */
  alreadyVoted: Field,
  /** Number of votes in favor of the decision */
  yesVotes: UInt32,
  /** Number of votes against the decision */
  noVotes: UInt32,
  /** Number of votes of abstention */
  abstainVotes: UInt32,
}) {
  static startVoting(decision: ValidatorsDecision) {
    return new ValidatorsDecisionState({
      decision,
      alreadyVoted: new ValidatorsList().root,
      yesVotes: UInt32.zero,
      noVotes: UInt32.zero,
      abstainVotes: UInt32.zero,
    });
  }
  /**
   * Records a vote
   * @param validatorNullifier The nullifier of the validator.
   * @param validatorsList The ValidatorsList containing authorized validators.
   * @param votedList The ValidatorsList tracking who has already voted.
   * @param yes Whether this is a "yes" vote.
   * @param no Whether this is a "no" vote.
   * @param abstain Whether this is an "abstain" vote.
   * @param signature The signature of the validator.
   * @returns A new `ValidatorsDecisionState` reflecting the vote.
   */
  vote(
    validatorNullifier: Nullifier,
    validatorsList: ValidatorsList,
    votedList: ValidatorsList,
    yes: Bool,
    no: Bool,
    abstain: Bool,
    signature: Signature
  ) {
    const publicKey = validatorNullifier.getPublicKey();
    const key = validatorNullifier.key();
    validatorNullifier.verify(this.decision.createNullifierMessage());

    const previousVotesCount = this.yesVotes
      .add(this.noVotes)
      .add(this.abstainVotes);
    const yesVotes = this.yesVotes.add(
      Provable.if(yes, UInt32.from(1), UInt32.from(0))
    );
    const noVotes = this.noVotes.add(
      Provable.if(no, UInt32.from(1), UInt32.from(0))
    );
    const abstainVotes = this.abstainVotes.add(
      Provable.if(abstain, UInt32.from(1), UInt32.from(0))
    );
    // Ensure exactly one vote type is selected
    previousVotesCount
      .add(UInt32.from(1))
      .assertEquals(yesVotes.add(noVotes).add(abstainVotes));

    const hash = Poseidon.hashPacked(PublicKey, publicKey);
    validatorsList.root.assertEquals(this.decision.validators.root);
    validatorsList
      .get(hash)
      .assertBool("Wrong ValidatorsList format")
      .assertTrue("Validator doesn't have authority to sign");
    signature
      .verify(publicKey, ValidatorsDecision.toFields(this.decision))
      .assertTrue("Wrong validator signature");
    this.decision.validators.root.assertEquals(validatorsList.root);
    votedList.root.assertEquals(this.alreadyVoted);
    votedList.insert(key, Field(1));
    return new ValidatorsDecisionState({
      decision: this.decision,
      alreadyVoted: votedList.root,
      yesVotes,
      noVotes,
      abstainVotes,
    });
  }

  /**
   * Asserts that two `ValidatorsDecisionState` instances are equal.
   * @param a First `ValidatorsDecisionState` instance.
   * @param b Second `ValidatorsDecisionState` instance.
   */
  static assertEquals(a: ValidatorsDecisionState, b: ValidatorsDecisionState) {
    ValidatorsDecision.assertEquals(a.decision, b.decision);
    a.alreadyVoted.assertEquals(b.alreadyVoted);
    a.yesVotes.assertEquals(b.yesVotes);
    a.noVotes.assertEquals(b.noVotes);
    a.abstainVotes.assertEquals(b.abstainVotes);
  }
}

/**
 * The `ValidatorsVoting` ZkProgram implements the voting logic for validators.
 */
const ValidatorsVoting = ZkProgram({
  name: "ValidatorsVoting",
  publicInput: ValidatorsDecisionState,
  publicOutput: ValidatorsDecisionState,

  methods: {
    /**
     * Starts the voting process for a decision.
     */
    startVoting: {
      privateInputs: [ValidatorsDecision],

      async method(
        state: ValidatorsDecisionState,
        decision: ValidatorsDecision
      ) {
        const calculatedState = ValidatorsDecisionState.startVoting(decision);
        ValidatorsDecisionState.assertEquals(state, calculatedState);
        return { publicOutput: calculatedState };
      },
    },
    /**
     * Records a vote
     */
    vote: {
      privateInputs: [
        ValidatorsDecision,
        Nullifier,
        ValidatorsList,
        ValidatorsList,
        Bool,
        Bool,
        Bool,
        Signature,
      ],

      async method(
        state: ValidatorsDecisionState,
        decision: ValidatorsDecision,
        nullifier: Nullifier,
        validatorsList: ValidatorsList,
        votedList: ValidatorsList,
        yes: Bool,
        no: Bool,
        abstain: Bool,
        signature: Signature
      ) {
        const calculatedState = state.vote(
          nullifier,
          validatorsList,
          votedList,
          yes,
          no,
          abstain,
          signature
        );
        return { publicOutput: calculatedState };
      },
    },

    /**
     * Merges two `ValidatorsDecisionState` proofs.
     */
    merge: {
      privateInputs: [SelfProof, SelfProof],

      async method(
        state: ValidatorsDecisionState,
        proof1: SelfProof<ValidatorsDecisionState, ValidatorsDecisionState>,
        proof2: SelfProof<ValidatorsDecisionState, ValidatorsDecisionState>
      ) {
        proof1.verify();
        proof2.verify();
        ValidatorsDecisionState.assertEquals(state, proof1.publicInput);
        ValidatorsDecisionState.assertEquals(
          proof1.publicOutput,
          proof2.publicInput
        );
        return { publicOutput: proof2.publicOutput };
      },
    },
  },
});

/** Proof classes for the `ValidatorsVoting` ZkProgram. */
class ValidatorsVotingNativeProof extends ZkProgram.Proof(ValidatorsVoting) {}
class ValidatorsVotingProof extends DynamicProof<
  ValidatorsDecisionState,
  ValidatorsDecisionState
> {
  static publicInputType = ValidatorsDecisionState;
  static publicOutputType = ValidatorsDecisionState;
  static maxProofsVerified = 2 as const;
  static featureFlags = FeatureFlags.allMaybe;
}

/**
 * Converts a `Field` element to a string representation.
 * This is used for serializing `Field` values into strings suitable for storage or transmission.
 *
 * @param {Field} field - The `Field` element to convert.
 * @returns {string} The string representation of the `Field`.
 */
function fieldToString(field: Field): string {
  return Encoding.stringFromFields([field]);
}

/**
 * Reconstructs a `Field` element from its string representation.
 * This function is essential for deserializing strings back into `Field` elements,
 * which can then be used within the smart contract logic.
 *
 * @param {string} storage - The string representation of the `Field`.
 * @returns {Field} The reconstructed `Field` element.
 * @throws Will throw an error if the input string does not correspond to exactly one `Field`.
 */
function fieldFromString(storage: string): Field {
  const fields = Encoding.stringToFields(storage);
  if (fields.length !== 1) throw new Error("String is too long");
  return fields[0];
}
