import {
  Bool,
  method,
  Permissions,
  Provable,
  SmartContract,
  State,
  state,
  VerificationKey,
  Field,
  Struct,
  UInt32,
} from "o1js";
import {
  loadIndexedMerkleMap,
  createIpfsURL,
  IndexedMapSerialized,
  Storage,
} from "./storage/index.js";
import {
  UpgradeAuthorityBase,
  VerificationKeyUpgradeData,
  UpgradeAuthorityAnswer,
} from "./upgradable.js";
import {
  UpgradeAuthorityDatabase,
  ValidatorsState,
  UpgradeDatabaseState,
  ValidatorsVotingProof,
  ValidatorDecisionType,
  UpgradeDatabaseStatePacked,
} from "./validators.js";

export {
  VerificationKeyUpgradeAuthority,
  UpgradeAuthorityDatabase,
  ValidatorsListEvent,
  ValidatorsListData,
};

/**
 * Interface representing the data for a list of validators.
 */
interface ValidatorsListData {
  validators: {
    publicKey: string;
    authorizedToVote: boolean;
  }[];
  validatorsCount: number;
  root: string;
  map: IndexedMapSerialized;
}

/**
 * Event emitted when the validators list is updated.
 */
class ValidatorsListEvent extends Struct({
  validators: ValidatorsState,
  storage: Storage,
}) {}

/**
 * Error messages for the VerificationKeyUpgradeAuthority contract.
 */
const VerificationKeyUpgradeAuthorityErrors = {
  WrongNewVerificationKeyHash: "Wrong new verification key hash",
};

/**
 * **VerificationKeyUpgradeAuthority** is a smart contract that provides a secure mechanism
 * for upgrading the verification keys of other contracts without requiring redeployment.
 * It manages a list of validators who can vote on upgrade proposals, ensuring that only
 * authorized upgrades are applied.
 *
 * **Key Features:**
 * - **Verification Key Management**: Allows for secure upgrades of verification keys for other contracts.
 * - **Validators Governance**: Maintains a list of authorized validators who can vote on upgrade proposals.
 * - **Secure Voting Mechanism**: Implements Zero-Knowledge proofs to validate votes from validators without revealing sensitive information.
 * - **Upgrade Database Management**: Keeps track of upgrade proposals and their validity periods.
 * - **Event Emissions**: Emits events when validators list or upgrade database is updated.
 */
