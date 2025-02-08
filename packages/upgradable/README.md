# Upgradable Interface for Mina zkApps

## Upgrade Authority Contract

The **Upgrade Authority Contract** provides a secure mechanism for upgrading the verification keys of smart contracts without requiring redeployment. It manages a list of validators who can vote on upgrade proposals, ensuring that only authorized upgrades are applied.

#### Key Features

- **Verification Key Management**: Allows for secure upgrades of verification keys for other contracts.
- **Validators Governance**: Maintains a list of authorized validators who can vote on upgrade proposals.
- **Secure Voting Mechanism**: Implements Zero-Knowledge proofs to validate votes from validators without revealing sensitive information.
- **Upgrade Database Management**: Keeps track of upgrade proposals and their validity periods.
- **Event Emissions**: Emits events when validators list or upgrade database is updated.

#### State Variables

- `verificationKeyHash`: The hash of the proof verification key (`Field`).
- `validators`: The hash representing the current state of the validators list (`Field`).
- `upgradeDatabasePacked`: Packed state containing the upgrade database information (`UpgradeDatabaseStatePacked`).

#### Key Methods

```typescript:src/upgrade/upgrade.ts
class VerificationKeyUpgradeAuthority extends SmartContract implements UpgradeAuthorityBase {
  @method
  async initialize(validators: ValidatorsState, storage: Storage, verificationKeyHash: Field) {
    // Initialize the contract with validators and set the verification key hash
  }

  @method.returns(UpgradeAuthorityAnswer)
  async verifyUpgradeData(data: VerificationKeyUpgradeData): Promise<UpgradeAuthorityAnswer> {
    // Verify the upgrade data provided by another contract
  }

  @method
  async updateDatabase(proof: ValidatorsVotingProof, vk: VerificationKey) {
    // Update the upgrade database after validator consensus
  }

  @method
  async updateValidatorsList(validators: ValidatorsState, storage: Storage, proof: ValidatorsVotingProof, vk: VerificationKey) {
    // Update the validators list based on validator votes
  }

  // ... Additional methods and helper functions
}
```

#### Events

- `validatorsList`: Emitted when the validators list is updated.
- `updateDatabase`: Emitted when the upgrade database is updated.

#### Notes

- **Validator Governance**: Validators can vote on upgrade proposals. The contract uses Zero-Knowledge proofs (ZkPrograms) to verify validator votes securely.
- **Upgrade Process**: Contracts wishing to upgrade their verification keys interact with the Upgrade Authority Contract to verify that the new verification key is authorized.
- **Validators List Management**: The validators list is stored as a Merkle Tree for efficient verification and can be updated through consensus.
- **Off-chain Data**: Some data, like the full validators list, is stored off-chain (e.g., in IPFS) with only the root hash stored on-chain to optimize performance.
- **Security**: The contract ensures that only valid upgrade proposals that have been approved by the required number of validators are executed.

#### Usage Example

This contract is essential for scenarios where:

- **Decentralized Governance**: Multiple validators need to agree on contract upgrades, ensuring no single party can unilaterally upgrade the contract.
- **Secure Contract Upgrades**: Contracts can securely upgrade their verification keys without redeploying, maintaining continuity and state.
- **Regulated Environments**: Applications requiring compliance and oversight can leverage validator governance for contract changes.

For a contract to utilize the Upgrade Authority Contract, it needs to implement the `UpgradableContract` interface and interact with the `VerificationKeyUpgradeAuthority` for upgrading its verification key securely.
