# Guide to Collection Creators and Users on best practices

Similar to many projects, Mina’s NFT Standard defines several roles/contracts which are given special permissions or perform important validations for critical operations. The abilities of these entities and their trust assumptions are outlined below.

The core contracts rely on various contracts which may depend on the particular application. In particular, `NFT` owners, `NFT` approved spenders, `NFT` admins, and `NFT` oracle contracts may vary from `Collection` to `Collection` and are not specified here.

**_the NFTStandardApproval, NFTStandardOwner, NFTStandardUpdate are templates that are not intended to be used as-is_**, and are to be changed according to the case of the collection creator or developer that is implementing NFT auction or NFT game. Veridise analysts did review these contracts and found no flaws, but they are highly centralized wrappers around a standard user accounts. The collection creator or debveloper can extend the contracts to make them decentralized according to the requirements of the projects, with example of such implementations provided in this repo.

In case the contracts are used as is, the following applies:

## Protocol Contract Roles

1. `Collection`:
   1. deployer: This is any party who may produce signatures for the `Collection.address`. The deployer has a highly privileged role, but only during deployment, initialization, and network upgrades. The deployer may perform any of the following actions:
      1. Set the permissions as specified during deployment.
      2. Upgrade the `Collection` during a hard fork.
      3. Initialize the `Collection` without permission of the `admin`/`creator`, allowing them to determine the entire `CollectionData` initial state and set the “master NFT”.
   2. `creator`: The `Collection.creator` receives fees based on the `Collection`'s configured royalty and transfer fees, and may mint tokens. More specifically, the `creator`:
      1. Receives fees determined by the `Collection` `transferFee`, `NFT` transfer price, and `Collection` `royaltyFee`.
      2. Prevent users from transferring funds by setting their `receive` permissions to `impossible`, causing fees to fail.
      3. Mint `NFT`s when the contract is not paused, and minting for the `Collection` has not been limited (see the `admin`'s role below).
      4. Upon permission from the `admin` (see below), transfer the `creator` role.
   3. `admin`: The `Collection.admin` configures all of the `Collection` settings, including metadata, fees, and the paused status. The `admin` is intended to be a smart contract, whose implementation depends on the specific `Collection` instance. This smart contract may:
      1. Upgrade the `Collection`'s verification key to implement arbitrary logic.
      2. Configure the collection’s fees, name, and base URL.
      3. Pause and un-pause the `Collection`, and individual `NFT`s.
      4. Transfer `admin` rights to another account.
      5. Transfer the `creator` role, upon approval by the `creator`.
      6. “Limit” `NFT` minting, i.e. permanently prevent future minting on this `Collection`.
      7. Mint `NFT`s when the contract is not paused, and minting for the `Collection` has not been limited.
      8. Restrict updates to `NFT`-data.
      9. Restrict `NFT` transfers when the `Collection` is configured with `requireTransferApproval == true`.
      10. Upgrade `NFT` verification keys, with owner approval if required based on the `NFT`'s data.
2. `NFT`: `NFT`s (when used properly) are deployed directly by the `Collection`. Depending on their configuration when minted, there may still be some special roles with extra authority over the particular `NFT`:
   1. deployer: Whoever knows the private key may upgrade the `NFT` on hard forks.
   2. `owner`: The owner may
      1. transfer the `NFT` ownership based on signature or verification key (for `NFT`s with `canTransfer`)
      2. set the `approved` address based on signature or verification key (for `NFT`s with `canApprove`)
      3. prevent upgrading the `NFT`'s verification key for `Collection`s with `isOwnerApprovalRequired`
   3. `approved`: An approved account may transfer the `NFT` ownership (for `NFT`s with `canTransfer`).
   4. `metadataVerificationKeyHash`: Anyone who can create a proof which verifies against the `metadataVerificationKeyHash` may update the `NFT` itself (contingent upon approval by the `Collection` `admin`). More precisely, the may:
      1. Edit `owner` or `approved` (for `NFT`s with `canChangeOwnerByProof`, regardless of `canTransfer` or `canApprove`)
      2. Edit the `name`, `metadata`, `storage`, `isPaused`, or `metadataVerificationKeyHash` (for `NFT`s with `canChangeName`, `canChangeMetadata`, `canChangeStorage`, `canPause`, and `canChangeMetadataVerificationKeyHash`, respectively).
      3. Set the `NFT` version arbitrarily high, causing denial-of-service.

## Default Implementations

1. `NFTAdmin`. This contract extends the class `NFTAdminBase` and serves as the foundational administrative layer for the NFT collection. The address of the `NFTAdmin` contract corresponds to the `Collection.admin`. It provides approval for critical functionalities within the collection such as NFT upgrades, pausing and resuming operations and ownership management. Note that this contract is upgradable, and therefore a malicious admin can pose a signifiant threat to the collection. The contract has its own `admin`, which is required to sign off on various (but not all) approvals in the default implementation.
   1. `admin`: This account may perform any of the following actions
      1. Upgrades the NFTAdmin’s verification key.
      2. Pause or resume the `NFTAdmin` contract.
      3. Transfers ownership of the contract to a new admin.
      4. Upgrade specific NFT verification keys (possibly with consent of the owner, if required).
      5. `canChangeRoyalty()` - Determines if the royalty fee can be changed for a Collection.
      6. `canChangeTransferFee()` - Determines if the transfer fee can be changed for a Collection.
      7. `canPause()` - Determines if the collection can be paused.
      8. `canResume()` - Determines if the collection can be resumed.
   2. deployer: The deployer is the public key used to deploy the NFT collection contract. It is responsible for
      1. Correctly configuring the verification key and permissions for the zkApp.
      2. Upgrading the zkApp during hard forks.

## Contracts providing approval for critical actions related to the NFT collection

The following contracts are provided as templates in the project and are not meant to be used as is. Instead a user deploying a collection should tailor them as per the requirements. But, these templates provide a good estimate of trust assumptions on the part of the collection. For the default implementations, the admin of the contract signs off on each permitted action, but the deployer can change the `VerificationKey` unprompted, and therefore it remains fully in control.

1. `NFTStandardApproval` — This contract provides approval for transfers by proof, if the owner of the NFT is a contract.
2. `NFTStandardOwner` — This contract is the default implementation of an NFT owner contract. It provides approval for critical NFT actions like pause, resume, approve, transfer and upgrade.
3. `NFTStandardUpdate` — This contract is a default implementation of the `oracle`. The `oracle` optionally provides approval for an NFT update.

## Impact

As a standard intended for broad use across several implementations, the precise impact of these centralization risks may be difficult to asses. Given this setting, the Veridise team that has audited the contracts wishes to highlight some specific risks based on the above centralization issues:

1. **Signature-based transfers**: Transfers via signature cannot be prevented for an `NFT`. This means that, for a third-party smart contract to truly own the `NFT`, their `access` permissions must be set to `proof`-only. Otherwise, whoever knows the private key may bypass the smart contract logic and transfer the `NFT` to themselves.
2. **Creator dependence on admin-set fees**: The `Collection` `admin`s may set fees arbitrarily, including to zero.
3. **NFT owner dependence on admin-set fees**: The `Collection` `admin` may set fees arbitrarily high, preventing transfers.
4. **Use of “standard” contracts**: Implementers may use the standard owner, updater, or approver contracts.
5. **NFT update risks**: The `metadataVerificationKey` encodes logic which may arbitrarily update the `NFT` (up to mutability flags), even when paused. This may fully DoS the `NFT` by setting the version to `UInt32.MAXINT()`, preventing further transfers.
6. **Rogue NFT updates on hard-forks**: During a Mina hard-fork, the owner of an `NFT`'s private key may upgrade the verification key. If `Collection` `creator`s/`admin`s do not control these keys, it may lead to serious issues (see [Maliciously upgraded NFTs may mint new NFTs](https://www.notion.so/Maliciously-upgraded-NFTs-may-mint-new-NFTs-1b6105edf1db8028888bd6ccc9871f89?pvs=21)). Conversely, if `Collection` `creator`s/`admin`s lose control of these keys, upgrades may be prevented.
7. **Key loss / malicious action**: As always, centralized roles may offer promising targets for attackers, or be abused by role holders. Depending on the `admin` contract, this could include a full contract upgrade, targeted denial of service to `NFT` holders, or theft of `NFT`s.

## Recommendation

Some of these issues should be mitigated by following the following recommendations:

1. **Signature-based transfers**: Users should validate contract permissions before trusting it with ownership of their `NFT`.
2. **Creator dependence on admin-set fees**: `NFT` creators should validate the `admin` contract has sufficient protections, or is operated by a trusted party, to prevent loss of fees.
3. **NFT owner dependence on admin-set fees**: `NFT` owners should validate the `admin` contract has sufficient protections, or is operated by a trusted party, to prevent prohibitively exorbitant of fees.
4. **Use of “standard” contracts**: `NFT` users should not use the standard contracts.

A few of the above issues may be mitigated by concrete action.

1. **NFT update risks**: Consider setting a maximum version increase for updates. Given the current Mina block time of several minutes, this will ensure the version limit is not reached before the next hard fork. This should be inforced in ZkProgram that update metadata, with typical increase of the version by one in the method, so at least one proof calculation is reqired for increasing the version by one, and, in case of merged proofs, more than one proof per each increase of the version by one.

Finally, some problems are best mitigated through extensive care in the operational security practices taken when operating the specified roles.

1. **Rogue NFT updates on hard-forks**: `Collection` `admin`/`creator`s should own and operate the keys of all `NFT`s, and carefully store them in a persistent manner (see operational-security guidance below).
2. **Key loss / malicious action**: All deployer, administrative, and `creator` roles should take care to follow security best practices (see below).

Privileged operations should be operated by a multi-sig contract or a decentralized governance system. Non-emergency privileged operations should be guarded by a timelock to ensure there is enough time for incident response. The risks in this issue may be partially mitigated by validating that the protocol is deployed with the appropriate roles granted to the timelock and multi-sig contracts. The multi-sig is in development now: https://github.com/o1-labs/o1js/issues/1971. Please check https://github.com/o1-labs/o1js/blob/main/CHANGELOG.md to see when it will become available.

Users of the protocol should ensure they are confident that the operators of privileged keys are following best practices such as:

1. Never storing a protocol key in plaintext, on a regularly used phone, laptop, or device, or relying on a custom solution for key management.
2. Using separate keys for each separate function.
3. Storing multi-sig keys in a diverse set of key management software/hardware services and geographic locations.
4. Enabling 2FA for key management accounts. SMS should **not** be used for 2FA, nor should any account which uses SMS for 2FA. Authentication apps or hardware are preferred.
5. Validating that no party has control over multiple multi-sig keys.
6. Performing regularly scheduled key rotations for high-frequency operations.
7. Securely storing physical, non-digital backups for critical keys.
8. Actively monitoring for unexpected invocation of critical operations and/or deployed attack contracts.
9. Regularly drilling responses to situations requiring emergency response such as pausing/unpausing.

## Recommended contract factory validations for developers

The Mina NFT standard uses a new contract factory pattern for development. For example, suppose a contract Foo is intended to call a contract Bar. Using the contract factory pattern, Foo would access Bar by calling a function which returns a constructor for Bar, instead of just calling Bar directly. An example can be seen in the below code snippet.

```typescript
function FooFactory(barFactory: () => BarConstructor) {
  class Foo extends SmartContract {
    @method async foo(address: PublicKey) {
      const barInstance = new BarConstructor()(address);
      barInstance.bar();
    }
  }
  return Foo;
}
```

Since the logic of `Foo` and `Bar` are compiled separately, taking this approach (instead of just calling `new Bar()` directly) should not change the verification key of `Foo`.

This pattern allows users to more easily swap out different implementations of `Bar`, so long as each implementation has a `@method` with the same signature as `Bar.bar()`. This is especially helpful for the NFT standard, which expects users to have custom admin, owner, update, and approver contracts.

When compiling a class created with the factory pattern, users must call the factory to get a concrete instance of the class, then compile that instance. To ensure that all the usual checks performed when calling another smart contract are in place, this instance must be instantiated with constructors of actual o1js smart contracts.

For example, a malicious compiler could use an overriden o1js smart contract whose constructor sets its `tokenId` to an unconstrained variable, instead of a constant 1. This would create an attack vector which may allow an attacker to maliciously deploy contracts with the `Collection`'s `tokenId`.

### Best practices of contract factories

When using the factory pattern,

1. Compile the factory-created contract with concrete instantiations of the contracts it may call.
2. Compile the factory-created contract with multiple different concrete instantiations of the contracts it may call, and validate the `vkey` is unchanged.
3. Consider using `Provable.isConstant()` to check that the `AccountUpdate` produced by method calls has a constant token ID of 1.

```typescript
const OwnerContract = ownerContract();
const owner = new OwnerContract(address);
assert(Provable.isConstant(Field, owner.self.tokenId));
Provable.assertEqual(Field, owner.self.tokenId, TokenId.default);
return owner;
```