class VerificationKeyUpgradeAuthority
  extends SmartContract
  implements UpgradeAuthorityBase
{
  /**
   * The hash of the verification key.
   * @type {State<Field>}
   */
  @state(Field) verificationKeyHash = State<Field>();

  /**
   * The hash representing the current state of the validators list.
   * @type {State<Field>}
   */
  @state(Field) validators = State<Field>();

  /**
   * Packed state containing the upgrade database information.
   * @type {State<UpgradeDatabaseStatePacked>}
   */
  @state(UpgradeDatabaseStatePacked)
  upgradeDatabasePacked = State<UpgradeDatabaseStatePacked>();

  /**
   * The events emitted by the VerificationKeyUpgradeAuthority contract.
   */
  events = {
    validatorsList: ValidatorsListEvent,
    updateDatabase: UpgradeDatabaseState,
  };

  /**
   * Deploys the contract and sets the initial state.
   */
  async deploy() {
    await super.deploy();
    this.upgradeDatabasePacked.set(UpgradeDatabaseState.empty().pack());
    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey:
        // The contract needs to be redeployed in the case of an upgrade.
        Permissions.VerificationKey.impossibleDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
    });
  }

  /**
   * Initializes the contract with validators and sets the verification key hash.
   *
   * @param {ValidatorsState} validators - The initial validators state.
   * @param {Storage} storage - Off-chain storage information, e.g., IPFS hash.
   * @param {Field} verificationKeyHash - The hash of the verification key.
   */
  @method
  async initialize(
    validators: ValidatorsState,
    storage: Storage,
    verificationKeyHash: Field
  ) {
    this.account.provedState.requireEquals(Bool(false));
    await this.setValidatorsList(validators, storage);
    this.verificationKeyHash.set(verificationKeyHash);
  }

  /**
   * Sets the validators list and emits an event.
   *
   * @param {ValidatorsState} validators - The validators state to set.
   * @param {Storage} storage - The storage associated with the validators list.
   */
  async setValidatorsList(validators: ValidatorsState, storage: Storage) {
    this.validators.set(validators.hash());
    this.emitEvent(
      "validatorsList",
      new ValidatorsListEvent({ validators, storage })
    );
  }

  /**
   * Verifies the upgrade data provided by another contract.
   *
   * @param {VerificationKeyUpgradeData} data - The upgrade data to verify.
   * @returns {Promise<UpgradeAuthorityAnswer>} - The answer indicating verification result.
   */
  @method.returns(UpgradeAuthorityAnswer)
  public async verifyUpgradeData(
    data: VerificationKeyUpgradeData
  ): Promise<UpgradeAuthorityAnswer> {
    const upgradeDatabase = UpgradeDatabaseState.unpack(
      this.upgradeDatabasePacked.getAndRequireEquals()
    );
    this.network.globalSlotSinceGenesis.requireBetween(
      upgradeDatabase.validFrom,
      UInt32.MAXINT()
    );
    const map = await Provable.witnessAsync(
      UpgradeAuthorityDatabase,
      async () => {
        return await loadIndexedMerkleMap({
          url: createIpfsURL({ hash: upgradeDatabase.storage.toString() }),
          type: UpgradeAuthorityDatabase,
        });
      }
    );
    map.root.assertEquals(upgradeDatabase.root);
    const key = data.hash();
    const newVerificationKeyHash = map.get(key);
    newVerificationKeyHash.assertEquals(
      data.newVerificationKeyHash,
      VerificationKeyUpgradeAuthorityErrors.WrongNewVerificationKeyHash
    );
    return new UpgradeAuthorityAnswer({
      // Should be public key of the next upgrade authority in case
      // new version of o1js breaks the verification key of upgrade authority
      nextUpgradeAuthority: upgradeDatabase.nextUpgradeAuthority,
      isVerified: Bool(true),
    });
  }

  /**
   * Updates the upgrade database after validator consensus.
   *
   * @param {ValidatorsVotingProof} proof - The proof of validators voting.
   * @param {VerificationKey} vk - The verification key to validate the proof.
   */
  @method
  async updateDatabase(
    proof: ValidatorsVotingProof,
    vk: VerificationKey,
    validators: ValidatorsState
  ) {
    const oldUpgradeDatabase = UpgradeDatabaseState.unpack(
      this.upgradeDatabasePacked.getAndRequireEquals()
    );
    const upgradeDatabase = proof.publicInput.decision.upgradeDatabase;
    upgradeDatabase.version.assertGreaterThan(oldUpgradeDatabase.version);
    await this.checkValidatorsDecision(
      proof,
      vk,
      ValidatorDecisionType["updateDatabase"],
      validators
    );

    // This does not create a constraint on the storage,
    // serves to prevent deployment errors.
    // Can be replaced with Data Availability proof in the future.
    // TODO: consider using Celestia DA for this.
    const map = await Provable.witnessAsync(
      UpgradeAuthorityDatabase,
      async () => {
        return await loadIndexedMerkleMap({
          url: createIpfsURL({ hash: upgradeDatabase.storage.toString() }),
          type: UpgradeAuthorityDatabase,
        });
      }
    );
    map.root.assertEquals(upgradeDatabase.root);
    this.upgradeDatabasePacked.set(upgradeDatabase.pack());
    this.emitEvent("updateDatabase", upgradeDatabase);
  }

  /**
   * Updates the validators list based on validator votes.
   *
   * @param {ValidatorsState} validators - The new validators state.
   * @param {Storage} storage - The storage associated with the validators list.
   * @param {ValidatorsVotingProof} proof - The proof of validators voting.
   * @param {VerificationKey} vk - The verification key to validate the proof.
   */
  @method // add proof of validators voting
  async updateValidatorsList(
    validators: ValidatorsState,
    storage: Storage,
    proof: ValidatorsVotingProof,
    vk: VerificationKey
  ) {
    await this.checkValidatorsDecision(
      proof,
      vk,
      ValidatorDecisionType["updateValidatorsList"],
      validators
    );
    await this.setValidatorsList(validators, storage);
  }

  /**
   * Checks the validators' decision by verifying the provided proof.
   *
   * @param {ValidatorsVotingProof} proof - The proof to verify.
   * @param {VerificationKey} vk - The verification key to validate the proof.
   * @param {Field} decisionType - The type of decision being validated.
   */
  async checkValidatorsDecision(
    proof: ValidatorsVotingProof,
    vk: VerificationKey,
    decisionType: Field,
    validatorsState: ValidatorsState
  ) {
    this.network.globalSlotSinceGenesis.requireBetween(
      UInt32.zero,
      proof.publicInput.decision.expiry
    );
    vk.hash.assertEquals(this.verificationKeyHash.getAndRequireEquals());
    proof.verify(vk);
    proof.publicInput.decision.validators
      .hash()
      .assertEquals(this.validators.getAndRequireEquals());
    proof.publicInput.decision.decisionType.assertEquals(decisionType);
    proof.publicInput.decision.contractAddress.assertEquals(this.address);
    validatorsState.hash().assertEquals(this.validators.getAndRequireEquals());
    proof.publicOutput.yesVotes.mul(2).assertGreaterThan(validatorsState.count);
  }
}
